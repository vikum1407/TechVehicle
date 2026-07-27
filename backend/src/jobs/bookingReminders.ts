import { PrismaClient } from '@prisma/client'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

const prisma = new PrismaClient()

async function checkBookingReminders() {
  const now = new Date()
  // Window: 8h from now to 32h from now — catches "tomorrow" regardless of job fire time
  const windowStart = new Date(now.getTime() + 8  * 60 * 60 * 1000)
  const windowEnd   = new Date(now.getTime() + 32 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'confirmed',
      reminderSent: false,
      date: { gte: windowStart, lte: windowEnd },
    },
    include: {
      vehicle: { include: { owner: true } },
      garage:  { include: { owner: true } },
    },
  })

  for (const booking of bookings) {
    const owner = booking.vehicle.owner
    const garageOwner = booking.garage.owner
    const dateStr = new Date(booking.date).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    const slot = booking.slotLabel ? ` · ${booking.slotLabel}` : ''
    const vehicleLabel = `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.registrationNo})`

    // Notify vehicle owner
    const ownerTitle = `Booking tomorrow — ${booking.garage.name}`
    const ownerBody  = `${vehicleLabel} · ${dateStr}${slot}`
    await sendPush(owner.pushToken, ownerTitle, ownerBody, { screen: 'vehicles', vehicleId: booking.vehicleId })
    await createNotification(prisma, owner.phoneNumber, 'booking_reminder', ownerTitle, ownerBody, { screen: 'vehicles', vehicleId: booking.vehicleId })

    // Notify garage owner
    const garageTitle = `Booking tomorrow — ${vehicleLabel}`
    const garageBody  = `${dateStr}${slot} · ${owner.phoneNumber}`
    await sendPush(garageOwner.pushToken, garageTitle, garageBody, { screen: 'garage', bookingId: booking.id })
    await createNotification(prisma, garageOwner.phoneNumber, 'booking_reminder', garageTitle, garageBody, { screen: 'garage', bookingId: booking.id })

    await prisma.booking.update({ where: { id: booking.id }, data: { reminderSent: true } })
    console.log(`Booking reminder sent for booking ${booking.id}`)
  }
}

// Slots are stored as generic labels (Morning/Afternoon), not exact times —
// assume fixed anchor times so a "1 hour before" reminder has something to
// count down from. Approximate by design; garages don't collect exact times.
const SLOT_ANCHOR_HOURS: Record<string, number> = {
  Morning: 9,
  Afternoon: 14,
}

function slotDateTime(date: Date, slotLabel: string | null): Date {
  const hour = (slotLabel && SLOT_ANCHOR_HOURS[slotLabel] != null) ? SLOT_ANCHOR_HOURS[slotLabel] : 9
  const dt = new Date(date)
  dt.setHours(hour, 0, 0, 0)
  return dt
}

async function checkOneHourReminders() {
  const now = new Date()
  // Look at bookings within the next ~2 days; narrow down to the 1h window in code
  // (slot anchor times mean we can't filter this precisely at the DB query level).
  // windowStart is the start of today, not "now" — a same-day booking's stored
  // date is midnight, which is always earlier than the current time of day.
  const windowStart = new Date(now); windowStart.setHours(0, 0, 0, 0)
  const windowEnd   = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'confirmed',
      reminder1hSent: false,
      date: { gte: windowStart, lte: windowEnd },
    },
    include: {
      vehicle: { include: { owner: true } },
      garage: true,
    },
  })

  for (const booking of bookings) {
    const appointmentAt = slotDateTime(booking.date, booking.slotLabel)
    const minutesUntil = (appointmentAt.getTime() - now.getTime()) / 60000
    if (minutesUntil > 65 || minutesUntil < 45) continue // only fire in the ~1h window

    const owner = booking.vehicle.owner
    const slot = booking.slotLabel ? ` · ${booking.slotLabel}` : ''
    const vehicleLabel = `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.registrationNo})`
    const title = `Booking in about 1 hour — ${booking.garage.name}`
    const body  = `${vehicleLabel}${slot}`

    await sendPush(owner.pushToken, title, body, { screen: 'vehicles', vehicleId: booking.vehicleId })
    await createNotification(prisma, owner.phoneNumber, 'booking_reminder_1h', title, body, {
      screen: 'vehicles', vehicleId: booking.vehicleId,
    })

    await prisma.booking.update({ where: { id: booking.id }, data: { reminder1hSent: true } })
    console.log(`1-hour booking reminder sent for booking ${booking.id}`)
  }
}

export function startBookingReminderJob() {
  checkBookingReminders().catch(e => console.error('Booking reminder error:', e))
  setInterval(() => {
    checkBookingReminders().catch(e => console.error('Booking reminder error:', e))
  }, 60 * 60 * 1000)
  console.log('Booking reminder job started (runs hourly)')

  checkOneHourReminders().catch(e => console.error('1-hour booking reminder error:', e))
  setInterval(() => {
    checkOneHourReminders().catch(e => console.error('1-hour booking reminder error:', e))
  }, 15 * 60 * 1000)
  console.log('1-hour booking reminder job started (runs every 15 min)')
}
