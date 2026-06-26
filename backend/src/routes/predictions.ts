import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { computePredictions, urgencyScore } from '../utils/predictionEngine'
import { sendPush } from '../utils/push'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /predictions/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const { vehicleId } = req.params as { vehicleId: string }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })

    res.json(computePredictions(vehicle, records))
  } catch (error) {
    console.error('GET /predictions error:', error)
    res.status(500).json({ error: 'Failed to generate predictions' })
  }
})

// POST /predictions/notify — manual trigger (kept for testing)
router.post('/notify', async (req: AuthRequest, res) => {
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
      const predictions = computePredictions(vehicle, records)
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

export default router
