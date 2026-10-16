import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// Vocksy Mart (Step 1.9) writes mart_* notification types into this same shared table,
// but has had its own separate list/bell/mark-read since Step 2.9 (backend/src/routes/
// mart/notifications.ts). Without this exclusion a Mart row would show up — and could
// be bulk-marked-read, or counted toward the bell dot — in both notification centers at
// once, which is exactly the cross-contamination flagged (not fixed) back in Step 1.9's
// own decision log as "worth revisiting... once Mart's own center ships." This is that.
const NOT_MART = { type: { not: { startsWith: 'mart_' } } }

// GET /notifications — fetch all notifications for the logged-in user, newest first
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.appNotification.findMany({
      where: { userPhone: req.phoneNumber!, ...NOT_MART },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(notifications)
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// GET /notifications/unread-count — lightweight count for bell dot
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const count = await prisma.appNotification.count({
      where: { userPhone: req.phoneNumber!, read: false, ...NOT_MART },
    })
    res.json({ count })
  } catch {
    res.status(500).json({ error: 'Failed to fetch count' })
  }
})

// POST /notifications/read-booking/:bookingId — mark message notifications for a booking as read
// Called when the user opens a booking message thread directly (without going through the bell)
router.post('/read-booking/:bookingId', async (req: AuthRequest, res) => {
  const bookingId = req.params.bookingId as string
  try {
    await prisma.appNotification.updateMany({
      where: {
        userPhone: req.phoneNumber!,
        read: false,
        type: 'message',
        linkTo: { contains: bookingId },
      },
      data: { read: true },
    })
    const count = await prisma.appNotification.count({
      where: { userPhone: req.phoneNumber!, read: false },
    })
    res.json({ count })
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

// POST /notifications/read-all — mark all as read (called when user opens the center)
router.post('/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.appNotification.updateMany({
      where: { userPhone: req.phoneNumber!, read: false, ...NOT_MART },
      data: { read: true },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

export default router
