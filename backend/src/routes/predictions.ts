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
          { screen: 'predictions', vehicleId: vehicle.id })
        sent++
      } else if (dueSoon.length > 0) {
        const top = dueSoon[0]
        const kmText   = top.remainingKm   != null ? `${top.remainingKm.toLocaleString()} km` : ''
        const daysText = top.remainingDays != null ? `${top.remainingDays} days` : ''
        const timeLeft = [kmText, daysText].filter(Boolean).join(' / ')
        await sendPush(user.pushToken, `Service Due: ${vehicleName}`,
          `${top.name} due in ${timeLeft}`,
          { screen: 'predictions', vehicleId: vehicle.id })
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

    // Independent queries - run concurrently instead of one round-trip each
    // (this endpoint is on the Confirm Booking page's critical path; sequential
    // awaits here were adding a visible delay - see CLAUDE.md's cross-feature
    // consistency note, 2026-10-24).
    const [vehicle, records, expenses, fuelLogs] = await Promise.all([
      prisma.vehicle.findFirst({ where: { id: vehicleId } }),
      prisma.serviceRecord.findMany({ where: { vehicleId }, orderBy: { date: 'desc' } }),
      // Emission/Insurance/Revenue Licence are date-driven renewals tracked on the
      // Vehicle model itself (emissionTestExpiry/insuranceExpiry/revenueLicenceExpiry),
      // not in the mileage/date-interval database computePredictions draws from - so
      // they never appeared in Cost Forecast at all until now. Insurance/Revenue
      // Licence costs are logged as Expense rows (category 'Insurance'/'Revenue
      // Licence'), not ServiceRecord, so a separate fetch is needed for them.
      prisma.expense.findMany({ where: { vehicleId, category: { in: ['Insurance', 'Revenue Licence'] } } }),
      prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { date: 'desc' }, take: 20 }),
    ])

    // Estimate avg daily km from recent fuel logs (fetched above, in parallel)
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

    // Renewal items (see fetch above for why these need separate handling). Shared
    // date math + output shape; cost is averaged from whichever cost source applies.
    type RenewalOut = { name: string; status: 'overdue' | 'due_soon' | 'ok'; remainingKm: null; remainingDays: number; estimatedCost: number | null; basedOn: number }
    const renewalFromCosts = (name: string, expiry: Date | null, costs: number[]): RenewalOut | null => {
      if (!expiry) return null
      const remainingDays = Math.round((expiry.getTime() - Date.now()) / 86400000)
      if (remainingDays > FORECAST_DAYS) return null
      const status: 'overdue' | 'due_soon' | 'ok' =
        remainingDays < 0 ? 'overdue' : remainingDays <= 30 ? 'due_soon' : 'ok'
      const estimatedCost = costs.length > 0
        ? Math.round(costs.reduce((s, c) => s + c, 0) / costs.length)
        : null
      return { name, status, remainingKm: null, remainingDays, estimatedCost, basedOn: costs.length }
    }

    const emissionCosts = records
      .filter(r => r.description.toLowerCase().includes('emission') && r.cost != null && r.cost > 0)
      .map(r => r.cost!)
    const insuranceCosts = expenses
      .filter(e => e.category === 'Insurance' && e.amount != null && e.amount > 0)
      .map(e => e.amount!)
    const licenceCosts = expenses
      .filter(e => e.category === 'Revenue Licence' && e.amount != null && e.amount > 0)
      .map(e => e.amount!)

    const renewalItems = [
      renewalFromCosts('Emission Test', vehicle!.emissionTestExpiry, emissionCosts),
      renewalFromCosts('Insurance', vehicle!.insuranceExpiry, insuranceCosts),
      renewalFromCosts('Revenue Licence', vehicle!.revenueLicenceExpiry, licenceCosts),
    ].filter((i): i is RenewalOut => i !== null)

    const allItems = [...forecastItems, ...renewalItems]
    const totalEstimated = allItems.reduce((s, i) => s + (i.estimatedCost ?? 0), 0)

    res.json({ items: allItems, totalEstimated, periodDays: FORECAST_DAYS })
  } catch (error) {
    console.error('GET /predictions/cost-forecast error:', error)
    res.status(500).json({ error: 'Failed to generate cost forecast' })
  }
})

export default router
