export type SelectedItem = {
  name: string
  category: string
  brand: string
}

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
}

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
      'Full Service', 'Inspection', 'Exhaust Service',
      'Muffler Repair', 'Seat / Upholstery',
      'Dashboard Repair', 'Audio System',
      'Modification', 'General Repair',
    ],
  },
]

export const CATEGORY_BRANDS: Record<string, string[]> = {
  'Engine & Oil': ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline', 'Toyota OEM', 'Honda OEM', 'Denso', 'Bosch', 'NGK', 'Gates'],
  'Brakes': ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'Honda OEM', 'TRW'],
  'Transmission & Drive': ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM', 'Castrol', 'Shell'],
  'Steering & Suspension': ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Tyres & Wheels': ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop'],
  'Electrical': ['Amaron', 'Exide', 'Bosch', 'Panasonic', 'GS Battery', 'Varta', 'Denso'],
  'AC & Cooling': ['Denso', 'Sanden', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Body & Exterior': ['3M', 'Toyota OEM', 'Honda OEM'],
  'General & Other': ['Toyota OEM', 'Honda OEM', 'Genuine Parts'],
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
