import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { canReadVehicle } from '../utils/vehicleAccess'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /expenses/:vehicleId
router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    if (!await canReadVehicle(prisma, vehicleId, req.phoneNumber!)) {
      res.status(404).json({ error: 'Vehicle not found' }); return
    }

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

// PATCH /expenses/:id — edit an expense
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  const { date, category, amount, description, mileage, notes } = req.body
  try {
    const expense = await prisma.expense.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!expense || expense.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Expense not found' }); return
    }
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(category !== undefined && { category }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(mileage !== undefined && { mileage: mileage ? Number(mileage) : null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
})

// DELETE /expenses/:id — delete an expense
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string }
  try {
    const expense = await prisma.expense.findFirst({
      where: { id },
      include: { vehicle: true },
    })
    if (!expense || expense.vehicle.ownerPhone !== req.phoneNumber!) {
      res.status(404).json({ error: 'Expense not found' }); return
    }
    await prisma.expense.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
})

export default router
