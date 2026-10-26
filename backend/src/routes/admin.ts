import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { requireAdmin, getAdminPhones } from '../middleware/admin'
import { DELETED_ACCOUNT_SENTINEL_PHONE } from '../utils/accountDeletion'
import { SRI_LANKA_CITIES } from '../data/cities'
import { VEHICLE_TEST_DESCRIPTIONS } from '../data/vehicleTests'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)
router.use(requireAdmin)

// ── 5-minute in-memory response cache (per section 7's general rules) ──────────────
const CACHE_TTL_MS = 5 * 60 * 1000
const responseCache = new Map<string, { data: unknown; expiresAt: number }>()
async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = responseCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data as T
  const data = await compute()
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}
// Test-only: lets admin.test.ts assert against freshly-computed data instead of a
// 5-minute-stale cached response from an earlier test in the same run. Never called
// from production code.
export function __clearAdminCacheForTests() {
  responseCache.clear()
}

// ── Shared "exclude admin + deleted" filters (section 7's general rules) ───────────
function excludedPhones(): string[] {
  return [...getAdminPhones(), DELETED_ACCOUNT_SENTINEL_PHONE]
}
// Users that count toward anything except the "pending deletion" number itself.
function activeUserWhere() {
  return { phoneNumber: { notIn: excludedPhones() }, pendingDeletionAt: null }
}
// Vehicles/garages owned by a still-active, non-admin, non-deleted account.
function activeVehicleWhere() {
  return { ownerPhone: { notIn: excludedPhones() }, owner: { pendingDeletionAt: null } }
}
function activeGarageWhere() {
  return { ownerPhone: { notIn: excludedPhones() }, owner: { pendingDeletionAt: null } }
}
async function excludedUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { phoneNumber: { in: getAdminPhones() } }, select: { id: true } })
  return admins.map(u => u.id)
}

// ── Asia/Colombo date helpers (fixed +5:30, no DST — no library needed) ────────────
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000
function colomboDayKey(d: Date): string {
  return new Date(d.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10)
}
// UTC instant corresponding to the start of a given Colombo calendar day.
function colomboDayStartUTC(dayKey: string): Date {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() - COLOMBO_OFFSET_MS)
}
function daysAgoColombo(n: number): string {
  return colomboDayKey(new Date(Date.now() - n * 24 * 60 * 60 * 1000))
}

