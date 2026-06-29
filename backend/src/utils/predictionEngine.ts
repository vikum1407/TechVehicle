import { SERVICE_INTERVALS, ServiceInterval, FuelScope } from '../data/serviceIntervals'

export type PredictionRow = {
  id: string
  group: string
  name: string
  source: string
  keywords: string[]
  status: 'overdue' | 'due_soon' | 'ok' | 'no_data'
  lastDoneKm: number | null
  lastDoneDate: string | null
  dueAtKm: number | null
  remainingKm: number | null
  dueAtDate: string | null
  remainingDays: number | null
  customKmInterval: number | null
  customDaysInterval: number | null
}

export type IntervalOverride = { kmInterval?: number | null; daysInterval?: number | null }

export type VehicleInput = {
  make: string
  model: string
  year: number
  fuelType: string
  mileage: number
  vehicleType: string | null
  intervalOverrides?: Record<string, IntervalOverride> | null
}

export function passesScope(scope: FuelScope, fuelType: string): boolean {
  const ft = fuelType.toLowerCase()
  switch (scope) {
    case 'all': return true
    case 'petrol-only': return ft.includes('petrol')
    case 'diesel-only': return ft === 'diesel'
    case 'not-electric': return ft !== 'electric'
    case 'electric-only': return ft === 'electric'
    default: return true
  }
}

export function makeMatches(interval: ServiceInterval, make: string): boolean {
  const m = make.toLowerCase()
  if (interval.makes && !interval.makes.some(im => im.toLowerCase() === m)) return false
  if (interval.excludeMakes && interval.excludeMakes.some(im => im.toLowerCase() === m)) return false
  return true
}

export function modelMatches(interval: ServiceInterval, model: string): boolean {
  const lc = model.toLowerCase()
  if (interval.models && !interval.models.some(im => lc.includes(im.toLowerCase()))) return false
  if (interval.excludeModels && interval.excludeModels.some(im => lc.includes(im.toLowerCase()))) return false
  return true
}

export function yearMatches(interval: ServiceInterval, year: number): boolean {
  if (!interval.yearRange) return true
  return year >= interval.yearRange[0] && year <= interval.yearRange[1]
}

export function vehicleTypeMatches(interval: ServiceInterval, vehicleType: string | null): boolean {
  if (!vehicleType) return true
  if (interval.vehicleTypes && !interval.vehicleTypes.includes(vehicleType)) return false
  if (interval.excludeVehicleTypes && interval.excludeVehicleTypes.includes(vehicleType)) return false
  return true
}

function specificityScore(interval: ServiceInterval): number {
  let score = 0
  if (interval.makes) score += 2
  if (interval.models) score += 1
  if (interval.yearRange) score += 1
  return score
}

export function urgencyScore(status: string, remainingKm: number | null, remainingDays: number | null): number {
  const kmVal = remainingKm ?? Infinity
  const daysVal = remainingDays ?? Infinity
  if (status === 'overdue')  return -10000 + Math.min(kmVal, daysVal * 10)
  if (status === 'due_soon') return Math.min(kmVal < Infinity ? kmVal : 99999, daysVal < Infinity ? daysVal * 10 : 99999)
  if (status === 'no_data')  return 900000
  return 1000000 + Math.min(kmVal < Infinity ? kmVal : 999999, daysVal < Infinity ? daysVal * 10 : 999999)
}

const BASE_TYRE_LIFE_KM = 40000

