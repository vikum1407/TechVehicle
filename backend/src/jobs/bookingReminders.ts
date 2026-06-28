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

export function startBookingReminderJob() {
  checkBookingReminders().catch(e => console.error('Booking reminder error:', e))
  setInterval(() => {
    checkBookingReminders().catch(e => console.error('Booking reminder error:', e))
  }, 60 * 60 * 1000)
  console.log('Booking reminder job started (runs hourly)')
}
