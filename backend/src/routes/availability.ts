import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { isValidNumber, capText, SHORT_TEXT_LEN } from '../utils/validate'

const VALID_OVERRIDE_STATUSES = ['open', 'closed', 'holiday']

const router = express.Router()
const prisma = new PrismaClient()

// ── Static routes first (before /:garageId to avoid conflicts) ────────────────

// POST /availability/override — garage sets/updates a date override
router.post('/override', authMiddleware, async (req: AuthRequest, res) => {
  const { date, status, maxSlots, message, messageColor } = req.body
  if (!date || !status) {
    res.status(400).json({ error: 'date and status are required' })
    return
  }
  if (!VALID_OVERRIDE_STATUSES.includes(status)) {
    res.status(400).json({ error: 'status must be open, closed, or holiday' }); return
  }
  if (maxSlots !== undefined && maxSlots !== null && !isValidNumber(maxSlots, { min: 0, max: 200 })) {
    res.status(400).json({ error: 'maxSlots must be a valid, non-negative number' }); return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    const override = await prisma.garageCalendarOverride.upsert({
      where: { garageId_date: { garageId: garage.id, date } },
      update: {
        status,
        maxSlots: maxSlots ?? null,
        message: message ? capText(message, SHORT_TEXT_LEN) : null,
        messageColor: messageColor ? capText(messageColor, 20) : null,
      },
      create: {
        garageId: garage.id,
        date,
        status,
        maxSlots: maxSlots ?? null,
        message: message ? capText(message, SHORT_TEXT_LEN) : null,
        messageColor: messageColor ? capText(messageColor, 20) : null,
      },
    })
    res.json(override)
  } catch (error) {
    console.error('POST /availability/override error:', error)
    res.status(500).json({ error: 'Failed to set override' })
  }
})

// DELETE /availability/override — garage removes an override
router.delete('/override', authMiddleware, async (req: AuthRequest, res) => {
  const { date } = req.body
  if (!date) { res.status(400).json({ error: 'date is required' }); return }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    await prisma.garageCalendarOverride.deleteMany({ where: { garageId: garage.id, date } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove override' })
  }
})

// PUT /availability — garage updates base settings
router.put('/', authMiddleware, async (req: AuthRequest, res) => {
  const { workDays, maxPerDay, timeSlots } = req.body
  if (!Array.isArray(workDays) || typeof maxPerDay !== 'number') {
    res.status(400).json({ error: 'workDays (array) and maxPerDay (number) are required' })
    return
  }
  if (!workDays.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)) {
    res.status(400).json({ error: 'workDays must contain integers 0-6' }); return
  }
  if (!isValidNumber(maxPerDay, { min: 1, max: 200 })) {
    res.status(400).json({ error: 'maxPerDay must be between 1 and 200' }); return
  }
  if (timeSlots !== undefined && (!Array.isArray(timeSlots) || timeSlots.length > 20 || !timeSlots.every((s: unknown) => typeof s === 'string'))) {
    res.status(400).json({ error: 'timeSlots must be an array of at most 20 strings' }); return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    const slots = Array.isArray(timeSlots) && timeSlots.length > 0
      ? timeSlots.map((s: string) => capText(s, SHORT_TEXT_LEN))
      : ['Morning', 'Afternoon']

    const availability = await prisma.garageAvailability.upsert({
      where: { garageId: garage.id },
      update: { workDays: JSON.stringify(workDays), maxPerDay, timeSlots: JSON.stringify(slots) },
      create: { garageId: garage.id, workDays: JSON.stringify(workDays), maxPerDay, timeSlots: JSON.stringify(slots) },
    })
    res.json(availability)
  } catch (error) {
    console.error('PUT /availability error:', error)
    res.status(500).json({ error: 'Failed to update availability' })
  }
})

// ── Parameterised routes ──────────────────────────────────────────────────────

