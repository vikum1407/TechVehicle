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
    cost: number | null
  }[]
  totalSpend: number
  spendBreakdown: { category: string; amount: number }[]
}

export async function computeVehicleHealthSummary(vehicleId: string): Promise<VehicleHealthSummary | null> {
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

  // Last 5 services as compact cards, not the full raw record.
  const recentServices = serviceRecords.slice(0, 5).map(r => ({
    date: r.date.toISOString(),
    description: r.description,
    category: (classifyDescription(r.description)?.category ?? 'service') as 'service' | 'legal_compliance',
    cost: r.cost,
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
  const totalSpend = serviceCost + legalComplianceCost + fuelCost

  const spendBreakdown = [
    { category: 'Service & Repairs', amount: serviceCost },
    { category: 'Legal & Compliance', amount: legalComplianceCost },
    { category: isElectric ? 'Charging' : 'Fuel', amount: fuelCost },
  ].filter(c => c.amount > 0)

  return { mileageTrend, topPredictions, recentServices, totalSpend, spendBreakdown }
}
