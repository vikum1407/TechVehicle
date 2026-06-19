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
  } catch {
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

export default router
