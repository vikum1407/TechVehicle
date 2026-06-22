import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// Normalize Sri Lanka mobile numbers to +94XXXXXXXXX format
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\(\)]/g, '')
  if (p.startsWith('+94')) return p                                   // +94773574828 ✓
  if (p.startsWith('+') && p.length === 10 && p[1] === '7') return `+94${p.slice(1)}` // +773574828
  if (p.startsWith('94') && p.length === 11) return `+${p}`          // 94773574828
  if (p.startsWith('0') && p.length === 10) return `+94${p.slice(1)}`// 0773574828
  if (p.startsWith('7') && p.length === 9) return `+94${p}`          // 773574828
  return p
}

// POST /transfers — seller initiates a transfer
router.post('/', async (req: AuthRequest, res) => {
  const { vehicleId, buyerPhone } = req.body
  if (!vehicleId || !buyerPhone?.trim()) {
    res.status(400).json({ error: 'vehicleId and buyerPhone are required' })
    return
  }
  const sellerPhone = req.phoneNumber!

  const normalizedBuyer = normalizePhone(buyerPhone.trim())

  if (normalizedBuyer === sellerPhone) {
    res.status(400).json({ error: 'You cannot transfer a vehicle to yourself' })
    return
  }

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: sellerPhone },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const existing = await prisma.vehicleTransfer.findFirst({
      where: { vehicleId, status: 'pending' },
    })
    if (existing) {
      res.status(400).json({ error: 'A transfer for this vehicle is already pending' })
      return
    }

    const transfer = await prisma.vehicleTransfer.create({
      data: { vehicleId, sellerPhone, buyerPhone: normalizedBuyer, status: 'pending' },
      include: { vehicle: true },
    })
    res.status(201).json(transfer)
  } catch (error) {
    console.error('POST /transfers error:', error)
    res.status(500).json({ error: 'Failed to initiate transfer' })
  }
})

// GET /transfers/incoming — buyer sees pending transfers addressed to them
router.get('/incoming', async (req: AuthRequest, res) => {
  try {
    const transfers = await prisma.vehicleTransfer.findMany({
      where: { buyerPhone: req.phoneNumber!, status: 'pending' },
      include: {
        vehicle: {
          include: {
            _count: { select: { serviceRecords: true, fuelLogs: true, expenses: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(transfers)
  } catch (error) {
    console.error('GET /transfers/incoming error:', error)
    res.status(500).json({ error: 'Failed to fetch incoming transfers' })
  }
})

// GET /transfers/vehicle/:vehicleId — seller checks pending transfer for their vehicle
router.get('/vehicle/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const transfer = await prisma.vehicleTransfer.findFirst({
      where: { vehicleId, sellerPhone: req.phoneNumber!, status: 'pending' },
    })
    res.json(transfer || null)
  } catch (error) {
    console.error('GET /transfers/vehicle error:', error)
    res.status(500).json({ error: 'Failed to fetch transfer' })
  }
})

// POST /transfers/:id/accept — buyer accepts → vehicle ownership changes
router.post('/:id/accept', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const transfer = await prisma.vehicleTransfer.findFirst({
      where: { id, buyerPhone: req.phoneNumber!, status: 'pending' },
      include: { vehicle: true },
    })
    if (!transfer) { res.status(404).json({ error: 'Transfer not found' }); return }

    // Ensure buyer has a User record (create if first time)
    await prisma.user.upsert({
      where: { phoneNumber: req.phoneNumber! },
      update: {},
      create: { phoneNumber: req.phoneNumber! },
    })

    // Transfer ownership — all records follow the vehicle automatically
    await prisma.vehicle.update({
      where: { id: transfer.vehicleId },
      data: { ownerPhone: req.phoneNumber! },
    })

    await prisma.vehicleTransfer.update({
      where: { id },
      data: { status: 'accepted' },
    })

    res.json({ success: true, vehicle: transfer.vehicle })
  } catch (error) {
    console.error('POST /transfers/:id/accept error:', error)
    res.status(500).json({ error: 'Failed to accept transfer' })
  }
})

// GET /transfers/:id/records — buyer previews vehicle records before accepting
router.get('/:id/records', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const transfer = await prisma.vehicleTransfer.findFirst({
      where: { id, buyerPhone: req.phoneNumber!, status: 'pending' },
    })
    if (!transfer) { res.status(404).json({ error: 'Transfer not found' }); return }

    const [serviceRecords, fuelLogs, expenses] = await Promise.all([
      prisma.serviceRecord.findMany({
        where: { vehicleId: transfer.vehicleId },
        orderBy: { date: 'desc' },
      }),
      prisma.fuelLog.findMany({
        where: { vehicleId: transfer.vehicleId },
        orderBy: { date: 'desc' },
      }),
      prisma.expense.findMany({
        where: { vehicleId: transfer.vehicleId },
        orderBy: { date: 'desc' },
      }),
    ])

    res.json({ serviceRecords, fuelLogs, expenses })
  } catch (error) {
    console.error('GET /transfers/:id/records error:', error)
    res.status(500).json({ error: 'Failed to fetch records' })
  }
})

// DELETE /transfers/:id — seller cancels a pending transfer
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const transfer = await prisma.vehicleTransfer.findFirst({
      where: { id, sellerPhone: req.phoneNumber!, status: 'pending' },
    })
    if (!transfer) { res.status(404).json({ error: 'Transfer not found' }); return }

    await prisma.vehicleTransfer.update({ where: { id }, data: { status: 'cancelled' } })
    res.json({ success: true })
  } catch (error) {
    console.error('DELETE /transfers error:', error)
    res.status(500).json({ error: 'Failed to cancel transfer' })
  }
})

export default router
