export const BRAND_MODELS: Record<string, string[]> = {
  // ── Most popular in Sri Lanka ──────────────────────────────────────────
  'Toyota': [
    'Aqua', 'Axio', 'Allion', 'Premio', 'Corolla',
    'Prius', 'Vitz / Yaris', 'Fielder', 'Camry',
    'Noah / Voxy', 'Alphard', 'Vellfire',
    'HiAce (KDH)', 'HiAce Wagon',
    'Land Cruiser', 'Prado', 'Fortuner', 'RAV4',
    'Harrier', 'Rush', 'Avanza', 'Raum',
    'Hilux', 'Probox', 'Succeed', 'Townace',
    'TANK', 'C-HR',
  ],
  'Honda': [
    'Fit / Jazz', 'Vezel', 'HR-V', 'CR-V',
    'Civic', 'Accord', 'Freed', 'Grace',
    'Stream', 'Odyssey', 'N-Box', 'Shuttle',
    'BR-V', 'Insight', 'Jade', 'WR-V',
    'Legend', 'Stepwgn',
  ],
  'Suzuki': [
    'Alto', 'Wagon R', 'Swift', 'Baleno',
    'Vitara', 'Jimny', 'Ertiga', 'Celerio',
    'Ignis', 'Dzire', 'Ciaz', 'S-Cross',
    'Every (Van)', 'Carry (Truck)',
  ],
  'Nissan': [
    'March', 'Note', 'Leaf', 'Latio',
    'X-Trail', 'Serena', 'Tiida', 'Bluebird',
    'Wingroad', 'Sunny', 'Dayz', 'Juke',
    'Navara', 'Caravan (Van)', 'Atlas (Truck)',
  ],
  'Mitsubishi': [
    'L300 (Van)', 'Canter (Truck)', 'Rosa (Bus)',
    'Montero Sport', 'Outlander', 'Eclipse Cross', 'ASX',
    'Lancer', 'Pajero', 'Delica', 'Triton / L200',
    'Attrage', 'Mirage',
  ],
  'Bajaj': [
    'RE (Three-Wheeler)', 'RE Compact',
    'Pulsar 150', 'Pulsar 200 NS', 'Pulsar RS 200', 'Pulsar N250',
    'Discover 125', 'Discover 150',
    'CT 100', 'Platina', 'Boxer',
    'Dominar 250', 'Dominar 400',
    'Avenger Street', 'Avenger Cruise',
  ],
  'TVS': [
    'King (Three-Wheeler)',
    'Apache RTR 150', 'Apache RTR 200', 'Apache RR 310',
    'Wego', 'Jupiter', 'Jupiter 125',
    'NTORQ 125', 'Radeon', 'Star City+',
    'Sport', 'Ronin', 'iQube (Electric)',
  ],
  'Hero': [
    'Splendor+', 'Splendor Xtec',
    'Passion Pro', 'Passion XTec',
    'HF Deluxe', 'Glamour',
    'Maestro Edge 125', 'Maestro Edge 110',
    'Destini 125', 'Xpulse 200',
    'Super Splendor',
  ],
  'Yamaha': [
    'FZ / FZS', 'FZ-X', 'FZ 25',
    'R15 V3', 'R15 V4', 'R3',
    'MT-15', 'MT-03',
    'Ray ZR 125', 'Ray ZR 155',
    'Fascino 125',
    'Saluto 125', 'SZ-RR',
    'XTZ 125',
  ],
  'Kawasaki': [
    'Ninja 300', 'Ninja 400', 'Ninja 650',
    'Z400', 'Z650', 'Z900',
    'Versys 300', 'Versys 650',
    'KLX 150', 'KLX 230', 'KLX 300',
    'W175',
  ],
  'Perodua': [
    'Myvi', 'Axia', 'Bezza', 'Alza',
    'Ativa', 'Kancil', 'Viva', 'Kenari',
  ],
  'Daihatsu': [
    'Move', 'Mira', 'Terios', 'Sirion',
    'Gran Max (Van)', 'Gran Max (Truck)',
    'Atrai', 'Boon', 'Tanto', 'Wake',
    'Hijet',
  ],

  // ── Japanese mid-tier ──────────────────────────────────────────────────
  'Mazda': [
    'Demio', 'Familia / Mazda 3', 'Atenza / Mazda 6',
    'CX-3', 'CX-5', 'CX-8',
    'BT-50', 'Verisa', 'Axela', 'MX-5',
  ],
  'Subaru': [
    'Impreza', 'Forester', 'Legacy',
    'Outback', 'XV / Crosstrek',
    'WRX', 'WRX STI', 'Levorg',
    'BRZ',
  ],
  'Isuzu': [
    'ELF (Truck)', 'NPR (Truck)', 'NHR (Truck)',
    'NQR (Truck)', 'CYZ (Heavy Truck)', 'FVZ (Heavy Truck)',
    'D-Max', 'MU-X',
  ],

  // ── Korean ────────────────────────────────────────────────────────────
  'Hyundai': [
    'i10', 'Grand i10', 'i20',
    'Accent', 'Elantra', 'Tucson',
    'Creta', 'Starex (H-1)',
    'Ioniq', 'Ioniq 5',
    'Kona', 'Venue',
  ],
  'Kia': [
    'Picanto', 'Stonic', 'Cerato',
    'Sportage', 'Sorento', 'Carnival',
    'EV6', 'Niro',
  ],

  // ── Indian brands ─────────────────────────────────────────────────────
  'Tata': [
    'Nano', 'Tiago', 'Nexon', 'Punch',
    'Harrier', 'Safari',
    'Ace (Pickup)', 'Ultra (Truck)', 'Prima (Truck)',
    'Winger (Van)',
  ],
  'Mahindra': [
    'Bolero', 'Scorpio', 'Thar',
    'XUV300', 'XUV500', 'XUV700',
    'KUV100', 'Marazzo',
    'Bolero Pik-Up', 'Supro (Van)',
  ],
  'Ashok Leyland': [
    'Dost', 'Bada Dost', 'Partner',
    '1616 (Truck)', '2518 (Truck)', '4923 (Truck)',
    'Viking (Bus)', 'Lynx (Bus)', 'Pharma (Bus)',
  ],
  'Royal Enfield': [
    'Bullet 350', 'Classic 350',
    'Meteor 350', 'Himalayan',
    'Thunderbird 350', 'Thunderbird 500',
    'Interceptor 650', 'Continental GT 650',
    'Hunter 350',
  ],
  'KTM': [
    'Duke 125', 'Duke 200', 'Duke 390',
    'RC 200', 'RC 390',
    'Adventure 390', 'Adventure 250',
  ],

  // ── Western & Luxury ─────────────────────────────────────────────────
  'Ford': [
    'Fiesta', 'Focus', 'EcoSport',
    'Escape / Kuga', 'Ranger', 'Everest',
    'Explorer', 'F-150',
  ],
  'Jeep': [
    'Wrangler', 'Cherokee',
    'Grand Cherokee', 'Compass', 'Renegade',
  ],
  'Land Rover': [
    'Defender', 'Discovery', 'Discovery Sport',
    'Range Rover', 'Range Rover Sport',
    'Range Rover Evoque', 'Range Rover Velar',
    'Freelander',
  ],
  'BMW': [
    '1 Series', '2 Series', '3 Series',
    '5 Series', '7 Series',
    'X1', 'X3', 'X5', 'X7',
    'Z4', 'i3', 'i4',
  ],
  'Mercedes-Benz': [
    'A-Class', 'C-Class', 'E-Class', 'S-Class',
    'GLA', 'GLB', 'GLC', 'GLE', 'GLS',
    'Vito (Van)', 'Sprinter (Van)',
    'Actros (Truck)', 'Axor (Truck)',
  ],
  'Audi': [
    'A3', 'A4', 'A6', 'A8',
    'Q2', 'Q3', 'Q5', 'Q7', 'Q8',
    'e-tron',
  ],
  'Volkswagen': [
    'Polo', 'Golf', 'Passat',
    'Tiguan', 'Touareg', 'T-Roc',
    'Amarok (Pickup)', 'Crafter (Van)',
  ],
  'Lexus': [
    'IS', 'ES', 'GS', 'LS',
    'UX', 'NX', 'RX', 'LX',
    'RC', 'LC',
  ],
  'Peugeot': [
    '208', '308', '508',
    '2008', '3008', '5008',
    'Partner (Van)', 'Boxer (Van)',
  ],
  'Renault': [
    'Kwid', 'Kiger', 'Triber',
    'Duster', 'Captur', 'Fluence',
  ],
  'Chevrolet': [
    'Spark', 'Sail', 'Cruze',
    'Captiva', 'Trailblazer', 'Colorado',
  ],
  'Volvo': [
    'V40', 'S60', 'S90',
    'XC40', 'XC60', 'XC90',
    'FH (Truck)', 'FM (Truck)', 'FMX (Truck)',
    'EC210 (Excavator)', 'EC300 (Excavator)',
  ],

  // ── Electric / New energy ─────────────────────────────────────────────
  'BYD': [
    'Atto 3', 'Seal', 'Dolphin',
    'Han', 'Tang', 'e6',
    'T3 (Van)',
  ],
  'MG': [
    'ZS', 'ZS EV', 'HS',
    'Marvel R (EV)', 'Extender (Pickup)',
    'MG5',
  ],
  'Lifan': [
    'KP Mini', 'KP150', 'KP200',
    'V16', 'X60', 'X70',
  ],

  // ── Heavy commercial / construction ───────────────────────────────────
  'Hino': [
    '300 Series (Truck)', '500 Series (Truck)', '700 Series (Truck)',
    'Poncho (Bus)', 'Rainbow (Bus)', 'Blue Ribbon (Bus)',
  ],
  'JCB': [
    '3CX Backhoe Loader', '4CX Backhoe Loader',
    'JS130 Excavator', 'JS220 Excavator',
    'JS330 Excavator', 'JS500 Excavator',
    'Telehandler', 'Skid Steer',
    '426 Wheel Loader', '437 Wheel Loader',
  ],
  'Caterpillar': [
    '301 Mini Excavator', '305 Mini Excavator',
    '320 Excavator', '323 Excavator',
    '336 Excavator', '390 Excavator',
    'D6 Dozer', 'D7 Dozer', 'D9 Dozer',
    '950 Wheel Loader', '966 Wheel Loader',
    '725 Articulated Truck',
  ],
  'Komatsu': [
    'PC30 Mini Excavator', 'PC88 Excavator',
    'PC130 Excavator', 'PC200 Excavator',
    'PC300 Excavator', 'PC450 Excavator',
    'D65 Dozer', 'D85 Dozer',
    'WA200 Wheel Loader', 'WA320 Wheel Loader',
  ],
  'Hitachi': [
    'ZX55U Mini Excavator', 'ZX120 Excavator',
    'ZX200 Excavator', 'ZX330 Excavator',
    'ZX450 Excavator',
    'EX1200 Mining Excavator',
  ],
  'CASE': [
    'CX130 Excavator', 'CX210 Excavator',
    'CX300 Excavator',
    '580ST Backhoe', '695ST Backhoe',
    '821G Wheel Loader',
  ],
}

// Ordered brands list — popular in SL first, then alphabetical
export const BRANDS_LIST: string[] = [
  // High volume
  'Toyota', 'Honda', 'Suzuki', 'Nissan', 'Mitsubishi',
  'Bajaj', 'TVS', 'Hero', 'Yamaha', 'Kawasaki',
  'Perodua', 'Daihatsu', 'Mazda', 'Subaru', 'Isuzu',
  'Hyundai', 'Kia',
  // Indian
  'Tata', 'Mahindra', 'Ashok Leyland', 'Royal Enfield', 'KTM',
  // Western & Luxury
  'Ford', 'Jeep', 'Land Rover', 'BMW', 'Mercedes-Benz',
  'Audi', 'Volkswagen', 'Lexus', 'Peugeot', 'Renault', 'Chevrolet',
  // EV / New energy
  'BYD', 'MG', 'Lifan',
  // Heavy commercial & construction
  'Hino', 'Volvo', 'JCB', 'Caterpillar', 'Komatsu', 'Hitachi', 'CASE',
  // Fallback
  'Other',
]
