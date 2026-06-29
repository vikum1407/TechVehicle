import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('94') && digits.length === 11) return '+' + digits
  if (digits.startsWith('0') && digits.length === 10) return '+94' + digits.slice(1)
  if (digits.length === 9) return '+94' + digits
  return phone
}

// POST /vehicle-shares — owner shares a vehicle with another phone number
router.post('/', async (req: AuthRequest, res) => {
  const { vehicleId } = req.body
  const sharedWithPhone = normalizePhone(req.body.sharedWithPhone ?? '')
  if (!vehicleId || !sharedWithPhone) {
    res.status(400).json({ error: 'vehicleId and sharedWithPhone are required' })
    return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber },
    })
    if (!vehicle) {
      res.status(403).json({ error: 'Vehicle not found or not owned by you' })
      return
    }
    if (sharedWithPhone === req.phoneNumber) {
      res.status(400).json({ error: 'Cannot share with yourself' })
      return
    }

    const share = await prisma.vehicleShare.upsert({
      where: { vehicleId_sharedWithPhone: { vehicleId, sharedWithPhone } },
      update: { status: 'pending' },
      create: { vehicleId, ownerPhone: req.phoneNumber!, sharedWithPhone, status: 'pending' },
    })

    const recipient = await prisma.user.findUnique({ where: { phoneNumber: sharedWithPhone } })
    if (recipient) {
      const title = 'Vehicle shared with you'
      const body = `${req.phoneNumber} shared ${vehicle.make} ${vehicle.model} (${vehicle.registrationNo}) with you`
      await sendPush(recipient.pushToken, title, body, { screen: 'vehicles' })
      await createNotification(prisma, sharedWithPhone, 'family_share', title, body, { screen: 'vehicles' })
    }

    res.status(201).json(share)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Already shared with this phone number' })
      return
    }
    console.error('POST /vehicle-shares error:', error)
    res.status(500).json({ error: 'Failed to create share' })
  }
})

// GET /vehicle-shares/received — vehicles shared WITH the current user
router.get('/received', async (req: AuthRequest, res) => {
  try {
    const shares = await prisma.vehicleShare.findMany({
      where: { sharedWithPhone: req.phoneNumber, status: { in: ['pending', 'active'] } },
      include: {
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(shares)
  } catch (error) {
    console.error('GET /vehicle-shares/received error:', error)
    res.status(500).json({ error: 'Failed to fetch received shares' })
  }
})

// GET /vehicle-shares/sent — shares the owner has created (optionally filtered by vehicleId)
router.get('/sent', async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.query
    const shares = await prisma.vehicleShare.findMany({
      where: {
        ownerPhone: req.phoneNumber,
        status: { not: 'revoked' },
        ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(shares)
  } catch (error) {
    console.error('GET /vehicle-shares/sent error:', error)
    res.status(500).json({ error: 'Failed to fetch sent shares' })
  }
})

// PATCH /vehicle-shares/:id/accept — recipient accepts
router.patch('/:id/accept', async (req: AuthRequest, res) => {
  try {
    const share = await prisma.vehicleShare.findFirst({
      where: { id: req.params.id as string, sharedWithPhone: req.phoneNumber },
    })
    if (!share) {
      res.status(404).json({ error: 'Share not found' })
      return
    }
    const updated = await prisma.vehicleShare.update({
      where: { id: req.params.id as string },
      data: { status: 'active' },
    })

    const vehicle = await prisma.vehicle.findUnique({ where: { id: share.vehicleId } })
    const owner = await prisma.user.findUnique({ where: { phoneNumber: share.ownerPhone } })
    if (vehicle && owner) {
      const title = 'Family sharing accepted'
      const body = `${req.phoneNumber} accepted access to ${vehicle.make} ${vehicle.model}`
      await sendPush(owner.pushToken, title, body, { screen: 'vehicles' })
      await createNotification(prisma, share.ownerPhone, 'family_share', title, body, { screen: 'vehicles' })
    }

    res.json(updated)
  } catch (error) {
    console.error('PATCH /vehicle-shares/:id/accept error:', error)
    res.status(500).json({ error: 'Failed to accept share' })
  }
})

// DELETE /vehicle-shares/:id — owner revokes OR recipient declines
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const share = await prisma.vehicleShare.findUnique({ where: { id: req.params.id as string } })
    if (!share) {
      res.status(404).json({ error: 'Share not found' })
      return
    }
    if (share.ownerPhone !== req.phoneNumber && share.sharedWithPhone !== req.phoneNumber) {
      res.status(403).json({ error: 'Not authorised' })
      return
    }
    await prisma.vehicleShare.update({ where: { id: req.params.id as string }, data: { status: 'revoked' } })
    res.json({ success: true })
  } catch (error) {
    console.error('DELETE /vehicle-shares/:id error:', error)
    res.status(500).json({ error: 'Failed to revoke share' })
  }
})

export default router
