import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { SERVICE_INTERVALS, FuelScope } from '../data/serviceIntervals'

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

function urgencyScore(status: string, remainingKm: number | null, remainingDays: number | null): number {
  const kmVal = remainingKm ?? Infinity
  const daysVal = remainingDays ?? Infinity
  if (status === 'overdue') {
    // Most overdue first (most negative remaining)
    return -10000 + Math.min(kmVal, daysVal * 10)
  }
  if (status === 'due_soon') {
    return Math.min(kmVal < Infinity ? kmVal : 99999, daysVal < Infinity ? daysVal * 10 : 99999)
  }
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

    const predictions = SERVICE_INTERVALS
      .filter(interval => passesScope(interval.fuelScope, vehicle.fuelType))
      .map(interval => {
        // Find most recent matching record
        const matching = records.filter(r =>
          interval.keywords.some(kw =>
            r.description.toLowerCase().includes(kw.toLowerCase())
          )
        )
        const last = matching[0] || null // already sorted desc by date

        if (!last) {
          return {
            id: interval.id,
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
        const kmOverdue = remainingKm !== null && remainingKm < 0
        const daysOverdue = remainingDays !== null && remainingDays < 0
        const kmSoon = remainingKm !== null && remainingKm >= 0 && remainingKm <= interval.urgencyKm
        const daysSoon = remainingDays !== null && remainingDays >= 0 && remainingDays <= interval.urgencyDays

        if (kmOverdue || daysOverdue) status = 'overdue'
        else if (kmSoon || daysSoon) status = 'due_soon'

        return {
          id: interval.id,
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