// GET /admin/overview
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const data = await cached('overview', async () => {
      const todayKey = colomboDayKey(new Date())
      const todayStart = colomboDayStartUTC(todayKey)
      const start7d = colomboDayStartUTC(daysAgoColombo(7))
      const start30d = colomboDayStartUTC(daysAgoColombo(30))
      const excludedIds = await excludedUserIds()

      const [
        owners, garages, noRole, pendingDeletion,
        signupsToday, signups7d, signups30d,
        dauRows, mauRows,
        errors24h, lastBackup,
      ] = await Promise.all([
        prisma.user.count({ where: { ...activeUserWhere(), userType: 'owner' } }),
        prisma.garage.count({ where: activeGarageWhere() }),
        prisma.user.count({ where: { ...activeUserWhere(), userType: null } }),
        prisma.user.count({ where: { phoneNumber: { notIn: getAdminPhones() }, pendingDeletionAt: { not: null } } }),
        prisma.user.count({ where: { ...activeUserWhere(), createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { ...activeUserWhere(), createdAt: { gte: start7d } } }),
        prisma.user.count({ where: { ...activeUserWhere(), createdAt: { gte: start30d } } }),
        prisma.userActiveDay.findMany({ where: { day: todayKey, userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }),
        prisma.userActiveDay.findMany({ where: { day: { gte: daysAgoColombo(30) }, userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }),
        prisma.apiErrorLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        prisma.backupRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      ])

      return {
        owners, garages, noRole, pendingDeletion,
        signups: { today: signupsToday, last7d: signups7d, last30d: signups30d },
        dau: dauRows.length,
        mau: mauRows.length,
        errorsLast24h: errors24h,
        lastBackup: lastBackup ? {
          status: lastBackup.status, sizeBytes: lastBackup.sizeBytes, createdAt: lastBackup.createdAt,
        } : null,
      }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/overview error:', error)
    res.status(500).json({ error: 'Failed to load overview' })
  }
})

function titleCase(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}
const listedCityLower = new Set(SRI_LANKA_CITIES.map(c => c.toLowerCase()))
function matchListedCity(raw: string): string | null {
  const t = raw.trim()
  if (!listedCityLower.has(t.toLowerCase())) return null
  return SRI_LANKA_CITIES.find(c => c.toLowerCase() === t.toLowerCase())!
}

// GET /admin/cities?type=owner|garage — M1/M2
router.get('/cities', async (req: AuthRequest, res) => {
  const type = req.query.type === 'garage' ? 'garage' : 'owner'
  try {
    const data = await cached(`cities:${type}`, async () => {
      // One raw city string per active user of this type (D1: garage city falls
      // back to Garage.town when the owner's own User.city is empty).
      let rawCities: (string | null)[]
      let total: number
      if (type === 'owner') {
        const owners = await prisma.user.findMany({ where: { ...activeUserWhere(), userType: 'owner' }, select: { city: true } })
        rawCities = owners.map(o => o.city)
        total = owners.length
      } else {
        const garages = await prisma.garage.findMany({ where: activeGarageWhere(), select: { town: true, owner: { select: { city: true } } } })
        rawCities = garages.map(g => (g.owner.city?.trim() ? g.owner.city : g.town))
        total = garages.length
      }

      const listedCounts = new Map<string, number>(SRI_LANKA_CITIES.map(c => [c, 0]))
      const otherCounts = new Map<string, number>()
      let notSet = 0
      for (const raw of rawCities) {
        if (!raw || !raw.trim()) { notSet++; continue }
        const listed = matchListedCity(raw)
        if (listed) { listedCounts.set(listed, (listedCounts.get(listed) ?? 0) + 1); continue }
        const norm = titleCase(raw)
        otherCounts.set(norm, (otherCounts.get(norm) ?? 0) + 1)
      }

      const listed = SRI_LANKA_CITIES.map(city => ({ city, count: listedCounts.get(city) ?? 0 }))
      const otherTyped = Array.from(otherCounts.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)

      return {
        listed, otherTyped, notSet, total,
        pctSet: total > 0 ? Math.round(((total - notSet) / total) * 1000) / 10 : 0,
      }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/cities error:', error)
    res.status(500).json({ error: 'Failed to load city breakdown' })
  }
})

import { Prisma } from '@prisma/client'

// ── M3 helpers: distinct-owner-count through a relation (Prisma's own `distinct`
// can't express DISTINCT on a JOINed column, hence $queryRaw here per the spec). ──────
async function distinctCountViaVehicle(table: string, dateCol: string, opts: { extraWhere?: Prisma.Sql; since?: Date } = {}): Promise<number> {
  const excluded = excludedPhones()
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT v."ownerPhone") as count
    FROM ${Prisma.raw(`"${table}"`)} t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    JOIN "User" u ON v."ownerPhone" = u."phoneNumber"
    WHERE v."ownerPhone" NOT IN (${Prisma.join(excluded.length ? excluded : [''])})
      AND u."pendingDeletionAt" IS NULL
      ${opts.extraWhere ? Prisma.sql`AND ${opts.extraWhere}` : Prisma.empty}
      ${opts.since ? Prisma.sql`AND t.${Prisma.raw(`"${dateCol}"`)} >= ${opts.since}` : Prisma.empty}
  `)
  return Number(rows[0]?.count ?? 0)
}
async function distinctCountViaGarage(table: string, dateCol: string, since?: Date): Promise<number> {
  const excluded = excludedPhones()
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT g."ownerPhone") as count
    FROM ${Prisma.raw(`"${table}"`)} t
    JOIN "Garage" g ON t."garageId" = g.id
    JOIN "User" u ON g."ownerPhone" = u."phoneNumber"
    WHERE g."ownerPhone" NOT IN (${Prisma.join(excluded.length ? excluded : [''])})
      AND u."pendingDeletionAt" IS NULL
      ${since ? Prisma.sql`AND t.${Prisma.raw(`"${dateCol}"`)} >= ${since}` : Prisma.empty}
  `)
  return Number(rows[0]?.count ?? 0)
}
// Direct-field case (the model already has ownerPhone/sellerPhone on it, no join needed).
async function distinctCountDirect<T extends { findMany: (args: any) => Promise<any[]> }>(
  model: T, phoneField: string, where: Record<string, unknown>, since?: Date
): Promise<number> {
  const rows = await model.findMany({
    where: { ...where, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { [phoneField]: true },
    distinct: [phoneField],
  })
  return rows.length
}

// GET /admin/features — M3
router.get('/features', async (req: AuthRequest, res) => {
  try {
    const data = await cached('features', async () => {
      const since30d = colomboDayStartUTC(daysAgoColombo(30))
      const [ownerTotal, garageTotal] = await Promise.all([
        prisma.user.count({ where: { ...activeUserWhere(), userType: 'owner' } }),
        prisma.garage.count({ where: activeGarageWhere() }),
      ])
      const testDescExpr = Prisma.sql`t.description IN (${Prisma.join(VEHICLE_TEST_DESCRIPTIONS)})`
      const notTestDescExpr = Prisma.sql`t.description NOT IN (${Prisma.join(VEHICLE_TEST_DESCRIPTIONS)})`

      const rows: { key: string; label: string; side: 'owner' | 'garage'; everUsed: number; active30d: number | null }[] = []

      const [
        vehiclesAdded, vehiclesAdded30,
        fuelLogs, fuelLogs30,
        serviceRecords, serviceRecords30,
        vehicleTests, vehicleTests30,
        expenses, expenses30,
        shareSessions, shareSessions30,
        vehicleShares, vehicleShares30,
        transfers,
        bookingsMade, bookingsMade30,
        ratingsGiven, ratingsGiven30,
        bookingsReceived, bookingsReceived30,
        serviceSubmissions, serviceSubmissions30,
        reminders, reminders30,
        priceListCount,
        availabilityCount,
      ] = await Promise.all([
        prisma.vehicle.findMany({ where: activeVehicleWhere(), select: { ownerPhone: true }, distinct: ['ownerPhone'] }).then(r => r.length),
        prisma.vehicle.findMany({ where: { ...activeVehicleWhere(), createdAt: { gte: since30d } }, select: { ownerPhone: true }, distinct: ['ownerPhone'] }).then(r => r.length),
        distinctCountViaVehicle('FuelLog', 'createdAt'),
        distinctCountViaVehicle('FuelLog', 'createdAt', { since: since30d }),
        distinctCountViaVehicle('ServiceRecord', 'createdAt', { extraWhere: notTestDescExpr }),
        distinctCountViaVehicle('ServiceRecord', 'createdAt', { extraWhere: notTestDescExpr, since: since30d }),
        distinctCountViaVehicle('ServiceRecord', 'createdAt', { extraWhere: testDescExpr }),
        distinctCountViaVehicle('ServiceRecord', 'createdAt', { extraWhere: testDescExpr, since: since30d }),
        distinctCountViaVehicle('Expense', 'createdAt'),
        distinctCountViaVehicle('Expense', 'createdAt', { since: since30d }),
        distinctCountDirect(prisma.shareSession, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }),
        distinctCountDirect(prisma.shareSession, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }, since30d),
        distinctCountDirect(prisma.vehicleShare, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }),
        distinctCountDirect(prisma.vehicleShare, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }, since30d),
        distinctCountDirect(prisma.vehicleTransfer, 'sellerPhone', { sellerPhone: { notIn: excludedPhones() }, status: 'accepted' }),
        distinctCountDirect(prisma.booking, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }),
        distinctCountDirect(prisma.booking, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }, since30d),
        distinctCountDirect(prisma.garageRating, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }),
        distinctCountDirect(prisma.garageRating, 'ownerPhone', { ownerPhone: { notIn: excludedPhones() } }, since30d),
        distinctCountViaGarage('Booking', 'createdAt'),
        distinctCountViaGarage('Booking', 'createdAt', since30d),
        distinctCountViaGarage('ServiceSubmission', 'createdAt'),
        distinctCountViaGarage('ServiceSubmission', 'createdAt', since30d),
        distinctCountViaGarage('GarageReminder', 'sentAt'),
        distinctCountViaGarage('GarageReminder', 'sentAt', since30d),
        prisma.garage.count({ where: { ...activeGarageWhere(), priceList: { not: Prisma.JsonNull } } }),
        prisma.garageAvailability.count({ where: { garage: activeGarageWhere() } }),
      ])

      const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0

      const push = (key: string, label: string, side: 'owner' | 'garage', everUsed: number, active30d: number | null) => {
        rows.push({ key, label, side, everUsed, active30d })
      }
      push('vehicles_added', 'Vehicles added', 'owner', vehiclesAdded, vehiclesAdded30)
      push('fuel_logs', 'Fuel logs', 'owner', fuelLogs, fuelLogs30)
      push('service_records', 'Service records', 'owner', serviceRecords, serviceRecords30)
      push('vehicle_tests', 'Vehicle tests', 'owner', vehicleTests, vehicleTests30)
      push('expenses', 'Expenses', 'owner', expenses, expenses30)
      push('shared_records', 'Shared records with a garage', 'owner', shareSessions, shareSessions30)
      push('family_sharing', 'Family vehicle sharing', 'owner', vehicleShares, vehicleShares30)
      push('transfers_completed', 'Ownership transfer completed', 'owner', transfers, null)
      push('bookings_made', 'Bookings made', 'owner', bookingsMade, bookingsMade30)
      push('ratings_given', 'Ratings given', 'owner', ratingsGiven, ratingsGiven30)
      push('bookings_received', 'Bookings received', 'garage', bookingsReceived, bookingsReceived30)
      push('service_submissions', 'Service submissions (customer ledger)', 'garage', serviceSubmissions, serviceSubmissions30)
      push('reminders_sent', 'Customer reminders sent', 'garage', reminders, reminders30)
      push('price_list', 'Price list set up', 'garage', priceListCount, null)
      push('availability', 'Availability set up', 'garage', availabilityCount, null)

      return rows.map(r => ({ ...r, pctOfSide: pct(r.everUsed, r.side === 'owner' ? ownerTotal : garageTotal) }))
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/features error:', error)
    res.status(500).json({ error: 'Failed to load feature usage' })
  }
})

