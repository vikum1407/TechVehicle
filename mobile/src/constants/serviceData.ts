export type SelectedItem = {
  name: string
  category: string
  brand: string
}

export type VehicleType =
  | 'motorcycle'
  | 'electric-cycle'
  | 'car-petrol'
  | 'car-diesel'
  | 'suv-petrol'
  | 'suv-diesel'
  | 'three-wheeler'
  | 'van'
  | 'pickup'
  | 'electric'
  | 'truck'
  | 'heavy'

export type VehicleTypeOption = {
  label: string
  value: VehicleType
  icon: string
}

export const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  { icon: '🏍️', label: 'Motorcycle',     value: 'motorcycle' },
  { icon: '⚡',  label: 'Electric Cycle', value: 'electric-cycle' },
  { icon: '🚗',  label: 'Car — Petrol',   value: 'car-petrol' },
  { icon: '🚗',  label: 'Car — Diesel',   value: 'car-diesel' },
  { icon: '🚙',  label: 'SUV — Petrol',   value: 'suv-petrol' },
  { icon: '🚙',  label: 'SUV — Diesel',   value: 'suv-diesel' },
  { icon: '🛺',  label: 'Three-Wheeler',  value: 'three-wheeler' },
  { icon: '🚐',  label: 'Van / Minivan',  value: 'van' },
  { icon: '🛻',  label: 'Pickup Truck',   value: 'pickup' },
  { icon: '🔋',  label: 'Electric Car',   value: 'electric' },
  { icon: '🚛',  label: 'Truck / Lorry',  value: 'truck' },
  { icon: '🚜',  label: 'Heavy Vehicle',  value: 'heavy' },
]

export const NO_BRAND_ITEMS = new Set([
  'Wheel Alignment', 'Wheel Balancing', 'Tyre Rotation', 'Tyre Puncture Repair', 'Spare Tyre Check',
  'Inspection', 'Wash & Polish', 'Full Service', 'General Repair', 'Modification',
  'Handbrake Adjustment', 'Body Work', 'Dent Repair', 'Paint Job',
  'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
  'Injector Clean', 'Throttle Body Clean', 'Fuel System Clean',
  'Engine Flush', 'Radiator Service', 'Valve Service',
  'Transmission Service', 'AC Service', 'Turbo Service', 'Intercooler Service',
  'Engine Rebuild', 'Gearbox Overhaul', 'Wiring Repair',
  'Exhaust Service', 'Muffler Repair',
  'Parking Lights', 'Interior Lights', 'Fuses',
  'Chain Lubrication', 'EV Battery Check',
  'Hydraulic Hoses', 'Tracks Inspection', 'Undercarriage Service',
])

