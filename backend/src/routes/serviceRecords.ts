import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /service-records/:vehicleId — get all service records for a vehicle
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' })
      return
    }

    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })
    res.json(records)
  } catch (error) {
    console.error('GET /service-records error:', error)
    res.status(500).json({ error: 'Failed to fetch service records' })
  }
})

// POST /service-records/:vehicleId — add a service record
router.post('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  const { date, description, mileage, parts, brand, cost, notes } = req.body

  if (!date || !description) {
    res.status(400).json({ error: 'Date and description are required' })
    return
  }

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' })
      return
    }

    const record = await prisma.serviceRecord.create({
      data: {
        vehicleId,
        date: new Date(date),
        description,
        mileage: mileage ? Number(mileage) : null,
        parts: parts || null,
        brand: brand || null,
        cost: cost ? Number(cost) : null,
        notes: notes || null,
      },
    })

    // Update vehicle mileage if new mileage is higher
    if (mileage && Number(mileage) > vehicle.mileage) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { mileage: Number(mileage) },
      })
    }

    res.status(201).json(record)
  } catch (error) {
    console.error('POST /service-records error:', error)
    res.status(500).json({ error: 'Failed to add service record' })
  }
})

export default router