// Runs at most once per Colombo day, triggered by the first /admin/health call of
// that day (per section 5.3) - tracked per-process, same "lost on restart is fine"
// reasoning as authMiddleware's activity cache.
let lastErrorLogCleanupDay: string | null = null
async function maybeCleanupOldErrorLogs() {
  const today = colomboDayKey(new Date())
  if (lastErrorLogCleanupDay === today) return
  lastErrorLogCleanupDay = today
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  try {
    await prisma.apiErrorLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  } catch (e) {
    console.error('ApiErrorLog cleanup failed (non-fatal):', e)
  }
}

// GET /admin/health — M9
router.get('/health', async (req: AuthRequest, res) => {
  try {
    await maybeCleanupOldErrorLogs()
    const data = await cached('health', async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const since30d = colomboDayStartUTC(daysAgoColombo(30))
      const excludedIds = await excludedUserIds()

      const [errors24h, errors7d, topRoutesRaw, activeUserIds, lastBackup] = await Promise.all([
        prisma.apiErrorLog.count({ where: { createdAt: { gte: since24h } } }),
        prisma.apiErrorLog.count({ where: { createdAt: { gte: since7d } } }),
        prisma.apiErrorLog.groupBy({
          by: ['route'], where: { createdAt: { gte: since7d } },
          _count: { route: true }, orderBy: { _count: { route: 'desc' } }, take: 5,
        }),
        prisma.userActiveDay.findMany({ where: { day: { gte: daysAgoColombo(30) }, userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }),
        prisma.backupRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      ])

      const activeUsers = activeUserIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: activeUserIds.map(r => r.userId) } }, select: { lastAppVersion: true, lastPlatform: true } })
        : []
      const versionCounts = new Map<string, number>()
      for (const u of activeUsers) {
        const key = `${u.lastAppVersion ?? 'unknown'} / ${u.lastPlatform ?? 'unknown'}`
        versionCounts.set(key, (versionCounts.get(key) ?? 0) + 1)
      }
      const versions = Array.from(versionCounts.entries())
        .map(([versionPlatform, count]) => ({ versionPlatform, count }))
        .sort((a, b) => b.count - a.count)

      const backup = lastBackup ? {
        status: lastBackup.status,
        sizeBytes: lastBackup.sizeBytes,
        createdAt: lastBackup.createdAt,
        stale: lastBackup.status === 'failed' || (Date.now() - lastBackup.createdAt.getTime()) > 48 * 60 * 60 * 1000,
      } : { status: null, sizeBytes: null, createdAt: null, stale: true, note: 'No backup recorded yet' }

      return {
        errors: { last24h: errors24h, last7d: errors7d, topRoutes: topRoutesRaw.map(r => ({ route: r.route, count: r._count.route })) },
        versions,
        backup,
      }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/health error:', error)
    res.status(500).json({ error: 'Failed to load health' })
  }
})

