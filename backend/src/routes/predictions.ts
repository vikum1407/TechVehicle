import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { SERVICE_INTERVALS, ServiceInterval, FuelScope } from '../data/serviceIntervals'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

function passesScope(scope: FuelScope, fuelType: string): boolean {
  const ft = fuelType.toLowerCase()
  const isPetrol = ft.includes('petrol')
  const isDiesel = ft === 'diesel'
  const isElectric = ft === 'electric'
  switch (scope) {
    case 'all': return true
    case 'petrol-only': return isPetrol
    case 'diesel-only': return isDiesel
    case 'not-electric': return !isElectric
    case 'electric-only': return isElectric
    default: return true
  }
}

function makeMatches(interval: ServiceInterval, make: string): boolean {
  const m = make.toLowerCase()
  if (interval.makes && !interval.makes.some(im => im.toLowerCase() === m)) return false
  if (interval.excludeMakes && interval.excludeMakes.some(im => im.toLowerCase() === m)) return false
  return true
}

function modelMatches(interval: ServiceInterval, model: string): boolean {
  if (!interval.models) return true
  return interval.models.some(im => model.toLowerCase().includes(im.toLowerCase()))
}

function specificityScore(interval: ServiceInterval): number {
  let score = 0
  if (interval.makes) score += 2
  if (interval.models) score += 1
  return score
}

function urgencyScore(status: string, remainingKm: number | null, remainingDays: number | null): number {
  const kmVal = remainingKm ?? Infinity
  const daysVal = remainingDays ?? Infinity
  if (status === 'overdue') return -10000 + Math.min(kmVal, daysVal * 10)
  if (status === 'due_soon') return Math.min(kmVal < Infinity ? kmVal : 99999, daysVal < Infinity ? daysVal * 10 : 99999)
  if (status === 'no_data') return 900000
  return 1000000 + Math.min(kmVal < Infinity ? kmVal : 999999, daysVal < Infinity ? daysVal * 10 : 999999)
}

// GET /predictions/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const { vehicleId } = req.params as { vehicleId: string }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })

    const today = new Date()
    const currentMileage = vehicle.mileage

    // Step 1 — filter intervals applicable to this vehicle
    const applicable = SERVICE_INTERVALS.filter(interval =>
      passesScope(interval.fuelScope, vehicle.fuelType) &&
      makeMatches(interval, vehicle.make) &&
      modelMatches(interval, vehicle.model)
    )

    // Step 2 — deduplicate by group: most specific wins (models > makes > general)
    const grouped = new Map<string, ServiceInterval>()
    for (const interval of applicable) {
      const existing = grouped.get(interval.group)
      if (!existing || specificityScore(interval) > specificityScore(existing)) {
        grouped.set(interval.group, interval)
      }
    }

    // Step 3 — run predictions on winning intervals
    const predictions = Array.from(grouped.values()).map(interval => {
      const matching = records.filter(r =>
        interval.keywords.some(kw => r.description.toLowerCase().includes(kw.toLowerCase()))
      )
      const last = matching[0] || null

      if (!last) {
        return {
          id: interval.id,
          group: interval.group,
          name: interval.name,
          source: interval.source,
          status: 'no_data' as const,
          lastDoneKm: null,
          lastDoneDate: null,
          dueAtKm: null,
          remainingKm: null,
          dueAtDate: null,
          remainingDays: null,
        }
      }

      const lastKm = last.mileage
      const lastDate = new Date(last.date)

      let remainingKm: number | null = null
      let dueAtKm: number | null = null
      if (interval.kmInterval && lastKm != null) {
        dueAtKm = lastKm + interval.kmInterval
        remainingKm = dueAtKm - currentMileage
      }

      let remainingDays: number | null = null
      let dueAtDate: string | null = null
      if (interval.daysInterval) {
        const due = new Date(lastDate)
        due.setDate(due.getDate() + interval.daysInterval)
        dueAtDate = due.toISOString()
        remainingDays = Math.floor((due.getTime() - today.getTime()) / 86400000)
      }

      let status: 'overdue' | 'due_soon' | 'ok' = 'ok'
      if (
        (remainingKm !== null && remainingKm < 0) ||
        (remainingDays !== null && remainingDays < 0)
      ) {
        status = 'overdue'
      } else if (
        (remainingKm !== null && remainingKm <= interval.urgencyKm) ||
        (remainingDays !== null && remainingDays <= interval.urgencyDays)
      ) {
        status = 'due_soon'
      }

      return {
        id: interval.id,
        group: interval.group,
        name: interval.name,
        source: interval.source,
        status,
        lastDoneKm: lastKm,
        lastDoneDate: last.date.toISOString(),
        dueAtKm,
        remainingKm,
        dueAtDate,
        remainingDays,
      }
    })
    .sort((a, b) => urgencyScore(a.status, a.remainingKm, a.remainingDays) - urgencyScore(b.status, b.remainingKm, b.remainingDays))

    res.json(predictions)
  } catch (error) {
    console.error('GET /predictions error:', error)
    res.status(500).json({ error: 'Failed to generate predictions' })
  }
})

export default router
