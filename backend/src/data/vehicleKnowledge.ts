export type VehicleSpec = {
  id: string
  make: string
  model: string
  yearFrom: number
  yearTo: number | null      // null = still current
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng'
  engine?: string
  engineCapacityCC?: number
  // Oil
  oilGrade: string           // e.g. '0W-20'
  oilType: 'Full Synthetic' | 'Semi-Synthetic' | 'Mineral'
  oilCapacityL?: number
  oilChangeKm: number
  oilNote?: string           // e.g. 'JASO MA2 rated oil required'
  // Tyres
  tyreSizeFront: string
  tyreSizeRear?: string      // only if different from front
  // Timing
  timingType: 'belt' | 'chain' | 'gear-driven'
  timingBeltKm?: number      // only if belt
  // Coolant
  coolantType?: string       // e.g. 'Toyota SLLC (Pink, OAT long-life)'
  coolantFlushIntervalKm?: number
  // Transmission
  transmissionFluidType?: string   // e.g. 'Toyota ATF WS', 'Honda HCF-2', 'GL-4 75W-90'
  transmissionFluidIntervalKm?: number
  // Spark plugs (petrol/hybrid only)
  sparkPlugType?: string     // 'Iridium' | 'Platinum' | 'Standard'
  sparkPlugIntervalKm?: number
  // Brake fluid
  brakeFluidType?: string    // 'DOT 3' | 'DOT 4'
  brakeFluidIntervalDays?: number  // typically 730 (every 2 years)
  // Air filter
  airFilterIntervalKm?: number
  // Fuel economy (combined km/L, real-world Sri Lanka estimate)
  fuelEconomyKmL?: number
  // Common issues specific to Sri Lanka usage
  knownIssues: string[]
  notes?: string
}

