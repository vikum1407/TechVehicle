import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { checkRateLimit } from '../utils/rateLimit'
import { isValidNumber, isValidDateInput, capText, MAX_MILEAGE, SHORT_TEXT_LEN, LONG_TEXT_LEN } from '../utils/validate'

// Must match FUEL_TYPES in mobile/src/screens/AddVehicleScreen.tsx (and the Edit
// Vehicle fuel type chips in VehicleDashboardScreen.tsx) exactly — the mobile app
// sends these values as-is, not a normalized/lowercased form.
const ALLOWED_FUEL_TYPES = ['Petrol 92', 'Petrol 95', 'Diesel', 'Electric', 'Petrol Hybrid', 'Diesel Hybrid']
const ALLOWED_VEHICLE_TYPES = ['motorcycle', 'e-cycle', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'three-wheeler', 'van', 'pickup', 'electric-vehicle', 'truck', 'heavy']

const router = express.Router()
const prisma = new PrismaClient()

// All vehicle routes require authentication
router.use(authMiddleware)

// GET /vehicles — get owned vehicles + vehicles shared with this user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const [ownedVehicles, sharedEntries] = await Promise.all([
      prisma.vehicle.findMany({
        where: { ownerPhone: req.phoneNumber },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicleShare.findMany({
        where: { sharedWithPhone: req.phoneNumber, status: 'active' },
        include: { vehicle: true },
      }),
    ])

    const sharedVehicles = sharedEntries.map(s => ({
      ...s.vehicle,
      isShared: true,
      shareId: s.id,
      sharedByPhone: s.ownerPhone,
    }))

    res.json([
      ...ownedVehicles.map(v => ({ ...v, isShared: false })),
      ...sharedVehicles,
    ])
  } catch (error) {
    console.error('GET /vehicles error:', error)
    res.status(500).json({ error: 'Failed to fetch vehicles' })
  }
})

// POST /vehicles — add a new vehicle
router.post('/', async (req: AuthRequest, res) => {
  const vehicleCreateLimit = checkRateLimit('vehicle-create', req.phoneNumber!, 10, 60 * 60 * 1000)
  if (!vehicleCreateLimit.allowed) { res.status(429).json({ error: 'Too many vehicle creation attempts. Try again later.' }); return }

  const { registrationNo, make, model, year, fuelType, vehicleType, mileage, purchaseDate, ownerCount, vehicleNotes, photoUrl } = req.body

  if (!registrationNo || !make || !model || !year || !fuelType || mileage === undefined) {
    res.status(400).json({ error: 'All fields are required' })
    return
  }
  const currentYear = new Date().getFullYear()
  if (!isValidNumber(year, { min: 1900, max: currentYear + 1 })) {
    res.status(400).json({ error: 'Year must be a valid year' }); return
  }
  if (!isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (purchaseDate && !isValidDateInput(purchaseDate)) { res.status(400).json({ error: 'Invalid purchase date' }); return }
  if (ownerCount !== undefined && ownerCount !== null && ownerCount !== '' && !isValidNumber(ownerCount, { min: 1, max: 100 })) {
    res.status(400).json({ error: 'Owner count must be a valid positive number' }); return
  }
  if (!ALLOWED_FUEL_TYPES.includes(fuelType)) {
    res.status(400).json({ error: `Invalid fuelType. Allowed: ${ALLOWED_FUEL_TYPES.join(', ')}` }); return
  }
  if (vehicleType && !ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim())) {
    res.status(400).json({ error: `Invalid vehicleType. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}` }); return
  }
  if (photoUrl !== null && photoUrl !== undefined && photoUrl !== '') {
    if (typeof photoUrl !== 'string' || !photoUrl.startsWith('https://') || photoUrl.length > 2048) {
      res.status(400).json({ error: 'Invalid photo URL' }); return
    }
  }

  try {
    // Ensure user exists in DB
    await prisma.user.upsert({
      where: { phoneNumber: req.phoneNumber! },
      update: {},
      create: { phoneNumber: req.phoneNumber! },
    })

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNo: capText(registrationNo.toUpperCase().trim(), SHORT_TEXT_LEN),
        make: capText(make, SHORT_TEXT_LEN),
        model: capText(model, SHORT_TEXT_LEN),
        year: Number(year),
        fuelType,
        vehicleType: vehicleType?.trim() || null,
        mileage: Number(mileage),
        ownerPhone: req.phoneNumber!,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        ownerCount: ownerCount ? Number(ownerCount) : 1,
        vehicleNotes: vehicleNotes?.trim() ? capText(vehicleNotes, LONG_TEXT_LEN) : null,
        photoUrl: photoUrl || null,
      },
    })

    res.status(201).json(vehicle)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'This registration number is already registered' })
      return
    }
    res.status(500).json({ error: 'Failed to add vehicle' })
  }
})

