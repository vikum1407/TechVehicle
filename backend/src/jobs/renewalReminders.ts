import { PrismaClient } from '@prisma/client'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

const prisma = new PrismaClient()

const DAYS_30 = 30 * 24 * 60 * 60 * 1000
const DAYS_3  =  3 * 24 * 60 * 60 * 1000

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

async function checkRenewals() {
  const now = new Date()
  const in30Days = new Date(now.getTime() + DAYS_30)

  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { emissionTestExpiry: { not: null, lte: in30Days } },
        { revenueLicenceExpiry: { not: null, lte: in30Days } },
        { insuranceExpiry: { not: null, lte: in30Days } },
      ],
    },
    include: { owner: true },
  })

  for (const vehicle of vehicles) {
    const { owner } = vehicle
    const ownerPrefs = parsePrefs(owner.notificationPrefs)
    if (!ownerPrefs.renewal && !ownerPrefs.insurance_reminder) continue
    const label = `${vehicle.make} ${vehicle.model} (${vehicle.registrationNo})`

    // ── Emission Test reminder ─────────────────────────────────────────
    if (ownerPrefs.renewal && vehicle.emissionTestExpiry && vehicle.emissionTestExpiry > now) {
      const lastSent = vehicle.lastEmissionReminderSent
      const needsSend = !lastSent || (now.getTime() - lastSent.getTime()) >= DAYS_3
      if (needsSend) {
        const days = daysUntil(vehicle.emissionTestExpiry)
        const title = days <= 7
          ? `Emission test due in ${days} day${days === 1 ? '' : 's'}!`
          : `Emission test due in ${days} days`
        const body = `${label} — renew your carbon / emission test before it expires.`

        await sendPush(owner.pushToken, title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await createNotification(prisma, owner.phoneNumber, 'emission_reminder', title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { lastEmissionReminderSent: now },
        })
      }
    }

    // ── Revenue Licence reminder ───────────────────────────────────────
    if (ownerPrefs.renewal && vehicle.revenueLicenceExpiry && vehicle.revenueLicenceExpiry > now) {
      const lastSent = vehicle.lastLicenceReminderSent
      const needsSend = !lastSent || (now.getTime() - lastSent.getTime()) >= DAYS_3
      if (needsSend) {
        const days = daysUntil(vehicle.revenueLicenceExpiry)
        const title = days <= 7
          ? `Revenue licence due in ${days} day${days === 1 ? '' : 's'}!`
          : `Revenue licence due in ${days} days`
        const body = `${label} — renew your revenue licence before it expires.`

        await sendPush(owner.pushToken, title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await createNotification(prisma, owner.phoneNumber, 'licence_reminder', title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { lastLicenceReminderSent: now },
        })
      }
    }

    // ── Insurance reminder ────────────────────────────────────────────
    if (ownerPrefs.insurance_reminder && vehicle.insuranceExpiry && vehicle.insuranceExpiry > now) {
      const lastSent = (vehicle as any).lastInsuranceReminderSent as Date | null
      const needsSend = !lastSent || (now.getTime() - lastSent.getTime()) >= DAYS_3
      if (needsSend) {
        const days = daysUntil(vehicle.insuranceExpiry)
        const title = days <= 7
          ? `Insurance due in ${days} day${days === 1 ? '' : 's'}!`
          : `Insurance due in ${days} days`
        const body = `${label} — renew your vehicle insurance before it expires.`

        await sendPush(owner.pushToken, title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await createNotification(prisma, owner.phoneNumber, 'insurance_reminder', title, body, { screen: 'vehicleDashboard', vehicleId: vehicle.id })
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { lastInsuranceReminderSent: now },
        })
      }
    }
  }
}

export function startRenewalReminderJob() {
  // Run once on startup, then every hour
  checkRenewals().catch(e => console.error('Renewal reminder error:', e))
  setInterval(() => {
    checkRenewals().catch(e => console.error('Renewal reminder error:', e))
  }, 60 * 60 * 1000)
  console.log('Renewal reminder job started (runs hourly)')
}
