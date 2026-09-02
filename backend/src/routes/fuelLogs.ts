import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { canReadVehicle } from '../utils/vehicleAccess'
import { isValidNumber, isValidDateInput, capText, MAX_AMOUNT, MAX_MILEAGE, MAX_LITRES, SHORT_TEXT_LEN } from '../utils/validate'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /fuel-logs/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    if (!await canReadVehicle(prisma, vehicleId, req.phoneNumber!)) {
      res.status(404).json({ error: 'Vehicle not found' }); return
    }

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
  if (!isValidDateInput(date)) { res.status(400).json({ error: 'Invalid date' }); return }
  if (!isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (litres !== undefined && litres !== null && litres !== '' && !isValidNumber(litres, { min: 0, max: MAX_LITRES })) {
    res.status(400).json({ error: 'Litres must be a valid, non-negative number' }); return
  }
  if (cost !== undefined && cost !== null && cost !== '' && !isValidNumber(cost, { min: 0, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'Cost must be a valid, non-negative number' }); return
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
        station: station?.trim() ? capText(station, SHORT_TEXT_LEN) : null,
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

// PATCH /fuel-logs/:id — edit a fuel log
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { date, mileage, litres, cost, station } = req.body
  if (date !== undefined && !isValidDateInput(date)) { res.status(400).json({ error: 'Invalid date' }); return }
  if (mileage !== undefined && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (litres !== undefined && litres !== null && litres !== '' && !isValidNumber(litres, { min: 0, max: MAX_LITRES })) {
    res.status(400).json({ error: 'Litres must be a valid, non-negative number' }); return
  }
  if (cost !== undefined && cost !== null && cost !== '' && !isValidNumber(cost, { min: 0, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'Cost must be a valid, non-negative number' }); return
  }
  try {
    const log = await prisma.fuelLog.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!log || log.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Fuel log not found' }); return
    }
    const updated = await prisma.fuelLog.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(mileage !== undefined && { mileage: Number(mileage) }),
        ...(litres !== undefined && { litres: litres ? Number(litres) : null }),
        ...(cost !== undefined && { cost: cost ? Number(cost) : null }),
        ...(station !== undefined && { station: station?.trim() ? capText(station, SHORT_TEXT_LEN) : null }),
      },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update fuel log' })
  }
})

// DELETE /fuel-logs/:id — delete a fuel log
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  try {
    const log = await prisma.fuelLog.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!log || log.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Fuel log not found' }); return
    }
    await prisma.fuelLog.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete fuel log' })
  }
})

export default router
