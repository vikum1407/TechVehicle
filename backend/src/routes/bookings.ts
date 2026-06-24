import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { sendPush } from '../utils/push'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// POST /bookings — owner creates a booking
router.post('/', async (req: AuthRequest, res) => {
  const { vehicleId, garageId, date, notes, noteType, slotLabel, shareSessionId, serviceType } = req.body
  if (!vehicleId || !garageId || !date) {
    res.status(400).json({ error: 'vehicleId, garageId and date are required' })
    return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const garage = await prisma.garage.findUnique({ where: { id: garageId } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    const availability = await prisma.garageAvailability.findUnique({ where: { garageId } })
    const maxPerDay = availability?.maxPerDay ?? 5

    const bookingDate = new Date(date)
    const startOfDay = new Date(bookingDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(bookingDate)
    endOfDay.setHours(23, 59, 59, 999)

    const bookingCount = await prisma.booking.count({
      where: { garageId, date: { gte: startOfDay, lte: endOfDay }, status: { not: 'cancelled' } },
    })
    if (bookingCount >= maxPerDay) {
      res.status(400).json({ error: 'This date is fully booked' }); return
    }

    const booking = await prisma.booking.create({
      data: {
        vehicleId,
        garageId,
        ownerPhone: req.phoneNumber!,
        date: bookingDate,
        slotLabel: slotLabel || null,
        notes: notes || null,
        noteType: noteType || 'normal',
        serviceType: serviceType || null,
        shareSessionId: shareSessionId || null,
      },
      include: { vehicle: true, garage: true },
    })

    const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: garage.ownerPhone } })
    const prefs = parsePrefs(garageOwner?.notificationPrefs)
    const dateStr = bookingDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const serviceLabel = serviceType ? ` · ${SERVICE_TYPE_LABELS[serviceType] ?? serviceType}` : ''
    if (prefs.booking) {
      await sendPush(
        garageOwner?.pushToken,
        'New Booking Request',
        `${booking.vehicle.registrationNo} — ${dateStr}${slotLabel ? ` · ${slotLabel}` : ''}${serviceLabel}`,
        { bookingId: booking.id, screen: 'garage' }
      )
    }

    res.status(201).json(booking)
  } catch (error) {
    console.error('POST /bookings error:', error)
    res.status(500).json({ error: 'Failed to create booking' })
  }
})

// GET /bookings/mine — owner sees their upcoming bookings
router.get('/mine', async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { ownerPhone: req.phoneNumber!, status: { not: 'cancelled' } },
      include: { vehicle: true, garage: true },
      orderBy: { date: 'asc' },
    })
    res.json(bookings)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

// GET /bookings/garage — garage sees their bookings
router.get('/garage', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage account' }); return }

    const bookings = await prisma.booking.findMany({
      where: { garageId: garage.id, status: { not: 'cancelled' } },
      include: { vehicle: true },
      orderBy: { date: 'asc' },
    })
    res.json(bookings)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch garage bookings' })
  }
})

// POST /bookings/:id/confirm — garage confirms a booking
router.post('/:id/confirm', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage account' }); return }

    const booking = await prisma.booking.findFirst({
      where: { id, garageId: garage.id, status: 'pending' },
    })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'confirmed' },
      include: { vehicle: true },
    })

    const owner = await prisma.user.findUnique({ where: { phoneNumber: booking.ownerPhone } })
    const prefs = parsePrefs(owner?.notificationPrefs)
    const dateStr = new Date(booking.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (prefs.booking) {
      await sendPush(
        owner?.pushToken,
        'Booking Confirmed',
        `${garage.name} confirmed your booking for ${dateStr}`,
        { bookingId: booking.id, screen: 'vehicles' }
      )
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm booking' })
  }
})

// DELETE /bookings/:id — owner cancels their booking
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const booking = await prisma.booking.findFirst({
      where: { id, ownerPhone: req.phoneNumber! },
    })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    await prisma.booking.update({ where: { id }, data: { status: 'cancelled' } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' })
  }
})

// GET /bookings/:id/notes — owner or garage fetches notes for a booking
router.get('/:id/notes', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    // Allow access if caller is the owner or the garage owner
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } }).catch(() => null)
    const isOwner = booking.ownerPhone === req.phoneNumber
    const isGarage = garage?.id === booking.garageId
    if (!isOwner && !isGarage) { res.status(403).json({ error: 'Access denied' }); return }

    const notes = await prisma.bookingNote.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: 'asc' },
    })
    res.json(notes)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' })
  }
})

// POST /bookings/:id/notes — owner or garage adds a note to a booking
router.post('/:id/notes', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const { message } = req.body
  if (!message?.trim()) { res.status(400).json({ error: 'message is required' }); return }

  try {
    const booking = await prisma.booking.findUnique({ where: { id }, include: { garage: true } })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } }).catch(() => null)
    const isOwner = booking.ownerPhone === req.phoneNumber
    const isGarage = garage?.id === booking.garageId
    if (!isOwner && !isGarage) { res.status(403).json({ error: 'Access denied' }); return }

    const note = await prisma.bookingNote.create({
      data: { bookingId: id, senderPhone: req.phoneNumber!, message: message.trim() },
    })

    // Notify the other party
    if (isOwner) {
      const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: booking.garage.ownerPhone } })
      const prefs = parsePrefs(garageOwner?.notificationPrefs)
      if (prefs.booking) {
        await sendPush(garageOwner?.pushToken, 'New Message from Owner', message.trim(), { bookingId: id, screen: 'garage' })
      }
    } else {
      const owner = await prisma.user.findUnique({ where: { phoneNumber: booking.ownerPhone } })
      const prefs = parsePrefs(owner?.notificationPrefs)
      if (prefs.booking) {
        await sendPush(owner?.pushToken, `Message from ${booking.garage.name}`, message.trim(), { bookingId: id, screen: 'vehicles' })
      }
    }

    res.status(201).json(note)
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note' })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  full: 'Full Service',
  between: 'Between Service',
  third_party: 'Third-Party Service',
}

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

export default router