export const VEHICLE_KNOWLEDGE: VehicleSpec[] = [

  // ── TOYOTA ──────────────────────────────────────────────────────────────────

  {
    id: 'toyota-prius-gen2',
    make: 'Toyota', model: 'Prius', yearFrom: 2003, yearTo: 2008,
    fuelType: 'hybrid', engine: '1NZ-FXE', engineCapacityCC: 1497,
    oilGrade: '5W-30', oilType: 'Full Synthetic', oilCapacityL: 3.9, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    coolantType: 'Toyota LLC (Red, long-life)',
    coolantFlushIntervalKm: 160000,
    transmissionFluidType: 'Toyota ATF WS (Transaxle)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 20,
    knownIssues: [
      'HV battery degradation after 120,000–150,000 km',
      'Inverter water pump failure — causes overheating warning',
      'Catalytic converter theft is common in Sri Lanka',
      'EPS (electric power steering) failure after high mileage',
    ],
    notes: 'Gen 2 Prius. Chain-driven — no timing belt replacement needed. Use genuine Toyota ATF WS for transaxle.',
  },

  {
    id: 'toyota-prius-gen3',
    make: 'Toyota', model: 'Prius', yearFrom: 2009, yearTo: 2015,
    fuelType: 'hybrid', engine: '2ZR-FXE', engineCapacityCC: 1797,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 4.4, oilChangeKm: 5000,
    tyreSizeFront: '195/60R16',
    timingType: 'chain',
    coolantType: 'Toyota SLLC (Pink, OAT long-life)',
    coolantFlushIntervalKm: 160000,
    transmissionFluidType: 'Toyota ATF WS (Transaxle)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 150000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 22,
    knownIssues: [
      'HV battery degradation after 150,000 km — costly replacement',
      'Inverter coolant pump failure — replace proactively at high mileage',
      'Oil consumption in high-mileage 2ZR engines',
      'EGR valve carbon buildup reducing fuel economy',
    ],
    notes: 'Gen 3 Prius. Strictly requires 0W-20 full synthetic — do not use 10W-40 or 20W-50. Chain-driven.',
  },

  {
    id: 'toyota-prius-gen4',
    make: 'Toyota', model: 'Prius', yearFrom: 2016, yearTo: null,
    fuelType: 'hybrid', engine: '2ZR-FXE', engineCapacityCC: 1797,
    oilGrade: '0W-16', oilType: 'Full Synthetic', oilCapacityL: 4.1, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    coolantType: 'Toyota SLLC (Pink, OAT long-life)',
    coolantFlushIntervalKm: 160000,
    transmissionFluidType: 'Toyota ATF WS (Transaxle)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 150000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 24,
    knownIssues: [
      'HV battery performance decline after 150,000+ km',
      'Inverter coolant pump requires monitoring',
    ],
    notes: 'Gen 4 Prius. Requires 0W-16 full synthetic — very low viscosity, do not substitute with thicker grades.',
  },

  {
    id: 'toyota-aqua',
    make: 'Toyota', model: 'Aqua', yearFrom: 2011, yearTo: 2021,
    fuelType: 'hybrid', engine: '1NZ-FXE', engineCapacityCC: 1497,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.7, oilChangeKm: 5000,
    tyreSizeFront: '175/65R15',
    timingType: 'chain',
    coolantType: 'Toyota LLC (Red, long-life)',
    coolantFlushIntervalKm: 160000,
    transmissionFluidType: 'Toyota ATF WS (Transaxle)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 22,
    knownIssues: [
      'HV battery wear after 100,000–120,000 km',
      'Fuel pump failure (TSB issued by Toyota)',
      'Inverter cooling pump failure',
    ],
    notes: 'Requires 0W-20 full synthetic. Chain-driven. Small coolant capacity — check level regularly.',
  },

  {
    id: 'toyota-corolla-e120',
    make: 'Toyota', model: 'Corolla', yearFrom: 2001, yearTo: 2006,
    fuelType: 'petrol', engine: '1ZZ-FE / 2ZZ-GE', engineCapacityCC: 1794,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.5, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    coolantType: 'Toyota LLC (Red)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Toyota T-IV ATF (Auto) / GL-4 75W-90 (Manual)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 13,
    knownIssues: [
      '1ZZ-FE oil consumption at high mileage — check level every 3,000 km',
      'VVT-i gear rattle on cold start if oil changes are delayed',
      'Head gasket failure in high-mileage 1ZZ engines',
    ],
  },

  {
    id: 'toyota-corolla-e140',
    make: 'Toyota', model: 'Corolla', yearFrom: 2007, yearTo: 2013,
    fuelType: 'petrol', engine: '1ZR-FE / 2ZR-FE', engineCapacityCC: 1598,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 4.0, oilChangeKm: 5000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    coolantType: 'Toyota LLC (Red, long-life)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Toyota ATF WS (Auto) / CVT Fluid (CVT)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 14,
    knownIssues: [
      'VVT-i oil feed pipe can crack — watch for oil leaks at front of engine',
      'Timing chain stretch if oil changes are delayed past interval',
    ],
  },

  {
    id: 'toyota-corolla-gen11',
    make: 'Toyota', model: 'Corolla', yearFrom: 2014, yearTo: null,
    fuelType: 'petrol', engine: '2ZR-FE / 2ZR-FAE (Valvematic)', engineCapacityCC: 1798,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 4.2, oilChangeKm: 10000,
    tyreSizeFront: '195/65R15',
    timingType: 'chain',
    coolantType: 'Toyota SLLC (Pink, OAT long-life)',
    coolantFlushIntervalKm: 160000,
    transmissionFluidType: 'Toyota ATF WS (Auto) / Super CVT-i (CVT)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 120000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 16,
    knownIssues: [
      'Valvematic actuator failure on 2ZR-FAE engines — symptoms include rough idle and MIL light',
      'CVT shudder on acceleration in high-mileage units — ensure CVT fluid changed every 80,000 km',
      'Oil consumption higher than spec if 0W-20 replaced with heavier grade — use manufacturer spec',
    ],
    notes: 'Gen 11 Corolla. Chain-driven — no timing belt. Toyota recommends 0W-20 full synthetic; using 5W-30 or 10W-40 is a common mistake in Sri Lanka and increases wear on Valvematic components.',
  },

  {
    id: 'toyota-axio',
    make: 'Toyota', model: 'Axio', yearFrom: 2006, yearTo: 2019,
    fuelType: 'petrol', engine: '1NZ-FE / 1NR-FE', engineCapacityCC: 1497,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.7, oilChangeKm: 5000,
    tyreSizeFront: '185/65R15',
    timingType: 'chain',
    coolantType: 'Toyota LLC (Red)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Toyota ATF WS (Auto) / CVT Fluid (CVT)',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 15,
    knownIssues: [
      'CVT fluid MUST be changed every 40,000 km — skipping causes shudder and slip',
      'VVT-i actuator noise on cold start if oil is overdue',
    ],
  },

  {
    id: 'toyota-kdh-hiace',
    make: 'Toyota', model: 'KDH HiAce', yearFrom: 2005, yearTo: 2019,
    fuelType: 'diesel', engine: '2KD-FTV / 1KD-FTV', engineCapacityCC: 2494,
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.4, oilChangeKm: 5000,
    tyreSizeFront: '195R14C',
    timingType: 'belt', timingBeltKm: 100000,
    coolantType: 'Toyota LLC (Red)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Toyota ATF WS (Auto)',
    transmissionFluidIntervalKm: 80000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 20000,
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
    fuelType: 'diesel', engine: '1KD-FTV', engineCapacityCC: 2982,
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.5, oilChangeKm: 5000,
    tyreSizeFront: '265/65R17',
    timingType: 'belt', timingBeltKm: 100000,
    coolantType: 'Toyota LLC (Red)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Toyota ATF WS (Auto) + Transfer Case: GL-4 75W-90',
    transmissionFluidIntervalKm: 40000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 20000,
    fuelEconomyKmL: 10,
    knownIssues: [
      'Head gasket failure on 1KD-FTV — known Toyota issue, watch coolant level closely',
      'EGR valve and DPF issues',
      'Timing belt must be changed at 100,000 km',
      'Transfer case oil must be changed every 40,000 km',
    ],
  },

  // ── HONDA ────────────────────────────────────────────────────────────────────

  {
    id: 'honda-vezel',
    make: 'Honda', model: 'Vezel', yearFrom: 2013, yearTo: 2021,
    fuelType: 'hybrid', engine: 'LEB / LEA', engineCapacityCC: 1496,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.4, oilChangeKm: 5000,
    tyreSizeFront: '215/55R17',
    timingType: 'chain',
    coolantType: 'Honda LLC (Blue, OAT long-life)',
    coolantFlushIntervalKm: 120000,
    transmissionFluidType: 'Honda DCT Fluid (Non-hybrid) / IMA — no change needed',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 19,
    knownIssues: [
      'IMA/hybrid battery degradation in older units',
      'CVT/DCT jerking on low-speed manoeuvres — software update available',
      'AC compressor failures reported at high mileage',
      'Fuel pump assembly failure on some 2014–2016 units',
    ],
    notes: 'Strictly requires 0W-20 full synthetic. Do not use conventional oil.',
  },

  {
    id: 'honda-fit-jazz-ge',
    make: 'Honda', model: 'Fit / Jazz', yearFrom: 2008, yearTo: 2014,
    fuelType: 'petrol', engine: 'L13A / L15A', engineCapacityCC: 1339,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.1, oilChangeKm: 5000,
    tyreSizeFront: '175/65R15',
    timingType: 'chain',
    coolantType: 'Honda LLC (Blue, OAT long-life)',
    coolantFlushIntervalKm: 120000,
    transmissionFluidType: 'Honda CVT Fluid HCF-2',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 16,
    knownIssues: [
      'CVT shudder at 80,000–100,000 km if CVT fluid not changed regularly',
      'Fuel injector O-ring leaks causing rough idle',
      'Use Honda genuine 0W-20 or equivalent — do not use 10W-40',
    ],
  },

  {
    id: 'honda-city-gm1',
    make: 'Honda', model: 'City', yearFrom: 2003, yearTo: 2008,
    fuelType: 'petrol', engine: 'L13A / L15A', engineCapacityCC: 1497,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.5, oilChangeKm: 5000,
    tyreSizeFront: '185/55R15',
    timingType: 'chain',
    coolantType: 'Honda LLC (Blue)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Honda ATF Z1 (Auto)',
    transmissionFluidIntervalKm: 80000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 14,
    knownIssues: [
      'Timing chain tensioner rattle on cold start — common in high-mileage units',
      'Valve stem seal leaks causing blue smoke on startup',
      'Automatic transmission judder if ATF not changed regularly',
    ],
  },

  {
    id: 'honda-city-gm6',
    make: 'Honda', model: 'City', yearFrom: 2014, yearTo: null,
    fuelType: 'petrol', engine: 'L15Z1', engineCapacityCC: 1497,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 3.6, oilChangeKm: 5000,
    tyreSizeFront: '185/55R16',
    timingType: 'chain',
    coolantType: 'Honda LLC (Blue, OAT long-life)',
    coolantFlushIntervalKm: 120000,
    transmissionFluidType: 'Honda CVT Fluid HCF-2',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 16,
    knownIssues: [
      'CVT fluid change critical at 40,000 km intervals',
      'Earth strap corrosion causing electrical gremlins in humid conditions',
    ],
    notes: 'Requires 0W-20 full synthetic. CVT fluid change is the most important maintenance item.',
  },

  // ── SUZUKI ───────────────────────────────────────────────────────────────────

  {
    id: 'suzuki-alto-ha25',
    make: 'Suzuki', model: 'Alto', yearFrom: 2009, yearTo: 2018,
    fuelType: 'petrol', engine: 'K10B', engineCapacityCC: 998,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 2.7, oilChangeKm: 5000,
    tyreSizeFront: '145/80R13',
    timingType: 'chain',
    coolantType: 'Suzuki LLC (Ethylene glycol)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Suzuki CVT Fluid NS-2 or NS-3',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
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
    fuelType: 'petrol', engine: 'K10B / K12B', engineCapacityCC: 998,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.0, oilChangeKm: 5000,
    tyreSizeFront: '155/65R13',
    timingType: 'chain',
    coolantType: 'Suzuki LLC (Ethylene glycol)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Suzuki CVT Fluid NS-2 or NS-3',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
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
    fuelType: 'petrol', engine: 'M13A / M15A', engineCapacityCC: 1328,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.3, oilChangeKm: 5000,
    tyreSizeFront: '185/55R15',
    timingType: 'chain',
    coolantType: 'Suzuki LLC (Ethylene glycol)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Suzuki CVT Fluid NS-2 (CVT) / GL-4 75W-90 (Manual)',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Standard',
    sparkPlugIntervalKm: 30000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 15,
    knownIssues: [
      'Timing chain stretch at high mileage if oil changes are skipped',
      'Oil consumption (M13A) — check level every 5,000 km',
      'Front wheel bearing wear on high-mileage units',
    ],
  },

  {
    id: 'suzuki-swift-zc72',
    make: 'Suzuki', model: 'Swift', yearFrom: 2011, yearTo: 2017,
    fuelType: 'petrol', engine: 'K12B', engineCapacityCC: 1242,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 3.4, oilChangeKm: 5000,
    tyreSizeFront: '185/55R15',
    timingType: 'chain',
    coolantType: 'Suzuki LLC (Ethylene glycol)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Suzuki CVT Fluid NS-3 (CVT) / GL-4 75W-90 (Manual)',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
    fuelEconomyKmL: 16,
    knownIssues: [
      'CVT shudder if fluid change is delayed past 40,000 km',
      'Throttle body deposits causing rough idle after 60,000 km',
    ],
  },

  // ── MITSUBISHI ────────────────────────────────────────────────────────────────

  {
    id: 'mitsubishi-l300',
    make: 'Mitsubishi', model: 'L300', yearFrom: 1986, yearTo: 2007,
    fuelType: 'diesel', engine: '4D56', engineCapacityCC: 2477,
    oilGrade: '15W-40', oilType: 'Mineral', oilCapacityL: 5.5, oilChangeKm: 5000,
    tyreSizeFront: '195R14C',
    timingType: 'belt', timingBeltKm: 60000,
    coolantType: 'Standard ethylene glycol (green)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'GL-4 75W-90 (Manual gearbox)',
    transmissionFluidIntervalKm: 80000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 15000,
    fuelEconomyKmL: 10,
    knownIssues: [
      'Timing belt MUST be changed at 60,000 km — interference engine, failure destroys the engine',
      'Turbo oil seal failure at high mileage causing blue smoke',
      'Fuel injection pump wear — use good quality diesel only',
      'Head gasket failure if engine has ever been overheated',
      'Intercooler hose failure on turbo models',
    ],
    notes: 'The 4D56 is reliable if timing belt is serviced on schedule. Never skip or delay.',
  },

  {
    id: 'mitsubishi-montero',
    make: 'Mitsubishi', model: 'Montero / Pajero', yearFrom: 2000, yearTo: 2012,
    fuelType: 'diesel', engine: '4M41', engineCapacityCC: 3200,
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 7.0, oilChangeKm: 5000,
    tyreSizeFront: '265/70R16',
    timingType: 'belt', timingBeltKm: 100000,
    coolantType: 'Standard ethylene glycol (green)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Mitsubishi ATF SP-III (Auto) + Transfer Case GL-4 75W-90',
    transmissionFluidIntervalKm: 40000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 20000,
    fuelEconomyKmL: 9,
    knownIssues: [
      'Transfer case oil must be changed every 40,000 km',
      'Timing belt replacement at 100,000 km — interference engine',
      'Front differential seal leaks are common on high-mileage units',
      'EGR valve carbon buildup causes power loss',
    ],
  },

  // ── NISSAN ────────────────────────────────────────────────────────────────────

  {
    id: 'nissan-dayz',
    make: 'Nissan', model: 'Dayz', yearFrom: 2013, yearTo: 2019,
    fuelType: 'petrol', engine: 'BR06DE', engineCapacityCC: 659,
    oilGrade: '0W-20', oilType: 'Full Synthetic', oilCapacityL: 2.7, oilChangeKm: 5000,
    tyreSizeFront: '155/65R14',
    timingType: 'chain',
    coolantType: 'Nissan LLC (Blue, OAT)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Nissan CVT Fluid NS-3',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
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
    fuelType: 'diesel', engine: 'DTC 4-stroke diesel', engineCapacityCC: 205,
    oilGrade: '20W-50', oilType: 'Mineral', oilCapacityL: 1.5, oilChangeKm: 3000,
    tyreSizeFront: '4.00-8',
    timingType: 'gear-driven',
    transmissionFluidType: 'Gear oil SAE 90 (separate gearbox)',
    transmissionFluidIntervalKm: 20000,
    sparkPlugType: 'Standard',
    sparkPlugIntervalKm: 10000,
    airFilterIntervalKm: 5000,
    fuelEconomyKmL: 25,
    knownIssues: [
      'Crankshaft bearing wear — check oil level every week due to small capacity',
      'Fuel injection pump wear on high-mileage units',
      'Electrical wiring issues — fuse box corrosion common in wet conditions',
      'Gearbox oil leaks at the output shaft seal',
    ],
    notes: 'Oil changes every 3,000 km are critical — small capacity means faster contamination.',
  },

  {
    id: 'tvs-king',
    make: 'TVS', model: 'King (Three-Wheeler)', yearFrom: 2010, yearTo: null,
    fuelType: 'petrol', engine: 'DXi 200 4-stroke', engineCapacityCC: 199,
    oilGrade: '20W-50', oilType: 'Mineral', oilCapacityL: 1.1, oilChangeKm: 3000,
    tyreSizeFront: '4.00-8',
    timingType: 'gear-driven',
    transmissionFluidType: 'Gear oil SAE 90',
    transmissionFluidIntervalKm: 20000,
    sparkPlugType: 'Standard',
    sparkPlugIntervalKm: 8000,
    airFilterIntervalKm: 5000,
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
    fuelType: 'petrol', engine: 'YD115 / 149cc', engineCapacityCC: 149,
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 1.0, oilChangeKm: 3000,
    oilNote: 'JASO MA or MA2 rated oil only — standard car oil is not suitable (no wet clutch additive)',
    tyreSizeFront: '100/80-17', tyreSizeRear: '140/60-17',
    timingType: 'chain',
    sparkPlugType: 'Standard (NGK CR8E)',
    sparkPlugIntervalKm: 12000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 10000,
    fuelEconomyKmL: 35,
    knownIssues: [
      'Chain and sprocket wear if chain lubrication is skipped every 700 km',
      'Fuel injector deposits on FI version reduce performance over time',
      'Fork seal leaks after 40,000 km',
    ],
    notes: 'JASO MA2 rated oil is mandatory. Standard car oil will damage the wet clutch.',
  },

  {
    id: 'honda-cb150r',
    make: 'Honda', model: 'CB150R', yearFrom: 2015, yearTo: null,
    fuelType: 'petrol', engine: 'CB150R 4-valve', engineCapacityCC: 150,
    oilGrade: '10W-40', oilType: 'Semi-Synthetic', oilCapacityL: 1.2, oilChangeKm: 3000,
    oilNote: 'JASO MA2 rated oil required for wet clutch compatibility',
    tyreSizeFront: '100/80-17', tyreSizeRear: '130/70-17',
    timingType: 'chain',
    sparkPlugType: 'Standard (NGK DCPR8E)',
    sparkPlugIntervalKm: 8000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 10000,
    fuelEconomyKmL: 38,
    knownIssues: [
      'Cam chain tensioner noise on cold start if oil is overdue',
      'Chain stretch if not lubricated every 500–700 km',
    ],
    notes: 'Honda recommends Honda HP4 or JASO MA2 equivalent.',
  },

  // ── PERODUA ────────────────────────────────────────────────────────────────────

  {
    id: 'perodua-axia',
    make: 'Perodua', model: 'Axia', yearFrom: 2014, yearTo: null,
    fuelType: 'petrol', engine: '1KR-DE', engineCapacityCC: 998,
    oilGrade: '5W-30', oilType: 'Semi-Synthetic', oilCapacityL: 2.9, oilChangeKm: 5000,
    tyreSizeFront: '155/65R14',
    timingType: 'chain',
    coolantType: 'Standard ethylene glycol (green)',
    coolantFlushIntervalKm: 80000,
    transmissionFluidType: 'Daihatsu CVT Fluid TC (CVT) / GL-4 75W-90 (Manual)',
    transmissionFluidIntervalKm: 40000,
    sparkPlugType: 'Iridium',
    sparkPlugIntervalKm: 100000,
    brakeFluidType: 'DOT 3',
    brakeFluidIntervalDays: 730,
    airFilterIntervalKm: 30000,
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
  // Parentheses added — AND must bind tighter than the OR for model matching
  const candidates = VEHICLE_KNOWLEDGE.filter(v =>
    lc(v.make) === lc(make) &&
    (lc(v.model).includes(lc(model)) || lc(model).includes(lc(v.model)))
  )
  if (candidates.length === 0) return null
  if (!year) return candidates[0]
  const exact = candidates.find(v => year >= v.yearFrom && (v.yearTo === null || year <= v.yearTo))
  return exact || candidates[0]
}
