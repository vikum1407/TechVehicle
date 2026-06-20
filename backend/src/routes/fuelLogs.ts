import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /fuel-logs/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const logs = await prisma.fuelLog.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })
    res.json(logs)
  } catch (error) {
    console.error('GET /fuel-logs error:', error)
    res.status(500).json({ error: 'Failed to fetch fuel logs' })
  }
})

// POST /fuel-logs/:vehicleId
router.post('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  const { date, mileage, litres, cost, fullTank, station } = req.body

  if (!date || mileage === undefined) {
    res.status(400).json({ error: 'Date and mileage are required' })
    return
  }

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const log = await prisma.fuelLog.create({
      data: {
        vehicleId,
        date: new Date(date),
        mileage: Number(mileage),
        litres: litres ? Number(litres) : null,
        cost: cost ? Number(cost) : null,
        fullTank: fullTank !== false,
        station: station?.trim() || null,
      },
    })

    // Update vehicle mileage if this reading is higher
    if (Number(mileage) > vehicle.mileage) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { mileage: Number(mileage) },
      })
    }

    res.status(201).json(log)
  } catch (error) {
    console.error('POST /fuel-logs error:', error)
    res.status(500).json({ error: 'Failed to log fuel' })
  }
})

export default router
