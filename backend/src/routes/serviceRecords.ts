import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { canReadVehicle } from '../utils/vehicleAccess'
import { isValidNumber, isValidDateInput, capText, MAX_AMOUNT, MAX_MILEAGE, SHORT_TEXT_LEN, LONG_TEXT_LEN } from '../utils/validate'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /service-records/:vehicleId — get all service records for a vehicle
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    if (!await canReadVehicle(prisma, vehicleId, req.phoneNumber!)) {
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
  if (!isValidDateInput(date)) { res.status(400).json({ error: 'Invalid date' }); return }
  if (mileage !== undefined && mileage !== null && mileage !== '' && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (cost !== undefined && cost !== null && cost !== '' && !isValidNumber(cost, { min: 0, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'Cost must be a valid, non-negative number' }); return
  }
  if (Array.isArray(photos)) {
    if (photos.length > 10) { res.status(400).json({ error: 'Maximum 10 photos allowed' }); return }
    if (!photos.every((p: unknown) => typeof p === 'string' && p.length <= 2048)) {
      res.status(400).json({ error: 'Each photo must be a URL under 2048 characters' }); return
    }
  }
  if (structuredData !== undefined && structuredData !== null) {
    if (JSON.stringify(structuredData).length > 10240) {
      res.status(400).json({ error: 'structuredData exceeds maximum allowed size' }); return
    }
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
        description: capText(description, LONG_TEXT_LEN),
        mileage: mileage ? Number(mileage) : null,
        parts: parts ? capText(parts, LONG_TEXT_LEN) : null,
        brand: brand ? capText(brand, SHORT_TEXT_LEN) : null,
        cost: cost ? Number(cost) : null,
        notes: notes ? capText(notes, LONG_TEXT_LEN) : null,
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
  if (date !== undefined && !isValidDateInput(date)) { res.status(400).json({ error: 'Invalid date' }); return }
  if (mileage !== undefined && mileage !== null && mileage !== '' && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (cost !== undefined && cost !== null && cost !== '' && !isValidNumber(cost, { min: 0, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'Cost must be a valid, non-negative number' }); return
  }
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
        ...(description !== undefined && { description: capText(description, LONG_TEXT_LEN) }),
        ...(mileage !== undefined && { mileage: mileage ? Number(mileage) : null }),
        ...(parts !== undefined && { parts: parts ? capText(parts, LONG_TEXT_LEN) : null }),
        ...(brand !== undefined && { brand: brand ? capText(brand, SHORT_TEXT_LEN) : null }),
        ...(cost !== undefined && { cost: cost !== '' && cost != null ? Number(cost) : null }),
        ...(notes !== undefined && { notes: notes ? capText(notes, LONG_TEXT_LEN) : null }),
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