// PATCH /vehicles/:id/expiry — update emission test, revenue licence, or insurance expiry dates
router.patch('/:id/expiry', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { emissionTestExpiry, revenueLicenceExpiry, insuranceExpiry, insuranceCompany, insurancePolicyNo } = req.body
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    if (emissionTestExpiry && !isValidDateInput(emissionTestExpiry, { allowFuture: true })) {
      res.status(400).json({ error: 'Invalid emission test expiry date' }); return
    }
    if (revenueLicenceExpiry && !isValidDateInput(revenueLicenceExpiry, { allowFuture: true })) {
      res.status(400).json({ error: 'Invalid revenue licence expiry date' }); return
    }
    if (insuranceExpiry && !isValidDateInput(insuranceExpiry, { allowFuture: true })) {
      res.status(400).json({ error: 'Invalid insurance expiry date' }); return
    }
    const data: Record<string, any> = {}
    if (emissionTestExpiry !== undefined) {
      data.emissionTestExpiry = emissionTestExpiry ? new Date(emissionTestExpiry) : null
      data.lastEmissionReminderSent = null
    }
    if (revenueLicenceExpiry !== undefined) {
      data.revenueLicenceExpiry = revenueLicenceExpiry ? new Date(revenueLicenceExpiry) : null
      data.lastLicenceReminderSent = null
    }
    if (insuranceExpiry !== undefined) {
      data.insuranceExpiry = insuranceExpiry ? new Date(insuranceExpiry) : null
      data.lastInsuranceReminderSent = null
    }
    if (insuranceCompany !== undefined) data.insuranceCompany = insuranceCompany?.trim() ? capText(insuranceCompany.trim(), SHORT_TEXT_LEN) : null
    if (insurancePolicyNo !== undefined) data.insurancePolicyNo = insurancePolicyNo?.trim() ? capText(insurancePolicyNo.trim(), SHORT_TEXT_LEN) : null

    const updated = await prisma.vehicle.update({ where: { id }, data })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expiry dates' })
  }
})

// PATCH /vehicles/:id/photo — update vehicle photo
router.patch('/:id/photo', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { photoUrl } = req.body
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }
    if (photoUrl !== null && photoUrl !== undefined && photoUrl !== '') {
      if (typeof photoUrl !== 'string' || !photoUrl.startsWith('https://') || photoUrl.length > 2048) {
        res.status(400).json({ error: 'Invalid photo URL' }); return
      }
    }
    const updated = await prisma.vehicle.update({ where: { id }, data: { photoUrl: photoUrl || null } })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle photo' })
  }
})

// GET /vehicles/lookup?registrationNo=xxx — garage looks up a vehicle for walk-in service logging.
// Returns minimal identity fields only — no owner phone, no service history — full detail
// still requires the owner's consent via a Share or Booking.
router.get('/lookup', async (req: AuthRequest, res) => {
  const registrationNo = (req.query.registrationNo as string || '').trim()
  if (registrationNo.length < 2) {
    res.status(400).json({ error: 'Registration number is required' }); return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(403).json({ error: 'Not a garage account' }); return }

    const vehicle = await prisma.vehicle.findFirst({
      where: { registrationNo: { equals: registrationNo, mode: 'insensitive' } },
      select: { id: true, registrationNo: true, make: true, model: true, year: true, mileage: true, fuelType: true, vehicleType: true },
    })
    if (!vehicle) { res.status(404).json({ error: 'No vehicle found with that registration number' }); return }
    res.json(vehicle)
  } catch (error) {
    console.error('GET /vehicles/lookup error:', error)
    res.status(500).json({ error: 'Failed to look up vehicle' })
  }
})

