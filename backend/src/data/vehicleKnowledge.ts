export type VehicleSpec = {
  id: string
  make: string
  model: string
  yearFrom: number
  yearTo: number | null      // null = still current
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng'
  engine?: string
  // Oil
  oilGrade: string           // e.g. '0W-20'
  oilType: 'Full Synthetic' | 'Semi-Synthetic' | 'Mineral'
  oilCapacityL?: number
  oilChangeKm: number
  // Tyres
  tyreSizeFront: string
  tyreSizeRear?: string      // only if different from front
  // Timing
  timingType: 'belt' | 'chain' | 'gear-driven'
  timingBeltKm?: number      // only if belt
  // Fuel economy (combined km/L)
  fuelEconomyKmL?: number
  // Common issues specific to Sri Lanka usage
  knownIssues: string[]
  notes?: string
}

export const VEHICLE_KNOWLEDGE: VehicleSpec[] = [

  // ── TOYOTA ──────────────────────────────────────────────────────────────────

  {
    id: 'toyota-prius-gen2',
    make: 'Toyota', model: 'Prius', yearFrom: 2003, yearTo: 2009,
    fuelType: 'hybrid', engine: '1NZ-FXE',
    oilGrade: '5W-30', oilType: 'Full Synthetic', oilCapacityL: 3.9, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 20,
    knownIssues: [
      'HV battery degradation after 120,000–150,000 km',
      'Inverter water pump failure — causes overheating warning',
      'Catalytic converter theft is common in Sri Lanka',
      'EPS (electric power steering) failure after high mileage',
    ],
    notes: 'Gen 2 Prius. Chain-driven — no timing belt replacement needed. Use genuine Toyota ATF for transaxle.',
  },
  {
    id: 'toyota-prius-gen3',
    make: 'Toyota', model: 'Prius', yearFrom: 2009, yearTo: 2015,
    fuelType: 'hybrid', engine: '2ZR-FXE',
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 4.4, oilChangeKm: 5000,
    tyreSizeFront: '195/60R16',
    timingType: 'chain',
    fuelEconomyKmL: 22,
    knownIssues: [
      'HV battery degradation after 150,000 km — costly replacement',
      'Inverter coolant pump failure',
      'Oil consumption in high-mileage engines',
      'EGR valve carbon buildup reducing fuel economy',
    ],
    notes: 'Gen 3 Prius. Strictly requires 0W-20 full synthetic — do not use 10W-40 or 20W-50.',
  },
  {
    id: 'toyota-aqua',
    make: 'Toyota', model: 'Aqua', yearFrom: 2011, yearTo: 2021,
    fuelType: 'hybrid', engine: '1NZ-FXE',
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.7, oilChangeKm: 5000,
    tyreSizeFront: '175/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 22,
    knownIssues: [
      'HV battery wear after 100,000–120,000 km',
      'Fuel pump failure (TSB issued by Toyota)',
      'Inverter cooling pump failure',
    ],
    notes: 'Requires 0W-20 full synthetic. Chain driven.',
  },
  {
    id: 'toyota-corolla-e120',
    make: 'Toyota', model: 'Corolla', yearFrom: 2001, yearTo: 2007,
    fuelType: 'petrol', engine: '1ZZ-FE / 2ZZ-GE',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.5, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 13,
    knownIssues: [
      '1ZZ-FE oil consumption at high mileage — check level frequently',
      'VVT-i gear rattle on cold start if oil changes are delayed',
      'Head gasket failure in high-mileage 1ZZ engines',
    ],
  },
  {
    id: 'toyota-corolla-e140',
    make: 'Toyota', model: 'Corolla', yearFrom: 2007, yearTo: 2013,
    fuelType: 'petrol', engine: '1ZR-FE / 2ZR-FE',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 4.0, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 14,
    knownIssues: [
      'VVT-i oil feed pipe can crack — watch for oil leaks at front of engine',
      'Timing chain stretch if oil changes are delayed past interval',
    ],
  },
  {
    id: 'toyota-axio',
    make: 'Toyota', model: 'Axio', yearFrom: 2006, yearTo: 2019,
    fuelType: 'petrol', engine: '1NZ-FE / 1NR-FE',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.7, oilChangeKm: 5000,
    tyreSizeFront: '185/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 15,
    knownIssues: [
      'CVT fluid must be changed every 40,000 km — skipping causes shudder and slip',
      'VVT-i actuator noise on cold start if oil is overdue',
    ],
  },
  {
    id: 'toyota-kdh-hiace',
    make: 'Toyota', model: 'KDH HiAce', yearFrom: 2005, yearTo: 2019,
    fuelType: 'diesel', engine: '2KD-FTV / 1KD-FTV',
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.4, oilChangeKm: 5000,
    tyreSizeFront: '195R14C',
    timingType: 'belt', timingBeltKm: 100000,
    fuelEconomyKmL: 11,
    knownIssues: [
      'EGR valve clogging — common in Sri Lanka city driving, causes black smoke',
      'Fuel injector seal leaks (O-ring failure)',
      'Timing belt MUST be changed at 100,000 km — interference engine, failure is catastrophic',
      'DPF blockage on post-2011 models if driven mostly in city',
      'Crankshaft pulley bolt loosening on high-mileage 2KD engines',
    ],
    notes: 'Timing belt is critical — do not miss. Use quality diesel fuel to protect injectors.',
  },
  {
    id: 'toyota-land-cruiser-prado',
    make: 'Toyota', model: 'Land Cruiser Prado', yearFrom: 2003, yearTo: 2009,
    fuelType: 'diesel', engine: '1KD-FTV',
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.5, oilChangeKm: 5000,
    tyreSizeFront: '265/65R17',
    timingType: 'belt', timingBeltKm: 100000,
    fuelEconomyKmL: 10,
    knownIssues: [
      'Head gasket failure on 1KD-FTV — known Toyota issue, watch coolant level',
      'EGR valve and DPF issues',
      'Timing belt must be changed at 100,000 km',
      'Transfer case oil must be changed every 40,000 km',
    ],
  },

  // ── HONDA ────────────────────────────────────────────────────────────────────

  {
    id: 'honda-vezel',
    make: 'Honda', model: 'Vezel', yearFrom: 2013, yearTo: 2021,
    fuelType: 'hybrid', engine: 'LEB / LEA',
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.4, oilChangeKm: 5000,
    tyreSizeFront: '215/55R17',
    timingType: 'chain',
    fuelEconomyKmL: 19,
    knownIssues: [
      'IMA/hybrid battery degradation in older units',
      'CVT (7-speed DCT) jerking on low-speed manoeuvres — software update available',
      'AC compressor failures reported at high mileage',
      'Fuel pump assembly failure on some 2014–2016 units',
    ],
    notes: 'Strictly requires 0W-20 full synthetic. Do not use conventional oil.',
  },
  {
    id: 'honda-fit-jazz-ge',
    make: 'Honda', model: 'Fit / Jazz', yearFrom: 2008, yearTo: 2014,
    fuelType: 'petrol', engine: 'L13A / L15A',
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.1, oilChangeKm: 5000,
    tyreSizeFront: '175/65R15',
    timingType: 'chain',
    fuelEconomyKmL: 16,
    knownIssues: [
      'CVT shudder at 80,000–100,000 km if CVT fluid not changed regularly',
      'Fuel injector O-ring leaks causing rough idle',
      'Honda genuine 0W-20 or equivalent recommended — do not use 10W-40',
    ],
  },
  {
    id: 'honda-city-gm1',
    make: 'Honda', model: 'City', yearFrom: 2003, yearTo: 2008,
    fuelType: 'petrol', engine: 'L13A / L15A',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.5, oilChangeKm: 5000,
    tyreSizeFront: '185/55R15',
    timingType: 'chain',
    fuelEconomyKmL: 14,
    knownIssues: [
      'Timing chain tensioner rattle on cold start — common in high-mileage units',
      'Valve stem seal leaks causing blue smoke on startup',
      'Automatic transmission judder if ATF not changed',
    ],
  },

  // ── SUZUKI ───────────────────────────────────────────────────────────────────

  {
    id: 'suzuki-alto-ha25',
    make: 'Suzuki', model: 'Alto', yearFrom: 2009, yearTo: 2018,
    fuelType: 'petrol', engine: 'K10B',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 2.7, oilChangeKm: 5000,
    tyreSizeFront: '145/80R13',
    timingType: 'chain',
    fuelEconomyKmL: 20,
    knownIssues: [
      'CVT fluid degradation — must change every 40,000 km',
      'Engine mount wear causes vibration at idle',
      'Turbo oil feed pipe (turbo model) can crack — watch for oil burn smell',
    ],
  },
  {
    id: 'suzuki-wagon-r',
    make: 'Suzuki', model: 'Wagon R', yearFrom: 2008, yearTo: 2017,
    fuelType: 'petrol', engine: 'K10B / K12B',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.0, oilChangeKm: 5000,
    tyreSizeFront: '155/65R13',
    timingType: 'chain',
    fuelEconomyKmL: 19,
    knownIssues: [
      'CVT issues if fluid is not changed every 40,000 km',
      'Stiff idle and rough running if throttle body is dirty',
      'Turbo version: intercooler hose connections can loosen over time',
    ],
  },
  {
    id: 'suzuki-swift-zc11',
    make: 'Suzuki', model: 'Swift', yearFrom: 2004, yearTo: 2010,
    fuelType: 'petrol', engine: 'M13A / M15A',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.3, oilChangeKm: 5000,
    tyreSizeFront: '185/55R15',
    timingType: 'chain',
    fuelEconomyKmL: 15,
    knownIssues: [
      'Timing chain stretch at high mileage if oil changes are skipped',
      'Oil consumption (M13A) — check level every 5,000 km',
      'Front wheel bearing wear on high-mileage units',
    ],
  },

  // ── MITSUBISHI ────────────────────────────────────────────────────────────────

  {
    id: 'mitsubishi-l300',
    make: 'Mitsubishi', model: 'L300', yearFrom: 1986, yearTo: 2007,
    fuelType: 'diesel', engine: '4D56',
    oilGrade: '15W-40', oilType: 'Mineral', oilCapacityL: 5.5, oilChangeKm: 5000,
    tyreSizeFront: '195R14C',
    timingType: 'belt', timingBeltKm: 60000,
    fuelEconomyKmL: 10,
    knownIssues: [
      'Timing belt MUST be changed at 60,000 km — interference engine',
      'Turbo oil seal failure at high mileage causing blue smoke',
      'Fuel injection pump wear — use good quality diesel',
      'Head gasket failure if overheated even once',
      'Intercooler hose failure on turbo models',
    ],
    notes: 'The 4D56 engine is reliable if timing belt is serviced on schedule. Never skip.',
  },
  {
    id: 'mitsubishi-montero',
    make: 'Mitsubishi', model: 'Montero / Pajero', yearFrom: 2000, yearTo: 2012,
    fuelType: 'diesel', engine: '4M41',
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.0, oilChangeKm: 5000,
    tyreSizeFront: '265/70R16',
    timingType: 'belt', timingBeltKm: 100000,
    fuelEconomyKmL: 9,
    knownIssues: [
      'Transfer case oil must be changed every 40,000 km',
      'Timing belt replacement at 100,000 km — interference engine',
      'Front differential seal leaks are common',
      'EGR valve carbon buildup',
    ],
  },

  // ── NISSAN ────────────────────────────────────────────────────────────────────

  {
    id: 'nissan-dayz',
    make: 'Nissan', model: 'Dayz', yearFrom: 2013, yearTo: 2019,
    fuelType: 'petrol', engine: 'BR06DE',
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 2.7, oilChangeKm: 5000,
    tyreSizeFront: '155/65R14',
    timingType: 'chain',
    fuelEconomyKmL: 21,
    knownIssues: [
      'CVT judder and slip if CVT fluid not changed every 40,000 km',
      'Turbo model: intercooler hose connections loosen over time',
    ],
    notes: 'Uses 0W-20 full synthetic. Very small oil capacity — do not overfill.',
  },

  // ── THREE-WHEELERS ────────────────────────────────────────────────────────────

  {
    id: 'bajaj-re',
    make: 'Bajaj', model: 'RE (Three-Wheeler)', yearFrom: 2000, yearTo: null,
    fuelType: 'diesel', engine: 'DTC 4-stroke diesel',
    oilGrade: '20W-50', oilType: 'Mineral', oilCapacityL: 1.5, oilChangeKm: 3000,
    tyreSizeFront: '4.00-8',
    timingType: 'gear-driven',
    fuelEconomyKmL: 25,
    knownIssues: [
      'Crankshaft bearing wear — check oil level every week due to small capacity',
      'Fuel injection pump wear on high-mileage units',
      'Electrical wiring issues — fuse box corrosion common in wet conditions',
      'Gearbox oil leaks at the output shaft seal',
    ],
    notes: 'Oil changes every 3,000 km are critical — small oil capacity means faster contamination.',
  },
  {
    id: 'tvs-king',
    make: 'TVS', model: 'King (Three-Wheeler)', yearFrom: 2010, yearTo: null,
    fuelType: 'petrol', engine: 'DXi 200 4-stroke',
    oilGrade: '20W-50', oilType: 'Mineral', oilCapacityL: 1.1, oilChangeKm: 3000,
    tyreSizeFront: '4.00-8',
    timingType: 'gear-driven',
    fuelEconomyKmL: 30,
    knownIssues: [
      'Carburetor jets clogging with dirty fuel — clean every 20,000 km',
      'Gearbox bearing wear at high mileage',
      'Battery drain if vehicle not used daily',
    ],
  },

  // ── MOTORCYCLES ────────────────────────────────────────────────────────────────

  {
    id: 'yamaha-fz',
    make: 'Yamaha', model: 'FZ', yearFrom: 2008, yearTo: null,
    fuelType: 'petrol', engine: 'YD115 / 149cc',
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 1.0, oilChangeKm: 3000,
    tyreSizeFront: '100/80-17', tyreSizeRear: '140/60-17',
    timingType: 'chain',
    fuelEconomyKmL: 35,
    knownIssues: [
      'Chain and sprocket wear if chain lubrication is skipped',
      'Fuel injector deposits on FI version reduce performance',
      'Fork seal leaks after 40,000 km',
    ],
    notes: 'Use JASO MA or MA2 rated oil only — standard car oil is not suitable.',
  },
  {
    id: 'honda-cb150r',
    make: 'Honda', model: 'CB150R', yearFrom: 2015, yearTo: null,
    fuelType: 'petrol', engine: 'CB150R 4-valve',
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 1.2, oilChangeKm: 3000,
    tyreSizeFront: '100/80-17', tyreSizeRear: '130/70-17',
    timingType: 'chain',
    fuelEconomyKmL: 38,
    knownIssues: [
      'Cam chain tensioner noise on cold start if oil is overdue',
      'Chain stretch if not lubricated every 500–700 km',
    ],
    notes: 'Use JASO MA2 rated oil. Honda recommends Honda HP4 or equivalent.',
  },

  // ── PERODUA ────────────────────────────────────────────────────────────────────

  {
    id: 'perodua-axia',
    make: 'Perodua', model: 'Axia', yearFrom: 2014, yearTo: null,
    fuelType: 'petrol', engine: '1KR-DE',
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 2.9, oilChangeKm: 5000,
    tyreSizeFront: '155/65R14',
    timingType: 'chain',
    fuelEconomyKmL: 20,
    knownIssues: [
      'CVT shudder if fluid not changed at 40,000 km intervals',
      'AC compressor failures reported after 80,000 km',
      'Rear brake drum adjustment needed every 20,000 km',
    ],
  },
]

export function findBestMatch(make: string, model: string, year?: number): VehicleSpec | null {
  const lc = (s: string) => s.toLowerCase().trim()
  const candidates = VEHICLE_KNOWLEDGE.filter(v =>
    lc(v.make) === lc(make) &&
    lc(v.model).includes(lc(model)) || lc(model).includes(lc(v.model))
  )
  if (candidates.length === 0) return null
  if (!year) return candidates[0]
  // Prefer exact year range match
  const exact = candidates.find(v => year >= v.yearFrom && (v.yearTo === null || year <= v.yearTo))
  return exact || candidates[0]
}
