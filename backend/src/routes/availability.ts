import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// GET /availability/:garageId — any authenticated user can see availability
router.get('/:garageId', authMiddleware, async (req: AuthRequest, res) => {
  const garageId = req.params.garageId as string
  try {
    const availability = await prisma.garageAvailability.findUnique({ where: { garageId } })
    res.json(availability || { workDays: '[1,2,3,4,5]', maxPerDay: 5 })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability' })
  }
})

// GET /availability/:garageId/dates — next 14 days with slot counts
router.get('/:garageId/dates', authMiddleware, async (req: AuthRequest, res) => {
  const garageId = req.params.garageId as string
  try {
    const availability = await prisma.garageAvailability.findUnique({ where: { garageId } })
    const workDays: number[] = availability ? JSON.parse(availability.workDays) : [1, 2, 3, 4, 5]
    const maxPerDay = availability?.maxPerDay ?? 5

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dates = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dayOfWeek = d.getDay()
      const isWorkDay = workDays.includes(dayOfWeek)

      const startOfDay = new Date(d)
      const endOfDay = new Date(d)
      endOfDay.setHours(23, 59, 59, 999)

      const bookingCount = await prisma.booking.count({
        where: { garageId, date: { gte: startOfDay, lte: endOfDay }, status: { not: 'cancelled' } },
      })

      dates.push({
        date: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-GB', { month: 'short' }),
        isWorkDay,
        remaining: Math.max(0, maxPerDay - bookingCount),
        available: isWorkDay && bookingCount < maxPerDay,
      })
    }

    res.json({ dates, maxPerDay })
  } catch (error) {
    console.error('GET /availability/:garageId/dates error:', error)
    res.status(500).json({ error: 'Failed to fetch available dates' })
  }
})

// PUT /availability — garage sets their availability
router.put('/', authMiddleware, async (req: AuthRequest, res) => {
  const { workDays, maxPerDay } = req.body
  if (!Array.isArray(workDays) || typeof maxPerDay !== 'number') {
    res.status(400).json({ error: 'workDays (array) and maxPerDay (number) are required' })
    return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    const availability = await prisma.garageAvailability.upsert({
      where: { garageId: garage.id },
      update: { workDays: JSON.stringify(workDays), maxPerDay },
      create: { garageId: garage.id, workDays: JSON.stringify(workDays), maxPerDay },
    })
    res.json(availability)
  } catch (error) {
    console.error('PUT /availability error:', error)
    res.status(500).json({ error: 'Failed to update availability' })
  }
})

export default router
