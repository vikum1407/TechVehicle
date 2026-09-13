// Single source of truth for "what kind of thing is this service item" —
// category (for Analytics' Spending-by-Category) and driver (mileage-based
// vs date-based, for Predictions/Cost Forecast). Analytics, Predictions, and
// Cost Forecast previously each independently guessed this from description
// text, which is exactly what caused the Emission Test double-counting bug
// (it could be logged via Add Expense's "Emission Test" category OR the
// Vehicle Tests screen's own tracking, and Analytics counted both as
// separate things). Everything should classify a record by looking it up
// here instead of re-guessing.
//
// This file is purely additive — nothing reads from it yet. Existing
// classification logic in analytics.ts, predictionEngine.ts, and the
// cost-forecast endpoint is migrated to use it as its own separate,
// carefully-tested step, not bundled into adding this file.

export type ServiceCategory = 'service' | 'legal_compliance'
export type ServiceDriver = 'mileage' | 'date'

export type ServiceCatalogEntry = {
  category: ServiceCategory
  driver: ServiceDriver
}

// Keyed by the exact `name` used in serviceIntervals.ts (mileage/date-driven
// maintenance items), plus the Legal & Compliance items that only exist as
// Add Expense categories today (Insurance, Revenue Licence) or as the Vehicle
// Tests screen's own tracking (Emission Test — removed from
// serviceIntervals.ts on 2026-09-12 for exactly this reason).
export const SERVICE_CATALOG: Record<string, ServiceCatalogEntry> = {
  // Mileage-driven mechanical maintenance — Service & Repairs
  'Engine Oil Change': { category: 'service', driver: 'mileage' },
  'Air Filter': { category: 'service', driver: 'mileage' },
  'Fuel Filter': { category: 'service', driver: 'mileage' },
  'Spark Plugs': { category: 'service', driver: 'mileage' },
  'Spark Plugs (Iridium)': { category: 'service', driver: 'mileage' },
  'Glow Plugs': { category: 'service', driver: 'mileage' },
  'Timing Belt': { category: 'service', driver: 'mileage' },
  'Drive Belts (Aux)': { category: 'service', driver: 'mileage' },
  'Coolant Flush': { category: 'service', driver: 'mileage' },
  'Battery': { category: 'service', driver: 'mileage' },
  'Brake Pads': { category: 'service', driver: 'mileage' },
  'Brake Fluid': { category: 'service', driver: 'mileage' },
  'Shock Absorbers': { category: 'service', driver: 'mileage' },
  'Water Pump': { category: 'service', driver: 'mileage' },
  'Power Steering Fluid': { category: 'service', driver: 'mileage' },
  'Gear Oil': { category: 'service', driver: 'mileage' },
  'Manual Gear Oil': { category: 'service', driver: 'mileage' },
  'Automatic Transmission Fluid': { category: 'service', driver: 'mileage' },
  'CVT / Automatic Transmission Fluid': { category: 'service', driver: 'mileage' },
  'AC / Cabin Filter': { category: 'service', driver: 'mileage' },
  'Hybrid Battery Health Check': { category: 'service', driver: 'mileage' },
  'EV Battery Health Check': { category: 'service', driver: 'mileage' },
  'Chain Lubrication': { category: 'service', driver: 'mileage' },
  'Drive Chain Lubrication': { category: 'service', driver: 'mileage' },
  'Chain & Sprocket': { category: 'service', driver: 'mileage' },
  'Drive Chain & Sprocket': { category: 'service', driver: 'mileage' },
  'Tyre Rotation': { category: 'service', driver: 'mileage' },
  'Tyre Change': { category: 'service', driver: 'mileage' },
  'Wheel Alignment': { category: 'service', driver: 'mileage' },

  // Date-driven legal/regulatory renewals — Legal & Compliance
  'Insurance': { category: 'legal_compliance', driver: 'date' },
  'Revenue Licence': { category: 'legal_compliance', driver: 'date' },
  'Emission Test': { category: 'legal_compliance', driver: 'date' },
}

// Matches a free-text description (e.g. a ServiceRecord's description field)
// against the catalog by substring, case-insensitive — the same matching
// style already used throughout predictionEngine.ts and analytics.ts, so
// migrating those call sites onto this function changes lookup source, not
// lookup behavior. Longest name matched first so e.g. "Spark Plugs (Iridium)"
// doesn't get shadowed by the shorter "Spark Plugs" entry.
const CATALOG_ENTRIES_BY_LENGTH = Object.entries(SERVICE_CATALOG)
  .sort((a, b) => b[0].length - a[0].length)

export function classifyDescription(description: string): ServiceCatalogEntry | null {
  const d = description.toLowerCase()
  for (const [name, entry] of CATALOG_ENTRIES_BY_LENGTH) {
    if (d.includes(name.toLowerCase())) return entry
  }
  return null
}