// GET /vehicles/:id/progress — vehicle profile completion score
router.get('/:id/progress', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const [serviceCount, fuelCount] = await Promise.all([
      prisma.serviceRecord.count({ where: { vehicleId: id } }),
      prisma.fuelLog.count({ where: { vehicleId: id } }),
    ])

    const items = [
      {
        id: 'photo',
        label: 'Vehicle photo',
        done: !!vehicle.photoUrl,
        hint: 'Add a photo of your vehicle',
      },
      {
        id: 'service1',
        label: 'First service record',
        done: serviceCount >= 1,
        hint: 'Log at least one past service',
      },
      {
        id: 'service3',
        label: '3 service records',
        done: serviceCount >= 3,
        hint: `Add ${Math.max(0, 3 - serviceCount)} more service record${3 - serviceCount !== 1 ? 's' : ''} to improve predictions`,
      },
      {
        id: 'fuel',
        label: 'First fuel log',
        done: fuelCount >= 1,
        hint: 'Log a fuel fill-up to enable efficiency tracking',
      },
      {
        id: 'expiry',
        label: 'Renewal dates',
        done: !!(vehicle.emissionTestExpiry || vehicle.revenueLicenceExpiry),
        hint: 'Set emission test or revenue licence expiry to get renewal reminders',
      },
    ]

    const score = Math.round((items.filter(i => i.done).length / items.length) * 100)
    res.json({ score, items })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' })
  }
})

// PATCH /vehicles/:id — edit vehicle profile (make, model, year, fuelType, vehicleType, vehicleNotes)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { make, model, year, fuelType, vehicleType, vehicleNotes, purchaseDate, ownerCount } = req.body
  const currentYear = new Date().getFullYear()
  if (fuelType !== undefined && !ALLOWED_FUEL_TYPES.includes(fuelType)) {
    res.status(400).json({ error: `Invalid fuelType. Allowed: ${ALLOWED_FUEL_TYPES.join(', ')}` }); return
  }
  if (vehicleType !== undefined && vehicleType !== null && vehicleType !== '' && !ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim())) {
    res.status(400).json({ error: `Invalid vehicleType. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}` }); return
  }
  if (year !== undefined && !isValidNumber(year, { min: 1900, max: currentYear + 1 })) {
    res.status(400).json({ error: 'Year must be a valid year' }); return
  }
  if (purchaseDate && !isValidDateInput(purchaseDate)) { res.status(400).json({ error: 'Invalid purchase date' }); return }
  if (ownerCount !== undefined && ownerCount !== null && ownerCount !== '' && !isValidNumber(ownerCount, { min: 1, max: 100 })) {
    res.status(400).json({ error: 'Owner count must be a valid positive number' }); return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(make !== undefined && { make: capText(make.trim(), SHORT_TEXT_LEN) }),
        ...(model !== undefined && { model: capText(model.trim(), SHORT_TEXT_LEN) }),
        ...(year !== undefined && { year: Number(year) }),
        ...(fuelType !== undefined && { fuelType }),
        ...(vehicleType !== undefined && { vehicleType: vehicleType || null }),
        ...(vehicleNotes !== undefined && { vehicleNotes: vehicleNotes?.trim() ? capText(vehicleNotes, LONG_TEXT_LEN) : null }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
        ...(ownerCount !== undefined && { ownerCount: ownerCount ? Number(ownerCount) : null }),
      },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle' })
  }
})

// PATCH /vehicles/:id/overrides — save or clear a custom service interval
router.patch('/:id/overrides', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { group, kmInterval, daysInterval } = req.body as {
    group: string
    kmInterval?: number | null
    daysInterval?: number | null
  }
  if (!group || typeof group !== 'string' || group.length > 100) {
    res.status(400).json({ error: 'group is required and must be a string under 100 characters' }); return
  }
  if (kmInterval != null && !isValidNumber(kmInterval, { min: 100, max: 500_000 })) {
    res.status(400).json({ error: 'kmInterval must be between 100 and 500,000' }); return
  }
  if (daysInterval != null && !isValidNumber(daysInterval, { min: 1, max: 3650 })) {
    res.status(400).json({ error: 'daysInterval must be between 1 and 3,650' }); return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const existing = (vehicle.intervalOverrides as Record<string, any> | null) ?? {}
    const isClearing = kmInterval == null && daysInterval == null
    if (isClearing) {
      delete existing[group]
    } else {
      existing[group] = {
        ...(kmInterval   != null && { kmInterval }),
        ...(daysInterval != null && { daysInterval }),
      }
    }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: { intervalOverrides: existing },
    })
    res.json({ intervalOverrides: updated.intervalOverrides })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save interval override' })
  }
})