export const ITEM_BRANDS: Record<string, string[]> = {
  'Oil Change':              ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline'],
  'Oil Filter':              ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'Air Filter':              ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann', 'K&N'],
  'Fuel Filter':             ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'AC Filter':               ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'Cabin Filter':            ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'Spark Plugs':             ['NGK', 'Denso', 'Bosch', 'Champion'],
  'Glow Plugs (Diesel)':     ['NGK', 'Denso', 'Bosch'],
  'Timing Belt':             ['Gates', 'Dayco', 'Bando', 'Continental', 'Toyota OEM', 'Honda OEM'],
  'Timing Belt Kit':         ['Gates', 'Dayco', 'INA', 'Toyota OEM', 'Honda OEM'],
  'Timing Chain':            ['Toyota OEM', 'Honda OEM', 'Genuine Parts'],
  'Drive Belts':             ['Gates', 'Dayco', 'Bando', 'Continental', 'Toyota OEM', 'Honda OEM'],
  'AC Belt':                 ['Gates', 'Dayco', 'Bando', 'Toyota OEM', 'Honda OEM'],
  'Water Pump':              ['Toyota OEM', 'Honda OEM', 'GMB', 'Aisin', 'Denso'],
  'Thermostat':              ['Toyota OEM', 'Honda OEM', 'Aisin', 'Gates'],
  'Radiator Cap':            ['Toyota OEM', 'Honda OEM', 'Aisin'],
  'Coolant Flush':           ['Toyota OEM', 'Honda OEM', 'Prestone', 'Peak'],
  'Cooling Fan':             ['Denso', 'Toyota OEM', 'Honda OEM'],
  'Head Gasket':             ['Toyota OEM', 'Honda OEM', 'Victor Reinz', 'Cometic'],
  'Brake Pads (Front)':      ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'TRW'],
  'Brake Pads (Rear)':       ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'TRW'],
  'Brake Discs (Front)':     ['Bosch', 'Brembo', 'DBA', 'Toyota OEM', 'Honda OEM'],
  'Brake Discs (Rear)':      ['Bosch', 'Brembo', 'DBA', 'Toyota OEM', 'Honda OEM'],
  'Brake Drums':             ['Toyota OEM', 'Honda OEM', 'Bosch', 'ATE'],
  'Brake Fluid':             ['Toyota OEM', 'Honda OEM', 'Castrol', 'Bosch', 'ATE', 'Motul'],
  'Brake Caliper':           ['Toyota OEM', 'Honda OEM', 'TRW', 'ATE'],
  'Brake Hoses':             ['Toyota OEM', 'Honda OEM', 'Goodridge'],
  'Brake Master Cylinder':   ['Toyota OEM', 'Honda OEM', 'ATE'],
  'Handbrake Cable':         ['Toyota OEM', 'Honda OEM'],
  'Gear Oil (Manual)':       ['Castrol', 'Mobil', 'Shell', 'Total', 'Toyota OEM', 'Honda OEM'],
  'Transmission Oil (Auto)': ['Toyota OEM', 'Honda OEM', 'Aisin', 'Castrol', 'Mobil'],
  'Clutch Plate':            ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM'],
  'Clutch Kit':              ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM'],
  'Pressure Plate':          ['Exedy', 'LUK', 'Sachs', 'Toyota OEM'],
  'Clutch Bearing':          ['Exedy', 'LUK', 'NSK', 'Toyota OEM'],
  'CV Joint':                ['Toyota OEM', 'Honda OEM', 'GKN', 'GSP'],
  'CV Boot':                 ['Toyota OEM', 'Honda OEM', 'GKN'],
  'Drive Shaft':             ['Toyota OEM', 'Honda OEM', 'GKN', 'GSP'],
  'Differential Oil':        ['Castrol', 'Shell', 'Mobil', 'Toyota OEM', 'Honda OEM'],
  'Transfer Case Oil':       ['Toyota OEM', 'Honda OEM', 'Castrol', 'Shell'],
  'Chain & Sprocket':        ['DID', 'RK Chain', 'JT Sprockets', 'Regina', 'Afam', 'EK Chain'],
  'Shock Absorbers (Front)': ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Toyota OEM'],
  'Shock Absorbers (Rear)':  ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Toyota OEM'],
  'Springs (Front)':         ['Toyota OEM', 'Honda OEM', 'Eibach', 'KYB'],
  'Springs (Rear)':          ['Toyota OEM', 'Honda OEM', 'Eibach', 'KYB'],
  'Ball Joints':             ['Toyota OEM', 'Honda OEM', 'Moog', 'Delphi', 'TRW'],
  'Tie Rod Ends':            ['Toyota OEM', 'Honda OEM', 'Moog', 'Delphi', 'TRW'],
  'Wheel Bearings':          ['NSK', 'SKF', 'NTN', 'Koyo', 'FAG', 'Toyota OEM', 'Honda OEM'],
  'Bush Replacement':        ['Toyota OEM', 'Honda OEM', 'Lemforder', 'Meyle'],
  'Sway Bar Links':          ['Toyota OEM', 'Honda OEM', 'Moog', 'Meyle'],
  'Power Steering Fluid':    ['Toyota OEM', 'Honda OEM', 'Castrol', 'Aisin'],
  'Power Steering Pump':     ['Toyota OEM', 'Honda OEM', 'Aisin', 'Bosch'],
  'Steering Rack':           ['Toyota OEM', 'Honda OEM', 'Aisin'],
  'Tyre Change':             ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop', 'Goodyear'],
  'Wheel Nuts & Bolts':      ['Toyota OEM', 'Honda OEM', 'McGard'],
  'Battery':                 ['Amaron', 'Exide', 'Bosch', 'Panasonic', 'GS Battery', 'Varta', 'Motolite'],
  'Alternator':              ['Denso', 'Bosch', 'Mitsubishi', 'Toyota OEM', 'Honda OEM'],
  'Starter Motor':           ['Denso', 'Bosch', 'Toyota OEM', 'Honda OEM'],
  'Headlights':              ['Philips', 'Osram', 'Bosch', 'Toyota OEM', 'Honda OEM'],
  'Tail Lights':             ['Philips', 'Osram', 'Toyota OEM', 'Honda OEM'],
  'Indicators':              ['Philips', 'Osram', 'Toyota OEM', 'Honda OEM'],
  'Horn':                    ['Bosch', 'Hella', 'Mitsuba', 'Denso', 'Toyota OEM'],
  'Sensors':                 ['Denso', 'Bosch', 'NTK', 'Toyota OEM', 'Honda OEM'],
  'AC Gas Refill':           ['R134a', 'R1234yf', 'R22 (old)'],
  'AC Compressor':           ['Denso', 'Sanden', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  'AC Condenser':            ['Denso', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  'AC Evaporator':           ['Denso', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  'Windscreen':              ['Pilkington', 'AGC', 'Saint-Gobain', 'Toyota OEM', 'Honda OEM'],
  'Wiper Blades':            ['Bosch', 'Denso', 'Piaa', 'Toyota OEM', 'Honda OEM'],
  'Door Handles':            ['Toyota OEM', 'Honda OEM'],
  'Mirrors':                 ['Toyota OEM', 'Honda OEM'],
  'Hydraulic Oil':           ['Castrol', 'Shell', 'Mobil', 'Total', 'Eneos'],
}

// Master category list — full, unfiltered
export const SERVICE_CATEGORIES = [
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
      'Full Service', 'Inspection', 'Emission Test / Carbon Test', 'Exhaust Service',
      'Muffler Repair', 'Seat / Upholstery',
      'Dashboard Repair', 'Audio System',
      'Modification', 'General Repair',
    ],
  },
]

