import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { checkRateLimit } from '../utils/rateLimit'
import { computePredictions, urgencyScore } from '../utils/predictionEngine'
import { sendPush } from '../utils/push'
import { canReadVehicle } from '../utils/vehicleAccess'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /predictions/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const { vehicleId } = req.params as { vehicleId: string }
  try {
    if (!await canReadVehicle(prisma, vehicleId, req.phoneNumber!)) {
      res.status(404).json({ error: 'Vehicle not found' }); return
    }
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } })

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })

    res.json(computePredictions(vehicle as any, records))
  } catch (error) {
    console.error('GET /predictions error:', error)
    res.status(500).json({ error: 'Failed to generate predictions' })
  }
})

// POST /predictions/notify — manual trigger (kept for testing)
router.post('/notify', async (req: AuthRequest, res) => {
  const notifyLimit = checkRateLimit('predictions-notify', req.phoneNumber!, 5, 60 * 60 * 1000)
  if (!notifyLimit.allowed) { res.status(429).json({ error: 'Too many notification requests. Try again later.' }); return }
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber: req.phoneNumber! } })
    if (!user?.pushToken) { res.json({ sent: 0, reason: 'no push token' }); return }

    const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: req.phoneNumber! } })
    let sent = 0

    for (const vehicle of vehicles) {
      const records = await prisma.serviceRecord.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'desc' },
      })
      const predictions = computePredictions(vehicle as any, records)
      const overdue  = predictions.filter(p => p.status === 'overdue')
      const dueSoon  = predictions.filter(p => p.status === 'due_soon')
      const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

      if (overdue.length > 0) {
        const names = overdue.map(p => p.name).join(', ')
        await sendPush(user.pushToken, `Overdue: ${vehicleName}`,
          overdue.length === 1
            ? `${names} is overdue — service needed soon`
            : `${overdue.length} services overdue: ${names}`,
          { screen: 'vehicles', vehicleId: vehicle.id })
        sent++
      } else if (dueSoon.length > 0) {
        const top = dueSoon[0]
        const kmText   = top.remainingKm   != null ? `${top.remainingKm.toLocaleString()} km` : ''
        const daysText = top.remainingDays != null ? `${top.remainingDays} days` : ''
        const timeLeft = [kmText, daysText].filter(Boolean).join(' / ')
        await sendPush(user.pushToken, `Service Due: ${vehicleName}`,
          `${top.name} due in ${timeLeft}`,
          { screen: 'vehicles', vehicleId: vehicle.id })
        sent++
      }
    }
    res.json({ sent })
  } catch (error) {
    console.error('POST /predictions/notify error:', error)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
})

// GET /predictions/:vehicleId/cost-forecast — upcoming service cost projection
router.get('/:vehicleId/cost-forecast', async (req: AuthRequest, res) => {
  const { vehicleId } = req.params as { vehicleId: string }
  try {
    if (!await canReadVehicle(prisma, vehicleId, req.phoneNumber!)) {
      res.status(404).json({ error: 'Vehicle not found' }); return
    }
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } })

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })

    // Estimate avg daily km from recent fuel logs
    const fuelLogs = await prisma.fuelLog.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
      take: 20,
    })
    let avgKmPerDay: number | null = null
    if (fuelLogs.length >= 2) {
      const newest = fuelLogs[0]
      const oldest = fuelLogs[fuelLogs.length - 1]
      const days = (newest.date.getTime() - oldest.date.getTime()) / 86400000
      if (days > 0) avgKmPerDay = (newest.mileage - oldest.mileage) / days
    }

    const predictions = computePredictions(vehicle as any, records)

    const FORECAST_DAYS = 90
    const forecastItems = predictions
      .filter(p => {
        if (p.status === 'overdue') return true
        if (p.status === 'due_soon') return true
        // ok items: include if due within FORECAST_DAYS by calendar date
        if (p.remainingDays !== null && p.remainingDays <= FORECAST_DAYS) return true
        // ok items: include if due within FORECAST_DAYS projected by avg km/day
        if (p.remainingKm !== null && avgKmPerDay !== null && avgKmPerDay > 0) {
          const projectedDays = p.remainingKm / avgKmPerDay
          if (projectedDays <= FORECAST_DAYS) return true
        }
        return false
      })
      .map(p => {
        // Find avg cost from matching past service records
        const matching = records.filter(r =>
          p.keywords.some(kw => r.description.toLowerCase().includes(kw.toLowerCase()))
          && r.cost != null && r.cost > 0
        )
        const estimatedCost = matching.length > 0
          ? Math.round(matching.reduce((s, r) => s + (r.cost ?? 0), 0) / matching.length)
          : null

        return {
          name: p.name,
          status: p.status,
          remainingKm: p.remainingKm,
          remainingDays: p.remainingDays,
          estimatedCost,
          basedOn: matching.length,
        }
      })

    const totalEstimated = forecastItems.reduce((s, i) => s + (i.estimatedCost ?? 0), 0)

    res.json({ items: forecastItems, totalEstimated, periodDays: FORECAST_DAYS })
  } catch (error) {
    console.error('GET /predictions/cost-forecast error:', error)
    res.status(500).json({ error: 'Failed to generate cost forecast' })
  }
})

export default router
