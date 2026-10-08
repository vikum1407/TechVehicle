// duplicate of backend/src/data/martCategories.ts — keep in sync, ids identical, never
// rename (add new ones instead). Spec: 02-data-model.md §8.3 — ids and English labels are
// final (Vikum approved 2026-10-05). Keywords are a first-pass list (common English terms
// plus a few known misspellings, e.g. "break" for "brake"); si/ta category labels are a
// first-pass translation — both flagged for Vikum's review in docs/mart/DECISIONS-MADE.md.
export type MartCategoryType = { id: string; en: string; keywords: string[] }
export type MartCategory = {
  id: string
  en: string
  si?: string
  ta?: string
  examples: string
  keywords: string[]
  types: MartCategoryType[]
}

export const MART_CATEGORIES: MartCategory[] = [
  {
    id: 'engine', en: 'Engine', si: 'එන්ජිම', ta: 'இன்ஜின்',
    examples: 'Pistons, gaskets, belts, pumps',
    keywords: ['engine', 'motor'],
    types: [
      { id: 'engine_assembly', en: 'Engine assembly', keywords: ['engine assembly', 'complete engine', 'full engine'] },
      { id: 'cylinder_head_gasket', en: 'Cylinder head / gasket set', keywords: ['cylinder head', 'gasket', 'head gasket', 'gasket set'] },
      { id: 'pistons_rings', en: 'Pistons and rings', keywords: ['piston', 'piston rings', 'ring set'] },
      { id: 'timing_belt_chain', en: 'Timing belt / chain', keywords: ['timing belt', 'timing chain', 'cam belt'] },
      { id: 'oil_pump_sump', en: 'Oil pump / sump', keywords: ['oil pump', 'sump', 'oil pan'] },
      { id: 'water_pump', en: 'Water pump', keywords: ['water pump'] },
      { id: 'fuel_pump', en: 'Fuel pump', keywords: ['fuel pump', 'petrol pump'] },
      { id: 'injectors', en: 'Injectors', keywords: ['injector', 'fuel injector', 'injection'] },
      { id: 'turbo_intercooler', en: 'Turbo / intercooler', keywords: ['turbo', 'turbocharger', 'intercooler'] },
      { id: 'engine_mounts', en: 'Engine mounts', keywords: ['engine mount', 'mounting', 'motor mount'] },
      { id: 'exhaust_catalytic', en: 'Exhaust / catalytic converter', keywords: ['exhaust', 'muffler', 'silencer', 'catalytic converter'] },
      { id: 'spark_plugs_coils', en: 'Spark plugs / coils', keywords: ['spark plug', 'ignition coil', 'plug'] },
      { id: 'belts_pulleys', en: 'Belts and pulleys', keywords: ['fan belt', 'v belt', 'pulley', 'drive belt'] },
    ],
  },
  {
    id: 'brakes', en: 'Brakes', si: 'බ්‍රේක්', ta: 'பிரேக்',
    examples: 'Pads, discs, calipers, drums',
    keywords: ['brake', 'break'],
    types: [
      { id: 'brake_pads', en: 'Brake pads', keywords: ['brake pad', 'break pad', 'pads'] },
      { id: 'brake_discs', en: 'Brake discs', keywords: ['brake disc', 'disc rotor', 'rotor'] },
      { id: 'brake_calipers', en: 'Brake calipers', keywords: ['caliper', 'brake caliper'] },
      { id: 'drums_shoes', en: 'Drums and shoes', keywords: ['brake drum', 'brake shoe', 'drum brake'] },
      { id: 'master_cylinder', en: 'Master cylinder', keywords: ['master cylinder', 'brake cylinder'] },
      { id: 'abs_sensor_module', en: 'ABS sensor / module', keywords: ['abs sensor', 'abs module', 'abs'] },
      { id: 'handbrake_parts', en: 'Handbrake parts', keywords: ['handbrake', 'hand brake', 'parking brake'] },
      { id: 'brake_hoses_lines', en: 'Brake hoses / lines', keywords: ['brake hose', 'brake line', 'brake pipe'] },
    ],
  },
  {
    id: 'suspension_steering', en: 'Suspension and Steering', si: 'සස්පෙන්ෂන් සහ ස්ටියරින්', ta: 'சஸ்பென்ஷன் மற்றும் ஸ்டியரிங்',
    examples: 'Shocks, arms, bushes, racks',
    keywords: ['suspension', 'steering'],
    types: [
      { id: 'shock_absorbers', en: 'Shock absorbers', keywords: ['shock absorber', 'shocker', 'shock'] },
      { id: 'springs', en: 'Springs', keywords: ['coil spring', 'leaf spring', 'spring'] },
      { id: 'control_arms', en: 'Control arms', keywords: ['control arm', 'wishbone', 'lower arm'] },
      { id: 'ball_joints_bushes', en: 'Ball joints / bushes', keywords: ['ball joint', 'bush', 'bushing'] },
      { id: 'stabilizer_links', en: 'Stabilizer links', keywords: ['stabilizer link', 'sway bar link', 'link rod'] },
      { id: 'steering_rack', en: 'Steering rack', keywords: ['steering rack', 'rack and pinion'] },
      { id: 'power_steering_pump', en: 'Power steering pump', keywords: ['power steering pump', 'steering pump'] },
      { id: 'tie_rods', en: 'Tie rods', keywords: ['tie rod', 'tie rod end'] },
      { id: 'wheel_bearings', en: 'Wheel bearings', keywords: ['wheel bearing', 'hub bearing'] },
    ],
  },
  {
    id: 'electrical_lighting', en: 'Electrical and Lighting', si: 'විදුලි සහ ලයිට්', ta: 'மின் மற்றும் விளக்கு',
    examples: 'Batteries, alternators, bulbs, lamps',
    keywords: ['electrical', 'lighting'],
    types: [
      { id: 'battery', en: 'Battery', keywords: ['battery', 'car battery'] },
      { id: 'alternator', en: 'Alternator', keywords: ['alternator', 'dynamo'] },
      { id: 'starter_motor', en: 'Starter motor', keywords: ['starter motor', 'starter'] },
      { id: 'headlights', en: 'Headlights', keywords: ['headlight', 'head lamp'] },
      { id: 'tail_lights', en: 'Tail lights', keywords: ['tail light', 'rear light', 'tail lamp'] },
      { id: 'indicators_fog_lamps', en: 'Indicators / fog lamps', keywords: ['indicator', 'signal light', 'fog lamp'] },
      { id: 'bulbs', en: 'Bulbs', keywords: ['bulb', 'light bulb'] },
      { id: 'wiring_fuses', en: 'Wiring / fuses', keywords: ['wiring', 'wire harness', 'fuse'] },
      { id: 'switches', en: 'Switches', keywords: ['switch'] },
      { id: 'sensors', en: 'Sensors', keywords: ['sensor'] },
      { id: 'ecu_modules', en: 'ECU / modules', keywords: ['ecu', 'ecm', 'control module'] },
      { id: 'horn', en: 'Horn', keywords: ['horn'] },
      { id: 'wiper_motor', en: 'Wiper motor', keywords: ['wiper motor', 'wiper'] },
    ],
  },
  {
    id: 'body_exterior', en: 'Body and Exterior', si: 'බොඩි සහ පිටත කොටස්', ta: 'பாடி மற்றும் வெளிப்புறம்',
    examples: 'Bumpers, mirrors, doors, glass',
    keywords: ['body', 'exterior'],
    types: [
      { id: 'bumpers', en: 'Bumpers', keywords: ['bumper', 'front bumper', 'rear bumper'] },
      { id: 'bonnet', en: 'Bonnet', keywords: ['bonnet', 'hood'] },
      { id: 'doors', en: 'Doors', keywords: ['door'] },
      { id: 'fenders', en: 'Fenders', keywords: ['fender', 'wing', 'mudguard panel'] },
      { id: 'boot_lid', en: 'Boot lid', keywords: ['boot lid', 'trunk lid', 'boot'] },
      { id: 'side_mirrors', en: 'Side mirrors', keywords: ['side mirror', 'wing mirror', 'door mirror'] },
      { id: 'glass_windscreen', en: 'Glass / windscreen', keywords: ['windscreen', 'windshield', 'glass'] },
      { id: 'grille', en: 'Grille', keywords: ['grille', 'front grille'] },
      { id: 'body_panels', en: 'Body panels', keywords: ['body panel', 'panel'] },
      { id: 'trims_mudguards', en: 'Trims / mudguards', keywords: ['trim', 'mudguard', 'mudflap'] },
      { id: 'spoilers_roof_racks', en: 'Spoilers / roof racks', keywords: ['spoiler', 'roof rack', 'roof rail'] },
    ],
  },
  {
    id: 'interior', en: 'Interior', si: 'අභ්‍යන්තරය', ta: 'உட்புறம்',
    examples: 'Seats, dashboards, mats',
    keywords: ['interior'],
    types: [
      { id: 'seats', en: 'Seats', keywords: ['seat', 'car seat'] },
      { id: 'dashboard', en: 'Dashboard', keywords: ['dashboard', 'dash board'] },
      { id: 'steering_wheel', en: 'Steering wheel', keywords: ['steering wheel'] },
      { id: 'door_trims', en: 'Door trims', keywords: ['door trim', 'door panel'] },
      { id: 'floor_mats', en: 'Floor mats', keywords: ['floor mat', 'car mat'] },
      { id: 'instrument_cluster', en: 'Instrument cluster', keywords: ['instrument cluster', 'speedometer', 'meter'] },
      { id: 'airbags_seat_belts', en: 'Airbags / seat belts', keywords: ['airbag', 'seat belt'] },
      { id: 'interior_switches_controls', en: 'Interior switches / controls', keywords: ['interior switch', 'control panel'] },
    ],
  },
  {
    id: 'transmission_clutch', en: 'Transmission and Clutch', si: 'ට්‍රාන්ස්මිෂන් සහ ක්ලච්', ta: 'டிரான்ஸ்மிஷன் மற்றும் கிளட்ச்',
    examples: 'Gearbox, clutch, axles',
    keywords: ['transmission', 'clutch', 'gearbox'],
    types: [
      { id: 'gearbox', en: 'Gearbox', keywords: ['gearbox', 'transmission'] },
      { id: 'clutch_kit', en: 'Clutch kit', keywords: ['clutch', 'clutch kit', 'clutch plate'] },
      { id: 'flywheel', en: 'Flywheel', keywords: ['flywheel'] },
      { id: 'driveshaft', en: 'Driveshaft', keywords: ['driveshaft', 'propeller shaft', 'prop shaft'] },
      { id: 'cv_joints', en: 'CV joints', keywords: ['cv joint', 'drive shaft joint'] },
      { id: 'differential', en: 'Differential', keywords: ['differential', 'diff'] },
      { id: 'gear_linkage', en: 'Gear linkage', keywords: ['gear linkage', 'gear lever'] },
      { id: 'cvt_parts', en: 'CVT parts', keywords: ['cvt', 'cvt belt'] },
    ],
  },
  {
    id: 'cooling_ac', en: 'Cooling and AC', si: 'කූලිං සහ ඒ.සී.', ta: 'குளிரூட்டல் மற்றும் ஏசி',
    examples: 'Radiators, compressors, fans',
    keywords: ['cooling', 'ac', 'air condition', 'aircon'],
    types: [
      { id: 'radiator', en: 'Radiator', keywords: ['radiator'] },
      { id: 'cooling_fan', en: 'Cooling fan', keywords: ['cooling fan', 'radiator fan'] },
      { id: 'thermostat', en: 'Thermostat', keywords: ['thermostat'] },
      { id: 'ac_compressor', en: 'AC compressor', keywords: ['ac compressor', 'aircon compressor'] },
      { id: 'ac_condenser', en: 'AC condenser', keywords: ['ac condenser', 'condenser'] },
      { id: 'heater_core', en: 'Heater core', keywords: ['heater core', 'heater'] },
      { id: 'cooling_hoses', en: 'Cooling hoses', keywords: ['radiator hose', 'cooling hose'] },
      { id: 'expansion_tank', en: 'Expansion tank', keywords: ['expansion tank', 'coolant tank', 'reservoir'] },
    ],
  },
  {
    id: 'tyres_wheels', en: 'Tyres and Wheels', si: 'ටයර් සහ රෝද', ta: 'டயர் மற்றும் சக்கரங்கள்',
    examples: 'Tyres, rims, nuts',
    keywords: ['tyre', 'tire', 'wheel', 'rim'],
    types: [
      { id: 'tyres', en: 'Tyres', keywords: ['tyre', 'tire'] },
      { id: 'alloy_rims', en: 'Alloy rims', keywords: ['alloy rim', 'alloy wheel', 'mag wheel'] },
      { id: 'steel_rims', en: 'Steel rims', keywords: ['steel rim', 'steel wheel'] },
      { id: 'wheel_nuts', en: 'Wheel nuts', keywords: ['wheel nut', 'lug nut'] },
      { id: 'spare_wheels', en: 'Spare wheels', keywords: ['spare wheel', 'spare tyre'] },
      { id: 'tpms_sensors', en: 'TPMS sensors', keywords: ['tpms', 'tyre pressure sensor'] },
    ],
  },
  {
    id: 'filters_fluids', en: 'Filters and Fluids', si: 'ෆිල්ටර් සහ තෙල්', ta: 'வடிகட்டிகள் மற்றும் திரவங்கள்',
    examples: 'Oil, air and fuel filters',
    keywords: ['filter', 'fluid', 'oil'],
    types: [
      { id: 'oil_filter', en: 'Oil filter', keywords: ['oil filter'] },
      { id: 'air_filter', en: 'Air filter', keywords: ['air filter'] },
      { id: 'fuel_filter', en: 'Fuel filter', keywords: ['fuel filter'] },
      { id: 'cabin_filter', en: 'Cabin filter', keywords: ['cabin filter', 'ac filter', 'pollen filter'] },
      { id: 'engine_oil', en: 'Engine oil', keywords: ['engine oil', 'motor oil'] },
      { id: 'gear_oil', en: 'Gear oil', keywords: ['gear oil', 'transmission oil'] },
      { id: 'brake_fluid', en: 'Brake fluid', keywords: ['brake fluid'] },
      { id: 'coolant', en: 'Coolant', keywords: ['coolant', 'radiator fluid'] },
      { id: 'additives', en: 'Additives', keywords: ['additive', 'fuel additive'] },
    ],
  },
  {
    id: 'accessories', en: 'Accessories', si: 'උපාංග', ta: 'துணைக்கருவிகள்',
    examples: 'Audio, covers, tools',
    keywords: ['accessory', 'accessories'],
    types: [
      { id: 'audio_speakers', en: 'Audio / speakers', keywords: ['audio', 'speaker', 'stereo', 'car audio'] },
      { id: 'cameras_dashcams', en: 'Cameras / dashcams', keywords: ['dashcam', 'reverse camera', 'camera'] },
      { id: 'seat_covers', en: 'Seat covers', keywords: ['seat cover'] },
      { id: 'car_covers', en: 'Car covers', keywords: ['car cover'] },
      { id: 'tools_jacks', en: 'Tools / jacks', keywords: ['tool', 'jack', 'tool kit'] },
      { id: 'gps_trackers', en: 'GPS trackers', keywords: ['gps', 'tracker', 'gps tracker'] },
      { id: 'other_accessories', en: 'Other accessories', keywords: ['accessory'] },
    ],
  },
  {
    id: 'other', en: 'Other', si: 'වෙනත්', ta: 'மற்றவை',
    examples: 'Anything else',
    keywords: [],
    types: [],
  },
]
