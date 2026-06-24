import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { sendPush } from '../utils/push'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// POST /service-submissions — garage submits completed service
// Accepts either shareSessionId (owner shared records) or bookingId (no share attached)
router.post('/', async (req: AuthRequest, res) => {
  const { shareSessionId, bookingId, vehicleId, description, parts, brand, cost, notes } = req.body
  if (!vehicleId || !description?.trim()) {
    res.status(400).json({ error: 'vehicleId and description are required' })
    return
  }
  if (!shareSessionId && !bookingId) {
    res.status(400).json({ error: 'shareSessionId or bookingId is required' })
    return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(403).json({ error: 'Not a garage account' }); return }

    let ownerPhone: string
    let resolvedShareId: string | null = null

    if (shareSessionId) {
      const session = await prisma.shareSession.findFirst({
        where: { id: shareSessionId, garageId: garage.id, vehicleId, status: 'active' },
      })
      if (!session) { res.status(404).json({ error: 'Share session not found' }); return }
      ownerPhone = session.ownerPhone
      resolvedShareId = shareSessionId
    } else {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, garageId: garage.id, vehicleId, status: 'confirmed' },
      })
      if (!booking) { res.status(404).json({ error: 'Confirmed booking not found' }); return }
      ownerPhone = booking.ownerPhone
    }

    const submission = await prisma.serviceSubmission.create({
      data: {
        shareSessionId: resolvedShareId as string,
        bookingId: bookingId || null,
        vehicleId,
        garageId: garage.id,
        ownerPhone,
        description: description.trim(),
        parts: parts?.trim() || null,
        brand: brand?.trim() || null,
        cost: cost ? Number(cost) : null,
        notes: notes?.trim() || null,
        status: 'pending',
      },
      include: { garage: true },
    })
    res.status(201).json(submission)
  } catch (error) {
    console.error('POST /service-submissions error:', error)
    res.status(500).json({ error: 'Failed to create submission' })
  }
})

// GET /service-submissions/vehicle/:vehicleId — owner sees pending submissions for a vehicle
router.get('/vehicle/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const submissions = await prisma.serviceSubmission.findMany({
      where: { vehicleId, status: 'pending' },
      include: { garage: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(submissions)
  } catch (error) {
    console.error('GET /service-submissions/vehicle error:', error)
    res.status(500).json({ error: 'Failed to fetch submissions' })
  }
})

// POST /service-submissions/:id/accept — owner accepts → creates permanent service record
router.post('/:id/accept', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const submission = await prisma.serviceSubmission.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'pending' },
      include: { garage: true },
    })
    if (!submission) { res.status(404).json({ error: 'Submission not found' }); return }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: submission.vehicleId } })

    const garageNote = `Submitted by ${submission.garage.name}`
    const record = await prisma.serviceRecord.create({
      data: {
        vehicleId: submission.vehicleId,
        date: submission.createdAt,
        description: submission.description,
        mileage: vehicle?.mileage ?? null,
        parts: submission.parts,
        brand: submission.brand,
        cost: submission.cost,
        notes: submission.notes ? `${garageNote}. ${submission.notes}` : garageNote,
      },
    })

    await prisma.serviceSubmission.update({ where: { id }, data: { status: 'accepted' } })

    // Notify garage that owner accepted
    const garageOwner = await prisma.user.findUnique({ where: { phoneNumber: submission.garage.ownerPhone } })
    const prefs = parsePrefs(garageOwner?.notificationPrefs)
    if (prefs.submission) {
      const vReg = vehicle?.registrationNo ?? 'Vehicle'
      await sendPush(
        garageOwner?.pushToken,
        'Service Record Accepted',
        `${vReg} — owner accepted your submission and added it to their history`,
        { screen: 'garage' }
      )
    }

    res.json({ success: true, record })
  } catch (error) {
    console.error('POST /service-submissions/:id/accept error:', error)
    res.status(500).json({ error: 'Failed to accept submission' })
  }
})

// GET /service-submissions/garage — garage sees their own past submissions
router.get('/garage', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }

    const submissions = await prisma.serviceSubmission.findMany({
      where: { garageId: garage.id },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(submissions)
  } catch (error) {
    console.error('GET /service-submissions/garage error:', error)
    res.status(500).json({ error: 'Failed to fetch submissions' })
  }
})

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

export default router