// GET /admin/growth — M5 (last 30 days), M6, M8
router.get('/growth', async (req: AuthRequest, res) => {
  try {
    const data = await cached('growth', async () => {
      const excludedIds = await excludedUserIds()
      const start30d = colomboDayStartUTC(daysAgoColombo(30))

      // ── M5: signups per day, last 30 days ──────────────────────────────────────
      const recentUsers = await prisma.user.findMany({
        where: { ...activeUserWhere(), createdAt: { gte: start30d } },
        select: { phoneNumber: true, createdAt: true, userType: true, referredByCode: true, garage: { select: { id: true } } },
      })
      const dayBuckets = new Map<string, { owner: number; garage: number; noRole: number; withCode: number; withoutCode: number }>()
      for (let i = 29; i >= 0; i--) {
        dayBuckets.set(daysAgoColombo(i), { owner: 0, garage: 0, noRole: 0, withCode: 0, withoutCode: 0 })
      }
      for (const u of recentUsers) {
        const key = colomboDayKey(u.createdAt)
        const bucket = dayBuckets.get(key)
        if (!bucket) continue
        if (u.userType === 'owner') bucket.owner++
        if (u.garage) bucket.garage++
        if (!u.userType) bucket.noRole++
        if (u.referredByCode) bucket.withCode++
        else bucket.withoutCode++
      }
      const signupsPerDay = Array.from(dayBuckets.entries()).map(([day, counts]) => ({ day, ...counts }))

      // ── M6: activation rate - cohort created 37 to 7 days ago ──────────────────
      const cohortStart = colomboDayStartUTC(daysAgoColombo(37))
      const cohortEnd = colomboDayStartUTC(daysAgoColombo(7))
      const cohort = await prisma.user.findMany({
        where: { ...activeUserWhere(), createdAt: { gte: cohortStart, lt: cohortEnd } },
        select: { phoneNumber: true, createdAt: true },
      })
      let activated = 0
      if (cohort.length > 0) {
        const phones = cohort.map(c => c.phoneNumber)
        const [firstVehicles, firstGarages] = await Promise.all([
          prisma.vehicle.groupBy({ by: ['ownerPhone'], where: { ownerPhone: { in: phones } }, _min: { createdAt: true } }),
          prisma.garage.findMany({ where: { ownerPhone: { in: phones } }, select: { ownerPhone: true, createdAt: true } }),
        ])
        const firstVehicleByPhone = new Map(firstVehicles.map(v => [v.ownerPhone, v._min.createdAt!]))
        const firstGarageByPhone = new Map(firstGarages.map(g => [g.ownerPhone, g.createdAt]))
        for (const u of cohort) {
          const deadline = new Date(u.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
          const firstVehicle = firstVehicleByPhone.get(u.phoneNumber)
          const firstGarage = firstGarageByPhone.get(u.phoneNumber)
          if ((firstVehicle && firstVehicle <= deadline) || (firstGarage && firstGarage <= deadline)) activated++
        }
      }
      const activationPct = cohort.length > 0 ? Math.round((activated / cohort.length) * 1000) / 10 : null

      // ── M8: active users ────────────────────────────────────────────────────────
      const todayKey = colomboDayKey(new Date())
      const [dauRows, mauRows, last7dRows, earliestActivity] = await Promise.all([
        prisma.userActiveDay.findMany({ where: { day: todayKey, userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }),
        prisma.userActiveDay.findMany({ where: { day: { gte: daysAgoColombo(30) }, userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }),
        Promise.all(Array.from({ length: 7 }, (_, i) =>
          prisma.userActiveDay.findMany({ where: { day: daysAgoColombo(i), userId: { notIn: excludedIds } }, distinct: ['userId'], select: { userId: true } }).then(r => r.length)
        )),
        prisma.userActiveDay.findFirst({ orderBy: { day: 'asc' }, select: { day: true } }),
      ])
      const dau = dauRows.length
      const mau = mauRows.length
      const avgDau7d = Math.round((last7dRows.reduce((s, n) => s + n, 0) / 7) * 10) / 10

      return {
        signupsPerDay,
        activation: { cohortSize: cohort.length, activated, pct: activationPct },
        activeUsers: {
          dau, mau, avgDau7d,
          dauMauPct: mau > 0 ? Math.round((dau / mau) * 1000) / 10 : null,
          trackingSince: earliestActivity?.day ?? null,
        },
      }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/growth error:', error)
    res.status(500).json({ error: 'Failed to load growth metrics' })
  }
})

// Monday-start Colombo week containing d, as a day key.
function colomboWeekStartKey(d: Date): string {
  const colombo = new Date(d.getTime() + COLOMBO_OFFSET_MS)
  const dow = colombo.getUTCDay() // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(colombo.getTime() + diff * 24 * 60 * 60 * 1000)
  return monday.toISOString().slice(0, 10)
}
function addWeeksToKey(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

// GET /admin/retention — M7 (last 12 signup weeks)
router.get('/retention', async (req: AuthRequest, res) => {
  try {
    const data = await cached('retention', async () => {
      const excludedIds = await excludedUserIds()
      const currentWeekStart = colomboWeekStartKey(new Date())
      const weekStarts = Array.from({ length: 12 }, (_, i) => addWeeksToKey(currentWeekStart, -(11 - i)))

      const rows = await Promise.all(weekStarts.map(async weekStart => {
        const weekStartUTC = colomboDayStartUTC(weekStart)
        const weekEndUTC = colomboDayStartUTC(addWeeksToKey(weekStart, 1))
        const cohort = await prisma.user.findMany({
          where: { ...activeUserWhere(), createdAt: { gte: weekStartUTC, lt: weekEndUTC } },
          select: { id: true },
        })
        const cohortIds = cohort.map(u => u.id).filter(id => !excludedIds.includes(id))
        const users = cohortIds.length

        const horizon = async (n: number): Promise<number | null> => {
          const targetStart = addWeeksToKey(weekStart, n)
          const targetStartUTC = colomboDayStartUTC(targetStart)
          if (targetStartUTC > new Date() || users === 0) return null
          const targetEnd = addWeeksToKey(weekStart, n + 1)
          const retained = await prisma.userActiveDay.findMany({
            where: { userId: { in: cohortIds }, day: { gte: targetStart, lt: targetEnd } },
            distinct: ['userId'], select: { userId: true },
          })
          return Math.round((retained.length / users) * 1000) / 10
        }

        const [w1, w4, w12] = await Promise.all([horizon(1), horizon(4), horizon(12)])
        return { weekStart, users, retainedPct: { week1: w1, week4: w4, week12: w12 } }
      }))

      const earliestActivity = await prisma.userActiveDay.findFirst({ orderBy: { day: 'asc' }, select: { day: true } })
      return { weeks: rows, trackingSince: earliestActivity?.day ?? null }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/retention error:', error)
    res.status(500).json({ error: 'Failed to load retention' })
  }
})

// ── M4: promo code signups ──────────────────────────────────────────────────────────
type ReferredUserStatus = {
  phoneNumber: string
  signedUpAt: Date
  status: 'waiting' | 'real' | 'not_real'
  reason: string | null
  sameVehicleReg: string | null
  referredByCode: string
}

function normalizeRegNo(reg: string): string {
  return reg.toUpperCase().replace(/[\s-]/g, '')
}

// Shared by both /admin/promo-codes and /admin/promo-codes/:code - computes every
// referred user's Real/Not Real/Waiting status plus the same-vehicle duplicate check,
// once, for all codes at once (cheaper than per-code queries, and the "exists on
// another account" half of the same-vehicle check genuinely needs the full picture).
async function computeReferredUserStatuses(): Promise<{
  byUser: ReferredUserStatus[]
  codeOwnerPhoneByCode: Map<string, string>
}> {
  const excluded = excludedPhones()

  const [referred, codeOwners, vehicles] = await Promise.all([
    prisma.user.findMany({
      where: { ...activeUserWhere(), referredByCode: { not: null } },
      select: { phoneNumber: true, createdAt: true, referredByCode: true, garage: { select: { id: true } } },
    }),
    prisma.user.findMany({
      where: { ...activeUserWhere(), promoCode: { not: null } },
      select: { phoneNumber: true, promoCode: true },
    }),
    prisma.vehicle.findMany({ where: activeVehicleWhere(), select: { registrationNo: true, ownerPhone: true } }),
  ])
  const codeOwnerPhoneByCode = new Map(codeOwners.map(u => [u.promoCode!, u.phoneNumber]))

  if (referred.length === 0) return { byUser: [], codeOwnerPhoneByCode }

  const referredPhones = referred.map(u => u.phoneNumber)
  const garageIds = referred.map(u => u.garage?.id).filter((id): id is string => !!id)

  const [vehiclesByPhone, serviceRecords, fuelLogs, expenses, bookingsByGarage, submissionsByGarage, referredUsersFull] = await Promise.all([
    prisma.vehicle.findMany({ where: { ownerPhone: { in: referredPhones } }, select: { id: true, ownerPhone: true, createdAt: true, registrationNo: true } }),
    prisma.serviceRecord.findMany({ where: { vehicle: { ownerPhone: { in: referredPhones } } }, select: { vehicleId: true, createdAt: true } }),
    prisma.fuelLog.findMany({ where: { vehicle: { ownerPhone: { in: referredPhones } } }, select: { vehicleId: true, createdAt: true } }),
    prisma.expense.findMany({ where: { vehicle: { ownerPhone: { in: referredPhones } } }, select: { vehicleId: true, createdAt: true } }),
    garageIds.length > 0 ? prisma.booking.findMany({ where: { garageId: { in: garageIds } }, select: { garageId: true, createdAt: true } }) : Promise.resolve([]),
    garageIds.length > 0 ? prisma.serviceSubmission.findMany({ where: { garageId: { in: garageIds } }, select: { garageId: true, createdAt: true } }) : Promise.resolve([]),
    // Need User.id (not just phoneNumber) to query UserActiveDay.
    prisma.user.findMany({ where: { phoneNumber: { in: referredPhones } }, select: { id: true, phoneNumber: true } }),
  ])
  const userIdByPhone = new Map(referredUsersFull.map(u => [u.phoneNumber, u.id]))
  const activeDaysRows = await prisma.userActiveDay.findMany({ where: { userId: { in: Array.from(userIdByPhone.values()) } }, select: { userId: true, day: true } })
  const activeDaysByUserId = new Map<string, string[]>()
  for (const row of activeDaysRows) {
    if (!activeDaysByUserId.has(row.userId)) activeDaysByUserId.set(row.userId, [])
    activeDaysByUserId.get(row.userId)!.push(row.day)
  }

  const vehiclesByOwner = new Map<string, { id: string; createdAt: Date; registrationNo: string }[]>()
  for (const v of vehiclesByPhone) {
    if (!vehiclesByOwner.has(v.ownerPhone)) vehiclesByOwner.set(v.ownerPhone, [])
    vehiclesByOwner.get(v.ownerPhone)!.push({ id: v.id, createdAt: v.createdAt, registrationNo: v.registrationNo })
  }
  const recordsByVehicleId = new Map<string, Date[]>()
  for (const r of [...serviceRecords, ...fuelLogs, ...expenses]) {
    if (!recordsByVehicleId.has(r.vehicleId)) recordsByVehicleId.set(r.vehicleId, [])
    recordsByVehicleId.get(r.vehicleId)!.push(r.createdAt)
  }
  const garageActivityByGarageId = new Map<string, Date[]>()
  for (const r of [...bookingsByGarage, ...submissionsByGarage]) {
    if (!garageActivityByGarageId.has(r.garageId!)) garageActivityByGarageId.set(r.garageId!, [])
    garageActivityByGarageId.get(r.garageId!)!.push(r.createdAt)
  }

  // Global normalized-registration index, for "same vehicle" (section 7.3) - across
  // EVERY active vehicle in the system, not just this code's own referred users, per
  // "or a referred user's registration number also exists on another account".
  const regIndex = new Map<string, Set<string>>() // normalized reg -> set of ownerPhones
  for (const v of vehicles) {
    if (v.registrationNo.startsWith('DELETED-')) continue
    const norm = normalizeRegNo(v.registrationNo)
    if (!regIndex.has(norm)) regIndex.set(norm, new Set())
    regIndex.get(norm)!.add(v.ownerPhone)
  }

  const now = Date.now()
  const byUser: ReferredUserStatus[] = referred.map(u => {
    const daysAgo = (now - u.createdAt.getTime()) / 86400000
    const deadline = new Date(u.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    const ownVehicles = vehiclesByOwner.get(u.phoneNumber) ?? []
    const hasVehicle = ownVehicles.length > 0
    const hasRecord = ownVehicles.some(v => (recordsByVehicleId.get(v.id) ?? []).length > 0)
    const hasGarage = !!u.garage
    const garageUsedApp = hasGarage && (garageActivityByGarageId.get(u.garage!.id) ?? []).length > 0
    const usedApp = hasRecord || garageUsedApp

    const userId = userIdByPhone.get(u.phoneNumber)
    const activeDayKeys = userId ? (activeDaysByUserId.get(userId) ?? []) : []
    const deadlineKey = colomboDayKey(deadline)
    const cameBackViaActiveDay = activeDayKeys.some(d => d >= deadlineKey)
    const cameBackViaRecord =
      ownVehicles.some(v => v.createdAt >= deadline) ||
      ownVehicles.some(v => (recordsByVehicleId.get(v.id) ?? []).some(d => d >= deadline)) ||
      (hasGarage && (garageActivityByGarageId.get(u.garage!.id) ?? []).some(d => d >= deadline))
    const cameBack = cameBackViaActiveDay || cameBackViaRecord

    // "Same vehicle" note is filled in below, after this map, once registrationNo
    // values are available (informational only - doesn't change real/not-real).
    const sameVehicleReg: string | null = null

    let status: 'waiting' | 'real' | 'not_real'
    let reason: string | null = null
    if (daysAgo < 7) {
      status = 'waiting'
    } else if (!usedApp) {
      status = 'not_real'
      reason = (!hasVehicle && !hasGarage) ? 'No vehicle' : 'No records'
    } else if (!cameBack) {
      status = 'not_real'
      reason = 'Never came back'
    } else {
      status = 'real'
    }

    return { phoneNumber: u.phoneNumber, signedUpAt: u.createdAt, status, reason, sameVehicleReg, referredByCode: u.referredByCode! }
  })

  // Fill in sameVehicleReg now that we have the full picture.
  for (const u of byUser) {
    const regs = (vehiclesByOwner.get(u.phoneNumber) ?? []).map(v => v.registrationNo).filter(r => !r.startsWith('DELETED-'))
    for (const reg of regs) {
      const norm = normalizeRegNo(reg)
      const owners = regIndex.get(norm)
      if (owners && owners.size > 1) { u.sameVehicleReg = reg; break }
    }
  }

  return { byUser, codeOwnerPhoneByCode }
}

// +94771234567 -> 0771234567 (D4/M4: these two endpoints are the one place full
// phone numbers are shown, so Vikum can call/pay - every other admin response is
// counts only, per section 9).
function toLocalFormat(phone: string): string {
  if (phone.startsWith('+94')) return `0${phone.slice(3)}`
  return phone
}

// 5+ signups by the same code within any 1-hour window - informational only
// ("ℹ Busy hour"), never a ⚠ flag (section 7.3: Vikum's field agents sign up many
// people in person, so a burst is expected, not suspicious).
function hasBusyHour(timestamps: Date[]): boolean {
  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime())
  for (let i = 0; i + 4 < sorted.length; i++) {
    if (sorted[i + 4].getTime() - sorted[i].getTime() <= 60 * 60 * 1000) return true
  }
  return false
}

type PromoFlag = 'same_vehicle' | 'mostly_not_real'

function computeCodeFlags(users: ReferredUserStatus[]): { flag: PromoFlag; reason: string }[] {
  const flags: { flag: PromoFlag; reason: string }[] = []
  const sameVehicleUser = users.find(u => u.sameVehicleReg)
  if (sameVehicleUser) flags.push({ flag: 'same_vehicle', reason: `Same vehicle: ${sameVehicleUser.sameVehicleReg}` })
  const judged = users.filter(u => u.status === 'real' || u.status === 'not_real')
  const notReal = judged.filter(u => u.status === 'not_real')
  if (judged.length >= 5 && notReal.length / judged.length > 0.5) {
    flags.push({ flag: 'mostly_not_real', reason: `${notReal.length} of ${judged.length} judged signups are Not Real` })
  }
  return flags
}

// GET /admin/promo-codes — M4 main table
router.get('/promo-codes', async (req: AuthRequest, res) => {
  try {
    const data = await cached('promo-codes', async () => {
      const { byUser, codeOwnerPhoneByCode } = await computeReferredUserStatuses()

      const byCode = new Map<string, ReferredUserStatus[]>()
      for (const u of byUser) {
        if (!byCode.has(u.referredByCode)) byCode.set(u.referredByCode, [])
        byCode.get(u.referredByCode)!.push(u)
      }

      const rows = []
      let totalSignups = 0, totalReal = 0, totalNotReal = 0, flaggedCodes = 0
      for (const [code, users] of byCode) {
        const ownerPhone = codeOwnerPhoneByCode.get(code)
        if (!ownerPhone) continue // code owner deleted/pending-deletion/admin - row not shown

        const real = users.filter(u => u.status === 'real').length
        const notReal = users.filter(u => u.status === 'not_real').length
        const waiting = users.filter(u => u.status === 'waiting').length
        const flags = computeCodeFlags(users)
        const busyHour = hasBusyHour(users.map(u => u.signedUpAt))

        totalSignups += users.length
        totalReal += real
        totalNotReal += notReal
        if (flags.length > 0) flaggedCodes++

        rows.push({
          userNumber: toLocalFormat(ownerPhone),
          promoCode: code,
          real, notReal, waiting,
          flags: flags.map(f => f.flag),
          busyHour,
        })
      }
      rows.sort((a, b) => b.real - a.real)

      return { rows, totalSignups, totalReal, totalNotReal, flaggedCodes }
    })
    res.json(data)
  } catch (error) {
    console.error('GET /admin/promo-codes error:', error)
    res.status(500).json({ error: 'Failed to load promo code signups' })
  }
})

// GET /admin/promo-codes/:code — M4 detail
router.get('/promo-codes/:code', async (req: AuthRequest, res) => {
  try {
    const code = ((req.params.code as string) || '').toUpperCase().trim()
    const { byUser, codeOwnerPhoneByCode } = await computeReferredUserStatuses()
    const ownerPhone = codeOwnerPhoneByCode.get(code)
    const users = byUser.filter(u => u.referredByCode === code)
    if (!ownerPhone || users.length === 0) {
      res.status(404).json({ error: 'Promo code not found' })
      return
    }

    const flags = computeCodeFlags(users)
    const signups = users
      .slice()
      .sort((a, b) => b.signedUpAt.getTime() - a.signedUpAt.getTime())
      .map(u => ({
        phone: toLocalFormat(u.phoneNumber),
        signedUpAt: u.signedUpAt.toISOString(),
        status: u.status,
        reason: u.sameVehicleReg
          ? (u.reason ? `${u.reason}; Same vehicle: ${u.sameVehicleReg}` : `Same vehicle: ${u.sameVehicleReg}`)
          : u.reason,
      }))

    res.json({ promoCode: code, userNumber: toLocalFormat(ownerPhone), flags, signups })
  } catch (error) {
    console.error('GET /admin/promo-codes/:code error:', error)
    res.status(500).json({ error: 'Failed to load promo code detail' })
  }
})

export default router