function computeTyrePrediction(
  vehicle: VehicleInput,
  records: { description: string; mileage: number | null; date: Date }[]
): PredictionRow {
  const tyreRecord = records
    .filter(r => r.description.toLowerCase().includes('tyre change'))
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0] || null

  if (!tyreRecord) {
    return {
      id: 'tyre_change', group: 'tyre_change', name: 'Tyre Change',
      keywords: ['Tyre Change'],
      source: 'Log a tyre change in service records to unlock a personalised prediction',
      status: 'no_data',
      lastDoneKm: null, lastDoneDate: null, dueAtKm: null,
      remainingKm: null, dueAtDate: null, remainingDays: null,
      customKmInterval: null, customDaysInterval: null,
    }
  }

  const lastTyreKm = tyreRecord.mileage
  const lastTyreDate = tyreRecord.date

  const alignmentsSince = records.filter(r =>
    r.description.toLowerCase().includes('wheel alignment') && r.date > lastTyreDate
  )

  const kmSinceChange = lastTyreKm !== null ? vehicle.mileage - lastTyreKm : null
  let multiplier = 1.0
  let freqNote = `${BASE_TYRE_LIFE_KM.toLocaleString()} km baseline`

  if (kmSinceChange !== null && kmSinceChange > 0 && alignmentsSince.length > 0) {
    const per10k = (alignmentsSince.length / kmSinceChange) * 10000
    if (per10k <= 0.5)      { multiplier = 1.2; freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} since last change (low frequency — good roads, longer tyre life)` }
    else if (per10k <= 1.0) { multiplier = 1.0; freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} since last change (normal frequency)` }
    else if (per10k <= 2.0) { multiplier = 0.8; freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} since last change (high frequency — rough roads or wear)` }
    else                    { multiplier = 0.65; freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} since last change (very high — inspect suspension)` }
  } else if (alignmentsSince.length > 0) {
    freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} logged since last tyre change`
  }

  const predictedLife = Math.round(BASE_TYRE_LIFE_KM * multiplier)
  const dueAtKm = lastTyreKm !== null ? lastTyreKm + predictedLife : null
  const remainingKm = dueAtKm !== null ? dueAtKm - vehicle.mileage : null

  let status: 'overdue' | 'due_soon' | 'ok' = 'ok'
  if (remainingKm !== null && remainingKm < 0) status = 'overdue'
  else if (remainingKm !== null && remainingKm <= 3000) status = 'due_soon'

  return {
    id: 'tyre_change', group: 'tyre_change', name: 'Tyre Change',
    keywords: ['Tyre Change'],
    source: freqNote,
    status,
    lastDoneKm: lastTyreKm,
    lastDoneDate: lastTyreDate.toISOString(),
    dueAtKm, remainingKm, dueAtDate: null, remainingDays: null,
    customKmInterval: null, customDaysInterval: null,
  }
}

export function computePredictions(
  vehicle: VehicleInput,
  records: { description: string; mileage: number | null; date: Date }[]
): PredictionRow[] {
  const today = new Date()

  const applicable = SERVICE_INTERVALS.filter(interval =>
    passesScope(interval.fuelScope, vehicle.fuelType) &&
    makeMatches(interval, vehicle.make) &&
    modelMatches(interval, vehicle.model) &&
    yearMatches(interval, vehicle.year) &&
    vehicleTypeMatches(interval, vehicle.vehicleType)
  )

  const grouped = new Map<string, ServiceInterval>()
  for (const interval of applicable) {
    const existing = grouped.get(interval.group)
    if (!existing || specificityScore(interval) > specificityScore(existing)) {
      grouped.set(interval.group, interval)
    }
  }

  const overrides = vehicle.intervalOverrides ?? {}

  const mainRows = Array.from(grouped.values()).map(interval => {
    const override = (overrides as Record<string, IntervalOverride>)[interval.group] ?? null
    const kmInterval   = (override?.kmInterval   != null) ? override.kmInterval   : interval.kmInterval
    const daysInterval = (override?.daysInterval != null) ? override.daysInterval : interval.daysInterval
    const customKmInterval   = override?.kmInterval   ?? null
    const customDaysInterval = override?.daysInterval ?? null

    const matching = records.filter(r =>
      interval.keywords.some(kw => r.description.toLowerCase().includes(kw.toLowerCase()))
    )
    const last = matching[0] || null

    if (!last) {
      return {
        id: interval.id, group: interval.group, name: interval.name, source: interval.source,
        keywords: interval.keywords,
        status: 'no_data' as const,
        lastDoneKm: null, lastDoneDate: null, dueAtKm: null,
        remainingKm: null, dueAtDate: null, remainingDays: null,
        customKmInterval, customDaysInterval,
      }
    }

    const lastKm = last.mileage
    const lastDate = new Date(last.date)

    let remainingKm: number | null = null
    let dueAtKm: number | null = null
    if (kmInterval && lastKm != null) {
      dueAtKm = lastKm + kmInterval
      remainingKm = dueAtKm - vehicle.mileage
    }

    let remainingDays: number | null = null
    let dueAtDate: string | null = null
    if (daysInterval) {
      const due = new Date(lastDate)
      due.setDate(due.getDate() + daysInterval)
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
      id: interval.id, group: interval.group, name: interval.name, source: interval.source,
      keywords: interval.keywords,
      status, lastDoneKm: lastKm, lastDoneDate: last.date.toISOString(),
      dueAtKm, remainingKm, dueAtDate, remainingDays,
      customKmInterval, customDaysInterval,
    }
  })

  const tyreRow = computeTyrePrediction(vehicle, records)
  return [...mainRows, tyreRow].sort((a, b) => urgencyScore(a.status, a.remainingKm, a.remainingDays) - urgencyScore(b.status, b.remainingKm, b.remainingDays))
}
