import express from 'express'

const router = express.Router()

// ── Category data (mirrors mobile/src/constants/serviceData.ts) ──────────────
// Update this file to push category changes without an app release.

const BASE_CATEGORIES = [
  {
    title: 'Engine & Oil',
    items: [
      'Oil Change', 'Oil Filter', 'Air Filter', 'Fuel Filter',
      'Spark Plugs', 'Glow Plugs (Diesel)', 'Timing Belt', 'Timing Belt Kit',
      'Timing Chain', 'Water Pump', 'Thermostat', 'Coolant Flush',
      'Radiator Service', 'Radiator Cap', 'Engine Flush',
      'Fuel System Clean', 'Injector Clean', 'Throttle Body Clean',
      'Turbo Service', 'Intercooler Service', 'Head Gasket',
      'Valve Service', 'Engine Rebuild', 'Drive Belts',
    ],
  },
  {
    title: 'Brakes',
    items: [
      'Brake Pads (Front)', 'Brake Pads (Rear)',
      'Brake Discs (Front)', 'Brake Discs (Rear)',
      'Brake Drums', 'Brake Fluid', 'Brake Caliper',
      'Brake Hoses', 'Brake Master Cylinder',
      'Handbrake Cable', 'Handbrake Adjustment',
    ],
  },
  {
    title: 'Transmission & Drive',
    items: [
      'Gear Oil (Manual)', 'Transmission Oil (Auto)', 'Transmission Service',
      'Clutch Plate', 'Clutch Kit', 'Pressure Plate', 'Clutch Bearing',
      'CV Joint', 'CV Boot', 'Drive Shaft',
      'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    ],
  },
  {
    title: 'Steering & Suspension',
    items: [
      'Shock Absorbers (Front)', 'Shock Absorbers (Rear)',
      'Springs (Front)', 'Springs (Rear)',
      'Ball Joints', 'Tie Rod Ends', 'Wheel Bearings',
      'Bush Replacement', 'Sway Bar Links',
      'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    ],
  },
  {
    title: 'Tyres & Wheels',
    items: [
      'Tyre Change', 'Tyre Puncture Repair',
      'Wheel Alignment', 'Wheel Balancing',
      'Tyre Rotation', 'Spare Tyre Check', 'Wheel Nuts & Bolts',
    ],
  },
  {
    title: 'Electrical',
    items: [
      'Battery', 'Alternator', 'Starter Motor',
      'Headlights', 'Tail Lights', 'Indicators',
      'Parking Lights', 'Interior Lights', 'Fuses',
      'Horn', 'Wiring Repair', 'Sensors',
    ],
  },
  {
    title: 'AC & Cooling',
    items: [
      'AC Gas Refill', 'AC Service', 'AC Filter',
      'Cabin Filter', 'AC Compressor', 'AC Belt',
      'AC Condenser', 'AC Evaporator', 'Cooling Fan',
    ],
  },
  {
    title: 'Body & Exterior',
    items: [
      'Body Work', 'Dent Repair', 'Paint Job',
      'Windscreen', 'Wiper Blades', 'Door Handles',
      'Mirrors', 'Bumper Repair', 'Wash & Polish',
    ],
  },
  {
    title: 'General & Other',
    items: [
      'Full Service', 'Inspection', 'Exhaust Service',
      'Muffler Repair', 'Seat / Upholstery',
      'Dashboard Repair', 'Audio System',
      'Modification', 'General Repair',
    ],
  },
]

const EXCLUDE_BY_TYPE: Record<string, Set<string>> = {
  'car-petrol': new Set(['Glow Plugs (Diesel)']),
  'car-diesel': new Set(['Spark Plugs']),
  'suv-petrol': new Set(['Glow Plugs (Diesel)']),
  'suv-diesel': new Set(['Spark Plugs']),
  'van':        new Set(['Glow Plugs (Diesel)']),
  'pickup':     new Set(['Glow Plugs (Diesel)']),
  'truck':      new Set(['Spark Plugs']),
  'motorcycle': new Set([
    'Glow Plugs (Diesel)',
    'AC Gas Refill', 'AC Service', 'AC Filter', 'Cabin Filter',
    'AC Compressor', 'AC Belt', 'AC Condenser', 'AC Evaporator',
    'Transmission Oil (Auto)', 'Transmission Service',
    'CV Joint', 'CV Boot', 'Drive Shaft',
    'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    'Springs (Front)', 'Springs (Rear)',
    'Radiator Service', 'Radiator Cap', 'Cooling Fan',
    'Turbo Service', 'Intercooler Service',
    'Windscreen', 'Wiper Blades', 'Door Handles', 'Mirrors',
    'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
    'Head Gasket', 'Valve Service', 'Engine Rebuild',
    'Brake Discs (Front)', 'Brake Discs (Rear)', 'Brake Drums',
    'Brake Caliper', 'Brake Master Cylinder',
    'Handbrake Cable', 'Handbrake Adjustment',
  ]),
  'electric-cycle': new Set([
    'Oil Change', 'Oil Filter', 'Air Filter', 'Fuel Filter',
    'Spark Plugs', 'Glow Plugs (Diesel)',
    'Timing Belt', 'Timing Belt Kit', 'Timing Chain', 'Drive Belts',
    'Water Pump', 'Thermostat', 'Coolant Flush',
    'Radiator Service', 'Radiator Cap', 'Cooling Fan',
    'Engine Flush', 'Fuel System Clean', 'Injector Clean', 'Throttle Body Clean',
    'Turbo Service', 'Intercooler Service', 'Head Gasket', 'Valve Service', 'Engine Rebuild',
    'AC Gas Refill', 'AC Service', 'AC Filter', 'Cabin Filter',
    'AC Compressor', 'AC Belt', 'AC Condenser', 'AC Evaporator',
    'Gear Oil (Manual)', 'Transmission Oil (Auto)', 'Transmission Service',
    'Clutch Plate', 'Clutch Kit', 'Pressure Plate', 'Clutch Bearing',
    'CV Joint', 'CV Boot', 'Drive Shaft',
    'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    'Shock Absorbers (Front)', 'Shock Absorbers (Rear)',
    'Springs (Front)', 'Springs (Rear)',
    'Ball Joints', 'Tie Rod Ends', 'Wheel Bearings', 'Bush Replacement', 'Sway Bar Links',
    'Brake Discs (Front)', 'Brake Discs (Rear)', 'Brake Drums',
    'Brake Caliper', 'Brake Hoses', 'Brake Master Cylinder',
    'Handbrake Cable', 'Handbrake Adjustment',
    'Alternator', 'Starter Motor',
    'Windscreen', 'Wiper Blades', 'Door Handles', 'Mirrors',
    'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
    'Exhaust Service', 'Muffler Repair',
  ]),
  'three-wheeler': new Set([
    'Glow Plugs (Diesel)',
    'AC Gas Refill', 'AC Service', 'AC Filter', 'Cabin Filter',
    'AC Compressor', 'AC Belt', 'AC Condenser', 'AC Evaporator',
    'Transmission Oil (Auto)', 'Transmission Service',
    'CV Joint', 'CV Boot', 'Drive Shaft',
    'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    'Springs (Front)', 'Springs (Rear)',
    'Radiator Service', 'Radiator Cap', 'Cooling Fan',
    'Turbo Service', 'Intercooler Service',
    'Windscreen', 'Wiper Blades', 'Door Handles', 'Mirrors',
    'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
    'Head Gasket', 'Valve Service', 'Engine Rebuild',
    'Brake Discs (Front)', 'Brake Discs (Rear)',
    'Brake Caliper', 'Brake Hoses', 'Brake Master Cylinder',
    'Handbrake Cable', 'Handbrake Adjustment',
  ]),
  'electric': new Set([
    'Oil Change', 'Oil Filter', 'Fuel Filter',
    'Spark Plugs', 'Glow Plugs (Diesel)',
    'Timing Belt', 'Timing Belt Kit', 'Timing Chain', 'Drive Belts',
    'Thermostat', 'Radiator Service', 'Radiator Cap', 'Cooling Fan',
    'Engine Flush', 'Fuel System Clean', 'Injector Clean', 'Throttle Body Clean',
    'Turbo Service', 'Intercooler Service', 'Head Gasket', 'Valve Service', 'Engine Rebuild',
    'Gear Oil (Manual)', 'Clutch Plate', 'Clutch Kit', 'Pressure Plate', 'Clutch Bearing',
    'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    'Exhaust Service', 'Muffler Repair',
    'Alternator', 'Starter Motor',
  ]),
  'heavy': new Set([
    'Spark Plugs',
    'AC Gas Refill', 'AC Service', 'AC Filter', 'Cabin Filter',
    'AC Compressor', 'AC Belt', 'AC Condenser', 'AC Evaporator',
    'Transmission Oil (Auto)', 'Transfer Case Oil',
    'CV Joint', 'CV Boot', 'Drive Shaft',
    'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    'Windscreen', 'Wiper Blades', 'Door Handles', 'Mirrors',
    'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
    'Wheel Balancing', 'Tyre Rotation', 'Spare Tyre Check',
  ]),
}

type ExtraItem = { categoryTitle: string; items: string[] }
const EXTRA_BY_TYPE: Partial<Record<string, ExtraItem[]>> = {
  'motorcycle':     [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'electric-cycle': [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'three-wheeler':  [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'electric':       [{ categoryTitle: 'Electrical',           items: ['EV Battery Check'] }],
  'truck':          [{ categoryTitle: 'General & Other',      items: ['Hydraulic Oil', 'Hydraulic Hoses'] }],
  'heavy':          [
    { categoryTitle: 'Engine & Oil',    items: ['Hydraulic Oil'] },
    { categoryTitle: 'General & Other', items: ['Hydraulic Hoses', 'Tracks Inspection', 'Undercarriage Service'] },
  ],
}

function getFilteredCategories(vehicleType?: string) {
  const excludeSet = vehicleType ? (EXCLUDE_BY_TYPE[vehicleType] ?? new Set<string>()) : new Set<string>()
  const extraItems = vehicleType ? (EXTRA_BY_TYPE[vehicleType] ?? []) : []

  return BASE_CATEGORIES
    .map(cat => {
      const filtered = cat.items.filter(item => !excludeSet.has(item))
      const extra = extraItems.find(e => e.categoryTitle === cat.title)
      const allItems = extra ? [...filtered, ...extra.items] : filtered
      return { ...cat, items: allItems }
    })
    .filter(cat => cat.items.length > 0)
}

// GET /service-categories?vehicleType=car-petrol
// Public — no auth required (static config data)
router.get('/', (req, res) => {
  const vehicleType = req.query.vehicleType as string | undefined
  const categories = getFilteredCategories(vehicleType)
  res.json({ categories })
})

export default router
