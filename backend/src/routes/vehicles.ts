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

// PATCH /vehicles/:id/expiry — update emission test or revenue licence expiry dates
router.patch('/:id/expiry', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { emissionTestExpiry, revenueLicenceExpiry } = req.body
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const data: Record<string, Date | null> = {}
    if (emissionTestExpiry !== undefined) {
      data.emissionTestExpiry = emissionTestExpiry ? new Date(emissionTestExpiry) : null
      data.lastEmissionReminderSent = null
    }
    if (revenueLicenceExpiry !== undefined) {
      data.revenueLicenceExpiry = revenueLicenceExpiry ? new Date(revenueLicenceExpiry) : null
      data.lastLicenceReminderSent = null
    }

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

export default router
