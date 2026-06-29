import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// All vehicle routes require authentication
router.use(authMiddleware)

// GET /vehicles — get all vehicles for the logged-in user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerPhone: req.phoneNumber },
      orderBy: { createdAt: 'desc' },
    })
    res.json(vehicles)
  } catch (error) {
    console.error('GET /vehicles error:', error)
    res.status(500).json({ error: 'Failed to fetch vehicles' })
  }
})

// POST /vehicles — add a new vehicle
router.post('/', async (req: AuthRequest, res) => {
  const { registrationNo, make, model, year, fuelType, vehicleType, mileage, purchaseDate, ownerCount, vehicleNotes, photoUrl } = req.body

  if (!registrationNo || !make || !model || !year || !fuelType || mileage === undefined) {
    res.status(400).json({ error: 'All fields are required' })
    return
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
        registrationNo: registrationNo.toUpperCase().trim(),
        make,
        model,
        year: Number(year),
        fuelType,
        vehicleType: vehicleType?.trim() || null,
        mileage: Number(mileage),
        ownerPhone: req.phoneNumber!,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        ownerCount: ownerCount ? Number(ownerCount) : 1,
        vehicleNotes: vehicleNotes?.trim() || null,
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
    if (insuranceCompany !== undefined) data.insuranceCompany = insuranceCompany?.trim() || null
    if (insurancePolicyNo !== undefined) data.insurancePolicyNo = insurancePolicyNo?.trim() || null

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
    const updated = await prisma.vehicle.update({ where: { id }, data: { photoUrl: photoUrl || null } })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle photo' })
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
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerPhone: req.phoneNumber! } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(make !== undefined && { make: make.trim() }),
        ...(model !== undefined && { model: model.trim() }),
        ...(year !== undefined && { year: Number(year) }),
        ...(fuelType !== undefined && { fuelType }),
        ...(vehicleType !== undefined && { vehicleType: vehicleType || null }),
        ...(vehicleNotes !== undefined && { vehicleNotes: vehicleNotes?.trim() || null }),
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
  if (!group) { res.status(400).json({ error: 'group is required' }); return }
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
  if (mileage === undefined || isNaN(Number(mileage))) {
    res.status(400).json({ error: 'mileage is required' }); return
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
