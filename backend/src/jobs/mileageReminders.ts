import { PrismaClient } from '@prisma/client'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

const prisma = new PrismaClient()

const DAYS_7  = 7  * 24 * 60 * 60 * 1000
const HOURS_24 = 24 * 60 * 60 * 1000

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

async function checkMileageReminders() {
  const since7Days = new Date(Date.now() - DAYS_7)

  const users = await prisma.user.findMany({
    where: { pushToken: { not: null } },
  })

  for (const user of users) {
    if (!parsePrefs(user.notificationPrefs).mileage_reminder) continue
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerPhone: user.phoneNumber },
    })
    if (vehicles.length === 0) continue

    // Find vehicles with no mileage activity in the last 7 days
    const staleVehicles: typeof vehicles = []

    for (const vehicle of vehicles) {
      const [recentFuel, recentService] = await Promise.all([
        prisma.fuelLog.findFirst({
          where: { vehicleId: vehicle.id, createdAt: { gte: since7Days } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.serviceRecord.findFirst({
          where: { vehicleId: vehicle.id, mileage: { not: null }, createdAt: { gte: since7Days } },
          orderBy: { createdAt: 'desc' },
        }),
      ])
      if (!recentFuel && !recentService) {
        staleVehicles.push(vehicle)
      }
    }

    if (staleVehicles.length === 0) continue

    // Skip if already sent a mileage reminder for this user in the last 7 days
    const recentReminder = await prisma.appNotification.findFirst({
      where: {
        userPhone: user.phoneNumber,
        type: 'mileage_reminder',
        createdAt: { gte: since7Days },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (recentReminder) continue

    const count = staleVehicles.length
    const title = count === 1
      ? `Update mileage — ${staleVehicles[0].make} ${staleVehicles[0].model}`
      : `Update mileage — ${count} vehicles need updating`
    const body = count === 1
      ? `No mileage logged in 7 days for ${staleVehicles[0].registrationNo}. Log a fuel fill-up to keep predictions accurate.`
      : `${staleVehicles.map(v => v.registrationNo).join(', ')} — log a fuel fill-up to keep predictions accurate.`

    const data = { screen: 'vehicles' }
    await sendPush(user.pushToken, title, body, data)
    await createNotification(prisma, user.phoneNumber, 'mileage_reminder', title, body, data)
  }
}

export function startMileageReminderJob() {
  // Delay 15s on startup to let other jobs settle, then run daily
  setTimeout(() => {
    checkMileageReminders().catch(e => console.error('Mileage reminder error:', e))
  }, 15000)

  setInterval(() => {
    checkMileageReminders().catch(e => console.error('Mileage reminder error:', e))
  }, HOURS_24)

  console.log('Mileage reminder job started (runs daily)')
}
