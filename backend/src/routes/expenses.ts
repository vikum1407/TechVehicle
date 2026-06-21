import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /expenses/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const expenses = await prisma.expense.findMany({
      where: { vehicleId },
      orderBy: { date: 'desc' },
    })
    res.json(expenses)
  } catch (error) {
    console.error('GET /expenses error:', error)
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

// POST /expenses/:vehicleId
router.post('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  const { date, category, amount, description, mileage, notes } = req.body

  if (!date || !category || amount === undefined) {
    res.status(400).json({ error: 'Date, category and amount are required' })
    return
  }

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const expense = await prisma.expense.create({
      data: {
        vehicleId,
        date: new Date(date),
        category,
        amount: Number(amount),
        description: description?.trim() || null,
        mileage: mileage ? Number(mileage) : null,
        notes: notes?.trim() || null,
      },
    })
    res.status(201).json(expense)
  } catch (error) {
    console.error('POST /expenses error:', error)
    res.status(500).json({ error: 'Failed to add expense' })
  }
})

export default router
