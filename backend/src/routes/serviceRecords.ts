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
  const { date, description, mileage, parts, brand, cost, notes, photos, structuredData } = req.body

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
        photos: Array.isArray(photos) ? photos : [],
        structuredData: structuredData || null,
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

// PATCH /service-records/:id — edit a service record
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { date, description, mileage, parts, brand, cost, notes } = req.body
  try {
    const record = await prisma.serviceRecord.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!record || record.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Record not found' }); return
    }
    const updated = await prisma.serviceRecord.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(description !== undefined && { description }),
        ...(mileage !== undefined && { mileage: mileage ? Number(mileage) : null }),
        ...(parts !== undefined && { parts: parts || null }),
        ...(brand !== undefined && { brand: brand || null }),
        ...(cost !== undefined && { cost: cost !== '' && cost != null ? Number(cost) : null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service record' })
  }
})

// DELETE /service-records/:id — delete a service record
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  try {
    const record = await prisma.serviceRecord.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!record || record.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Record not found' }); return
    }
    await prisma.serviceRecord.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service record' })
  }
})

export default router
