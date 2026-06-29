import { PrismaClient } from '@prisma/client'
import { computePredictions } from '../utils/predictionEngine'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

const prisma = new PrismaClient()

const HOURS_24  = 24 * 60 * 60 * 1000
const DAYS_7    = 7  * HOURS_24

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

async function checkSetupReminders() {
  const users = await prisma.user.findMany({
    where: { pushToken: { not: null } },
  })

  for (const user of users) {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerPhone: user.phoneNumber },
    })

    for (const vehicle of vehicles) {
      if (!parsePrefs(user.notificationPrefs).service_due) continue

      const records = await prisma.serviceRecord.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'desc' },
      })
      const predictions = computePredictions(vehicle, records)
      const noDataCount = predictions.filter(p => p.status === 'no_data').length

      // Only nudge if there are 3+ unconfigured predictions
      if (noDataCount < 3) continue

      // Skip if already sent a setup reminder for this vehicle in the last 7 days
      const recent = await prisma.appNotification.findFirst({
        where: {
          userPhone: user.phoneNumber,
          type: 'setup_reminder',
          createdAt: { gte: new Date(Date.now() - DAYS_7) },
          linkTo: { contains: vehicle.id },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (recent) continue

      const vehicleName = `${vehicle.make} ${vehicle.model} (${vehicle.registrationNo})`
      const title = `Set up predictions — ${vehicleName}`
      const body  = `${noDataCount} service items have no history yet. Add when they were last done to start getting predictions.`
      const data  = { screen: 'predictions_setup', vehicleId: vehicle.id }

      await sendPush(user.pushToken, title, body, data)
      await createNotification(prisma, user.phoneNumber, 'setup_reminder', title, body, data)
    }
  }
}

async function checkServicesDue() {
  const users = await prisma.user.findMany({
    where: { pushToken: { not: null } },
  })

  for (const user of users) {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerPhone: user.phoneNumber },
    })

    for (const vehicle of vehicles) {
      if (!parsePrefs(user.notificationPrefs).service_due) continue

      // Skip if we already sent a service notification for this vehicle in the last 24h
      const recentNotif = await prisma.appNotification.findFirst({
        where: {
          userPhone: user.phoneNumber,
          type: 'service_reminder',
          createdAt: { gte: new Date(Date.now() - HOURS_24) },
          linkTo: { contains: vehicle.id },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (recentNotif) continue

      const records = await prisma.serviceRecord.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'desc' },
      })

      const predictions = computePredictions(vehicle, records)
      const overdue  = predictions.filter(p => p.status === 'overdue')
      const dueSoon  = predictions.filter(p => p.status === 'due_soon')

      if (overdue.length === 0 && dueSoon.length === 0) continue

      const vehicleName = `${vehicle.make} ${vehicle.model} (${vehicle.registrationNo})`
      const linkTo = JSON.stringify({ screen: 'VehicleDashboard', vehicleId: vehicle.id })

      if (overdue.length > 0) {
        const names = overdue.map(p => p.name).join(', ')
        const title = `Service overdue — ${vehicleName}`
        const body = overdue.length === 1
          ? `${names} is overdue. Schedule a service soon.`
          : `${overdue.length} services overdue: ${names}`

        await sendPush(user.pushToken, title, body, { screen: 'VehicleDashboard', vehicleId: vehicle.id })
        await createNotification(prisma, user.phoneNumber, 'service_reminder', title, body, { screen: 'VehicleDashboard', vehicleId: vehicle.id })
      } else {
        const top = dueSoon[0]
        const kmText   = top.remainingKm   != null ? `${top.remainingKm.toLocaleString()} km` : ''
        const daysText = top.remainingDays != null ? `${top.remainingDays} days` : ''
        const timeLeft = [kmText, daysText].filter(Boolean).join(' / ')
        const title = `Service due soon — ${vehicleName}`
        const body  = `${top.name} due in ${timeLeft}`

        await sendPush(user.pushToken, title, body, { screen: 'VehicleDashboard', vehicleId: vehicle.id })
        await createNotification(prisma, user.phoneNumber, 'service_reminder', title, body, { screen: 'VehicleDashboard', vehicleId: vehicle.id })
      }
    }
  }
}

export function startServiceNotificationJob() {
  // Run once at startup (after a 10s delay to let DB settle), then every 24 hours
  setTimeout(() => {
    checkServicesDue().catch(e => console.error('Service notification error:', e))
    checkSetupReminders().catch(e => console.error('Setup reminder error:', e))
  }, 10000)

  setInterval(() => {
    checkServicesDue().catch(e => console.error('Service notification error:', e))
    checkSetupReminders().catch(e => console.error('Setup reminder error:', e))
  }, HOURS_24)

  console.log('Service notification job started (runs daily)')
}