export const CATEGORY_BRANDS: Record<string, string[]> = {
  'Engine & Oil':          ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline', 'Toyota OEM', 'Honda OEM', 'Denso', 'Bosch', 'NGK', 'Gates'],
  'Brakes':                ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'Honda OEM', 'TRW'],
  'Transmission & Drive':  ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM', 'Castrol', 'Shell'],
  'Steering & Suspension': ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Tyres & Wheels':        ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop'],
  'Electrical':            ['Amaron', 'Exide', 'Bosch', 'Panasonic', 'GS Battery', 'Varta', 'Denso'],
  'AC & Cooling':          ['Denso', 'Sanden', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Body & Exterior':       ['3M', 'Toyota OEM', 'Honda OEM'],
  'General & Other':       ['Toyota OEM', 'Honda OEM', 'Genuine Parts'],
}

// Items to exclude per vehicle type
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
    'Emission Test / Carbon Test',
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
    'Emission Test / Carbon Test',
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

// Extra items injected into specific categories per type
type ExtraItems = { categoryTitle: string; items: string[] }[]
const EXTRA_BY_TYPE: Partial<Record<string, ExtraItems>> = {
  'motorcycle':     [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'electric-cycle': [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'three-wheeler':  [{ categoryTitle: 'Transmission & Drive', items: ['Chain & Sprocket', 'Chain Lubrication'] }],
  'electric':       [{ categoryTitle: 'Electrical',           items: ['EV Battery Check'] }],
  'truck': [
    { categoryTitle: 'General & Other', items: ['Hydraulic Oil', 'Hydraulic Hoses'] },
  ],
  'heavy': [
    { categoryTitle: 'Engine & Oil',    items: ['Hydraulic Oil'] },
    { categoryTitle: 'General & Other', items: ['Hydraulic Hoses', 'Tracks Inspection', 'Undercarriage Service'] },
  ],
}

export function getServiceCategories(vehicleType?: string | null) {
  const excludeSet = vehicleType ? (EXCLUDE_BY_TYPE[vehicleType] ?? new Set<string>()) : new Set<string>()
  const extraItems = vehicleType ? (EXTRA_BY_TYPE[vehicleType] ?? []) : []

  return SERVICE_CATEGORIES
    .map(cat => {
      const filtered = cat.items.filter(item => !excludeSet.has(item))
      const extra = extraItems.find(e => e.categoryTitle === cat.title)
      const allItems = extra ? [...filtered, ...extra.items] : filtered
      return { ...cat, items: allItems }
    })
    .filter(cat => cat.items.length > 0)
}

export const todayDMY = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export const parseDMY = (str: string): string | null => {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const parsed = new Date(`${y}-${m}-${d}`)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