// PATCH /vehicles/:id/mileage — manual odometer update
router.patch('/:id/mileage', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { mileage } = req.body
  if (mileage === undefined || !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'mileage is required and must be a valid, non-negative number' }); return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }
    if (Number(mileage) <= vehicle.mileage) {
      res.status(400).json({ error: `New mileage must be higher than current (${vehicle.mileage.toLocaleString()} km)` }); return
    }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: { mileage: Number(mileage) },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update mileage' })
  }
})

// GET /vehicles/:id/anomalies — scan service history for unusual patterns
router.get('/:id/anomalies', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId: id },
      orderBy: { date: 'desc' },
    })

    type Anomaly = { id: string; title: string; description: string; severity: 'warning' | 'info' }
    const anomalies: Anomaly[] = []

    const now = Date.now()
    const MS_12M = 365 * 24 * 60 * 60 * 1000
    const MS_18M = 548 * 24 * 60 * 60 * 1000
    const MS_24M = 730 * 24 * 60 * 60 * 1000

    // ── AC Gas Refill frequency ────────────────────────────────────────────────
    const acRefills = records.filter(r =>
      r.description.toLowerCase().includes('ac gas') ||
      r.description.toLowerCase().includes('refrigerant')
    )
    const acRefills18m = acRefills.filter(r => now - new Date(r.date).getTime() < MS_18M)
    if (acRefills18m.length >= 3) {
      anomalies.push({
        id: 'ac_leak',
        title: 'Possible AC refrigerant leak',
        description: `AC gas refilled ${acRefills18m.length} times in the last 18 months. Frequent refills suggest a seal or compressor leak. Ask your garage to do a pressure test.`,
        severity: 'warning',
      })
    }

    // ── Battery replacement frequency ──────────────────────────────────────────
    const batteryChanges = records.filter(r => r.description.toLowerCase().includes('battery'))
    const batteryChanges24m = batteryChanges.filter(r => now - new Date(r.date).getTime() < MS_24M)
    if (batteryChanges24m.length >= 2) {
      anomalies.push({
        id: 'battery_freq',
        title: 'Battery replaced frequently',
        description: `Battery replaced ${batteryChanges24m.length} times in 24 months. This may indicate an underlying electrical issue such as a faulty alternator or parasitic drain.`,
        severity: 'warning',
      })
    }

    // ── Oil change interval too short ──────────────────────────────────────────
    const oilChanges = records
      .filter(r => r.description.toLowerCase().includes('oil change') && r.mileage != null)
      .sort((a, b) => (b.mileage ?? 0) - (a.mileage ?? 0))
    if (oilChanges.length >= 3) {
      const intervals: number[] = []
      for (let i = 0; i < oilChanges.length - 1; i++) {
        const diff = (oilChanges[i].mileage ?? 0) - (oilChanges[i + 1].mileage ?? 0)
        if (diff > 0) intervals.push(diff)
      }
      if (intervals.length >= 2) {
        const avg = intervals.reduce((s, n) => s + n, 0) / intervals.length
        if (avg < 2000) {
          anomalies.push({
            id: 'oil_too_frequent',
            title: 'Oil changed very frequently',
            description: `Average oil change interval is ${Math.round(avg).toLocaleString()} km — much shorter than typical recommendations (5,000–10,000 km). Unless manufacturer-specified, this may be unnecessary expense.`,
            severity: 'info',
          })
        }
      }
    }

    // ── Any category repeated unusually often in 6 months ─────────────────────
    const MS_6M = 183 * 24 * 60 * 60 * 1000
    const recent6m = records.filter(r => now - new Date(r.date).getTime() < MS_6M)
    const categoryCount: Record<string, number> = {}
    for (const r of recent6m) {
      const key = r.description.toLowerCase().split(' ').slice(0, 3).join(' ')
      categoryCount[key] = (categoryCount[key] ?? 0) + 1
    }
    for (const [key, count] of Object.entries(categoryCount)) {
      if (count >= 4) {
        anomalies.push({
          id: `freq_${key.replace(/\s/g, '_')}`,
          title: `"${key}" done ${count}× in 6 months`,
          description: `This service type has been logged ${count} times in the last 6 months, which is unusually frequent. Review whether all entries are correct or if a recurring fault is being re-repaired.`,
          severity: 'warning',
        })
        break // cap at one of these
      }
    }

    res.json(anomalies)
  } catch (error) {
    console.error('GET /vehicles/anomalies error:', error)
    res.status(500).json({ error: 'Failed to analyse service history' })
  }
})

export default router
