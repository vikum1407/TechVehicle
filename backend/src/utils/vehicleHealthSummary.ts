// Shared "Vehicle Health Summary" — one auto-analyzed, visual-friendly view of
// a vehicle's condition, meant to replace a raw scrollable record list in
// three places: the booking flow's record-share step, the sell flow's buyer
// preview, and family vehicle share. See CLAUDE.md / the analytics redesign
// notes for the full reasoning.
//
// Deliberately NOT a new public endpoint — each of the three call sites
// already has its own correct access-control check for "can this caller see
// this vehicle's shared data" (a share session, a family share grant, a
// pending transfer). This function is called from within those existing,
// already-audited routes and its output embedded in their response, rather
// than exposing a new route with its own access surface to get right.
//
// Cost figures here deliberately exclude personal/behavioral expense
// categories (Parking, Toll, Fine/Penalty, Accessories, Washing) — none of
// them help a garage, buyer, or family member evaluate the vehicle, and
// surfacing them to another party is either a privacy leak (fines) or can
// create a false expectation of what comes with the vehicle (accessories).
// This restriction applies ONLY to this shared summary — the owner's own
// Analytics/History screens, and a final Sell/Transfer handoff, are
// unaffected and still show/transfer everything.
//
// includeCosts (added 2026-10-22): a garage seeing exactly what the owner
// paid elsewhere isn't useful to them for the job at hand and the owner
// doesn't want it shown - shareSessions.ts (the garage-facing call site,
// covering both the standalone Share flow and a booking's attached history)
// passes false. transfers.ts (the buyer's pre-sale preview) keeps it true -
// real verified cost history there is a core trust-building feature of the
// Sell/Transfer engine, not a leak. vehicleShares.ts (family) also keeps it
// true, same reasoning as the owner's own view.

import { PrismaClient } from '@prisma/client'
import { computePredictions, VehicleInput } from './predictionEngine'
import { classifyDescription } from '../data/serviceCatalog'

const prisma = new PrismaClient()

export type VehicleHealthSummary = {
  mileageTrend: { date: string; mileage: number }[]
  topPredictions: {
    name: string
    status: 'overdue' | 'due_soon'
    remainingKm: number | null
    remainingDays: number | null
  }[]
  recentServices: {
    date: string
    description: string
    category: 'service' | 'legal_compliance'
    mileage: number | null
    cost: number | null
  }[]
  showCosts: boolean
  totalSpend: number
  spendBreakdown: { category: string; amount: number }[]
}

export async function computeVehicleHealthSummary(vehicleId: string, includeCosts: boolean = true, sharedRecordIds?: string[]): Promise<VehicleHealthSummary | null> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } })
  if (!vehicle) return null

  const [serviceRecords, fuelLogs] = await Promise.all([
    prisma.serviceRecord.findMany({ where: { vehicleId }, orderBy: { date: 'desc' } }),
    prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { date: 'asc' } }),
  ])

  // Mileage trend — same source/shape convention as the owner's own Analytics
  // screen (last 12 fuel logs), so both charts read consistently if compared.
  const mileageTrend = fuelLogs.slice(-12).map(l => ({
    date: l.date.toISOString(),
    mileage: l.mileage,
  }))

  // Top 2-3 due/overdue predictions, most urgent first (computePredictions
  // already sorts by urgency).
  const predictions = computePredictions(vehicle as unknown as VehicleInput, serviceRecords)
  const topPredictions = predictions
    .filter(p => p.status === 'overdue' || p.status === 'due_soon')
    .slice(0, 3)
    .map(p => ({
      name: p.name,
      status: p.status as 'overdue' | 'due_soon',
      remainingKm: p.remainingKm,
      remainingDays: p.remainingDays,
    }))

  // Last 5 services as compact cards, not the full raw record. Mileage is
  // always included (not cost-gated) - a garage needs it to plan maintenance.
  // sharedRecordIds (added 2026-10-22), when given, scopes this to exactly
  // what the owner chose to share for this session - mileageTrend/
  // topPredictions above stay vehicle-wide regardless, since they need full
  // history to be accurate and aren't really "personal history" the owner's
  // selective-share control was meant to gate.
  const recentServicesSource = sharedRecordIds
    ? serviceRecords.filter(r => sharedRecordIds.includes(r.id))
    : serviceRecords
  const recentServices = recentServicesSource.slice(0, 5).map(r => ({
    date: r.date.toISOString(),
    description: r.description,
    category: (classifyDescription(r.description)?.category ?? 'service') as 'service' | 'legal_compliance',
    mileage: r.mileage,
    cost: includeCosts ? r.cost : null,
  }))

  // Spend: Service & Repairs + Legal & Compliance (from service records) +
  // Fuel/Charging only — see file header for why personal expense categories
  // are excluded entirely here, not just re-labeled.
  const isElectric = vehicle.vehicleType === 'electric'
  let serviceCost = 0
  let legalComplianceCost = 0
  for (const r of serviceRecords) {
    const cost = r.cost || 0
    if (classifyDescription(r.description)?.category === 'legal_compliance') legalComplianceCost += cost
    else serviceCost += cost
  }
  const fuelCost = fuelLogs.reduce((s, l) => s + (l.cost || 0), 0)
  const totalSpend = includeCosts ? serviceCost + legalComplianceCost + fuelCost : 0

  const spendBreakdown = !includeCosts ? [] : [
    { category: 'Service & Repairs', amount: serviceCost },
    { category: 'Legal & Compliance', amount: legalComplianceCost },
    { category: isElectric ? 'Charging' : 'Fuel', amount: fuelCost },
  ].filter(c => c.amount > 0)

  return { mileageTrend, topPredictions, recentServices, showCosts: includeCosts, totalSpend, spendBreakdown }
}
