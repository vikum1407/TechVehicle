import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

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
    await createNotification(
      prisma, garage.ownerPhone,
      'booking_request',
      booking.vehicle.registrationNo,
      `New booking request for ${dateStr}${slotLabel ? ` · ${slotLabel}` : ''}${serviceLabel}`,
      { screen: 'garage', bookingId: booking.id }
    )

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
      where: { ownerPhone: req.phoneNumber!, status: { notIn: ['cancelled', 'completed'] } },
      include: { vehicle: true, garage: true, _count: { select: { bookingNotes: true } } },
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
      where: { garageId: garage.id, status: { notIn: ['cancelled', 'completed'] } },
      include: { vehicle: true, _count: { select: { bookingNotes: true } } },
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
    await createNotification(
      prisma, booking.ownerPhone,
      'booking_confirmed',
      updated.vehicle.registrationNo,
      `${garage.name} confirmed your booking for ${dateStr}`,
      { screen: 'vehicleDashboard', vehicleId: booking.vehicleId, bookingId: booking.id }
    )

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
      include: { vehicle: true, garage: true },
    })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    await prisma.booking.update({ where: { id }, data: { status: 'cancelled' } })

    const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: booking.garage.ownerPhone } })
    const prefs = parsePrefs(garageOwner?.notificationPrefs)
    const dateStr = new Date(booking.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (prefs.booking) {
      await sendPush(
        garageOwner?.pushToken,
        'Booking Cancelled',
        `${booking.vehicle.registrationNo} — cancelled their booking for ${dateStr}`,
        { screen: 'garage' }
      )
    }
    await createNotification(
      prisma, booking.garage.ownerPhone,
      'booking_cancelled',
      booking.vehicle.registrationNo,
      `Owner cancelled their booking for ${dateStr}`,
      { screen: 'garage' }
    )

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' })
  }
})

// POST /bookings/:id/counter — garage proposes a different date/slot
router.post('/:id/counter', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const { counterDate, counterSlot } = req.body
  if (!counterDate) { res.status(400).json({ error: 'counterDate is required' }); return }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage account' }); return }

    const booking = await prisma.booking.findFirst({
      where: { id, garageId: garage.id, status: 'pending' },
      include: { vehicle: true },
    })
    if (!booking) { res.status(404).json({ error: 'Booking not found or not pending' }); return }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'counter_suggested', counterDate: new Date(counterDate), counterSlot: counterSlot || null },
    })

    const owner = await prisma.user.findUnique({ where: { phoneNumber: booking.ownerPhone } })
    const prefs = parsePrefs(owner?.notificationPrefs)
    const dateStr = new Date(counterDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const slotPart = counterSlot ? ` · ${counterSlot}` : ''
    const title = `${garage.name} suggests a different slot`
    const body  = `${booking.vehicle.registrationNo} — ${dateStr}${slotPart}`
    if (prefs.booking) {
      await sendPush(owner?.pushToken, title, body, { screen: 'vehicles', vehicleId: booking.vehicleId })
    }
    await createNotification(prisma, booking.ownerPhone, 'booking_counter', title, body, {
      screen: 'vehicleDashboard', vehicleId: booking.vehicleId, bookingId: id,
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to counter-suggest booking' })
  }
})

// POST /bookings/:id/accept-counter — owner accepts the garage's counter suggestion
router.post('/:id/accept-counter', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const booking = await prisma.booking.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'counter_suggested' },
      include: { garage: true, vehicle: true },
    })
    if (!booking || !booking.counterDate) { res.status(404).json({ error: 'Booking not found or no counter pending' }); return }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'confirmed',
        date: booking.counterDate,
        slotLabel: booking.counterSlot ?? null,
        counterDate: null,
        counterSlot: null,
      },
    })

    const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: booking.garage.ownerPhone } })
    const prefs = parsePrefs(garageOwner?.notificationPrefs)
    const dateStr = booking.counterDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const title = `Counter offer accepted — ${booking.vehicle.registrationNo}`
    const body  = `Owner confirmed the new slot: ${dateStr}${booking.counterSlot ? ` · ${booking.counterSlot}` : ''}`
    if (prefs.booking) {
      await sendPush(garageOwner?.pushToken, title, body, { screen: 'garage', bookingId: id })
    }
    await createNotification(prisma, booking.garage.ownerPhone, 'booking_counter_accepted', title, body, {
      screen: 'garage', bookingId: id,
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept counter' })
  }
})

// POST /bookings/:id/decline-counter — owner declines the counter, cancels the booking
router.post('/:id/decline-counter', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const booking = await prisma.booking.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'counter_suggested' },
      include: { garage: true, vehicle: true },
    })
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled', counterDate: null, counterSlot: null },
    })

    const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: booking.garage.ownerPhone } })
    const prefs = parsePrefs(garageOwner?.notificationPrefs)
    const title = `Counter offer declined — ${booking.vehicle.registrationNo}`
    const body  = 'Owner declined the suggested slot. The booking has been cancelled.'
    if (prefs.booking) {
      await sendPush(garageOwner?.pushToken, title, body, { screen: 'garage' })
    }
    await createNotification(prisma, booking.garage.ownerPhone, 'booking_counter_declined', title, body, {
      screen: 'garage',
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to decline counter' })
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
    const booking = await prisma.booking.findUnique({ where: { id }, include: { garage: true, vehicle: true } })
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
      await createNotification(
        prisma, booking.garage.ownerPhone,
        'message',
        booking.vehicle.registrationNo,
        `Owner: ${message.trim()}`,
        { screen: 'garage', bookingId: id }
      )
    } else {
      const owner = await prisma.user.findUnique({ where: { phoneNumber: booking.ownerPhone } })
      const prefs = parsePrefs(owner?.notificationPrefs)
      if (prefs.booking) {
        await sendPush(owner?.pushToken, `Message from ${booking.garage.name}`, message.trim(), { bookingId: id, vehicleId: booking.vehicleId, screen: 'vehicles' })
      }
      await createNotification(
        prisma, booking.ownerPhone,
        'message',
        booking.vehicle.registrationNo,
        `${booking.garage.name}: ${message.trim()}`,
        { screen: 'vehicleDashboard', vehicleId: booking.vehicleId, bookingId: id }
      )
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