// GET /availability/:garageId — base settings (used by garage to load current config)
router.get('/:garageId', authMiddleware, async (req: AuthRequest, res) => {
  const garageId = req.params.garageId as string
  try {
    const availability = await prisma.garageAvailability.findUnique({ where: { garageId } })
    res.json(availability || { workDays: '[1,2,3,4,5]', maxPerDay: 5, timeSlots: '["Morning","Afternoon"]' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability' })
  }
})

// GET /availability/:garageId/overrides — all overrides for a month (garage calendar view)
router.get('/:garageId/overrides', authMiddleware, async (req: AuthRequest, res) => {
  const garageId = req.params.garageId as string
  const month = req.query.month as string // YYYY-MM
  try {
    const where: any = { garageId }
    if (month) {
      where.date = { gte: `${month}-01`, lte: `${month}-31` }
    }
    const overrides = await prisma.garageCalendarOverride.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    res.json(overrides)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overrides' })
  }
})

// GET /availability/:garageId/dates — bookable dates with per-slot info (vehicle owner)
router.get('/:garageId/dates', authMiddleware, async (req: AuthRequest, res) => {
  const garageId = req.params.garageId as string
  const numDays = Math.min(parseInt(req.query.days as string) || 14, 60)

  try {
    const availability = await prisma.garageAvailability.findUnique({ where: { garageId } })
    const workDays: number[] = availability ? JSON.parse(availability.workDays) : [1, 2, 3, 4, 5]
    const maxPerDay = availability?.maxPerDay ?? 5
    const timeSlots: string[] = availability ? JSON.parse(availability.timeSlots) : ['Morning', 'Afternoon']

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + numDays)
    const startStr = today.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // Load all overrides for the range in one query
    const overrides = await prisma.garageCalendarOverride.findMany({
      where: { garageId, date: { gte: startStr, lte: endStr } },
    })
    const overrideMap = new Map(overrides.map(o => [o.date, o]))

    // Load all bookings for the range in one query
    const allBookings = await prisma.booking.findMany({
      where: { garageId, date: { gte: today, lte: endDate }, status: { not: 'cancelled' } },
      select: { date: true, slotLabel: true },
    })
    const bookingsByDate = new Map<string, { slotLabel: string | null }[]>()
    for (const b of allBookings) {
      const ds = b.date.toISOString().split('T')[0]
      if (!bookingsByDate.has(ds)) bookingsByDate.set(ds, [])
      bookingsByDate.get(ds)!.push({ slotLabel: b.slotLabel })
    }

    const dates = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayOfWeek = d.getDay()

      const override = overrideMap.get(dateStr)
      const isWorkDay = workDays.includes(dayOfWeek)
      const effectiveStatus = override?.status ?? (isWorkDay ? 'open' : 'closed')
      const effectiveMax = override?.maxSlots ?? maxPerDay
      const isOpen = effectiveStatus === 'open'

      const dayBookings = bookingsByDate.get(dateStr) || []
      const totalBooked = dayBookings.length

      const slotCounts: Record<string, number> = {}
      for (const b of dayBookings) {
        const key = b.slotLabel || '__none__'
        slotCounts[key] = (slotCounts[key] || 0) + 1
      }

      const slots = timeSlots.map(label => ({
        label,
        booked: slotCounts[label] || 0,
        available: isOpen && totalBooked < effectiveMax && (slotCounts[label] || 0) === 0,
      }))

      dates.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-GB', { month: 'short' }),
        isWorkDay,
        status: effectiveStatus,
        available: isOpen && totalBooked < effectiveMax,
        remaining: Math.max(0, effectiveMax - totalBooked),
        message: override?.message || null,
        messageColor: override?.messageColor || null,
        slots,
      })
    }

    res.json({ dates, maxPerDay, timeSlots })
  } catch (error) {
    console.error('GET /availability/:garageId/dates error:', error)
    res.status(500).json({ error: 'Failed to fetch available dates' })
  }
})

export default router
