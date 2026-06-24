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
  const { registrationNo, make, model, year, fuelType, mileage } = req.body

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
        mileage: Number(mileage),
        ownerPhone: req.phoneNumber!,
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
