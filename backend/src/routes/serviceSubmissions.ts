import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'
import { isValidNumber, isValidDateInput, capText, MAX_AMOUNT, MAX_MILEAGE, SHORT_TEXT_LEN, LONG_TEXT_LEN } from '../utils/validate'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// POST /service-submissions — garage submits completed service
// Accepts either shareSessionId (owner shared records) or bookingId (no share attached)
router.post('/', async (req: AuthRequest, res) => {
  const { shareSessionId, bookingId, vehicleId, description, parts, brand, mileage, cost, notes, photos, categories } = req.body
  if (!vehicleId || !description?.trim()) {
    res.status(400).json({ error: 'vehicleId and description are required' })
    return
  }
  if (!shareSessionId && !bookingId) {
    res.status(400).json({ error: 'shareSessionId or bookingId is required' })
    return
  }
  if (!cost || !isValidNumber(cost, { min: 0.01, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'cost is required and must be greater than 0' })
    return
  }
  if (mileage !== undefined && mileage !== null && mileage !== '' && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
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
        description: capText(description.trim(), LONG_TEXT_LEN),
        parts: parts?.trim() ? capText(parts, LONG_TEXT_LEN) : null,
        brand: brand?.trim() ? capText(brand, SHORT_TEXT_LEN) : null,
        mileage: mileage ? Number(mileage) : null,
        cost: cost ? Number(cost) : null,
        notes: notes?.trim() ? capText(notes, LONG_TEXT_LEN) : null,
        photos: Array.isArray(photos) ? photos : [],
        categories: Array.isArray(categories) ? categories : [],
        status: 'pending',
      },
      include: { garage: true },
    })

    const vehicleForNotif = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    const vReg = vehicleForNotif?.registrationNo ?? 'Vehicle'

    const ownerUser = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone } })
    const ownerPrefs = parsePrefs(ownerUser?.notificationPrefs)
    if (ownerPrefs.submission) {
      await sendPush(
        ownerUser?.pushToken,
        'Service Record Submitted',
        `${garage.name} submitted a completed service record for ${vReg}`,
        { screen: 'vehicles', vehicleId }
      )
    }
    await createNotification(
      prisma, ownerPhone,
      'submission',
      vReg,
      `${garage.name} submitted a completed service record for your review`,
      { screen: 'vehicleDashboard', vehicleId }
    )

    res.status(201).json(submission)
  } catch (error) {
    console.error('POST /service-submissions error:', error)
    res.status(500).json({ error: 'Failed to create submission' })
  }
})

// POST /service-submissions/walkin — garage submits a completed service for a vehicle it looked up
// directly by registration number, with no prior booking or share session
router.post('/walkin', async (req: AuthRequest, res) => {
  const { vehicleId, description, parts, brand, mileage, cost, notes, photos, categories } = req.body
  if (!vehicleId || !description?.trim()) {
    res.status(400).json({ error: 'vehicleId and description are required' })
    return
  }
  if (!cost || !isValidNumber(cost, { min: 0.01, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'cost is required and must be greater than 0' })
    return
  }
  if (mileage !== undefined && mileage !== null && mileage !== '' && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(403).json({ error: 'Not a garage account' }); return }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const submission = await prisma.serviceSubmission.create({
      data: {
        vehicleId,
        garageId: garage.id,
        ownerPhone: vehicle.ownerPhone,
        description: capText(description.trim(), LONG_TEXT_LEN),
        parts: parts?.trim() ? capText(parts, LONG_TEXT_LEN) : null,
        brand: brand?.trim() ? capText(brand, SHORT_TEXT_LEN) : null,
        mileage: mileage ? Number(mileage) : null,
        cost: cost ? Number(cost) : null,
        notes: notes?.trim() ? capText(notes, LONG_TEXT_LEN) : null,
        photos: Array.isArray(photos) ? photos : [],
        categories: Array.isArray(categories) ? categories : [],
        status: 'pending',
      },
      include: { garage: true },
    })

    const ownerUser = await prisma.user.findUnique({ where: { phoneNumber: vehicle.ownerPhone } })
    const ownerPrefs = parsePrefs(ownerUser?.notificationPrefs)
    if (ownerPrefs.submission) {
      await sendPush(
        ownerUser?.pushToken,
        'Service Record Submitted',
        `${garage.name} submitted a completed service record for ${vehicle.registrationNo}`,
        { screen: 'vehicles', vehicleId }
      )
    }
    await createNotification(
      prisma, vehicle.ownerPhone,
      'submission',
      vehicle.registrationNo,
      `${garage.name} submitted a completed service record for your review`,
      { screen: 'vehicleDashboard', vehicleId }
    )

    res.status(201).json(submission)
  } catch (error) {
    console.error('POST /service-submissions/walkin error:', error)
    res.status(500).json({ error: 'Failed to create walk-in submission' })
  }
})

// POST /service-submissions/shared — shared user submits an emission test or alignment for owner approval
router.post('/shared', async (req: AuthRequest, res) => {
  const { vehicleId, description, date, mileage, cost, notes, structuredData } = req.body
  if (!vehicleId || !description?.trim()) {
    res.status(400).json({ error: 'vehicleId and description are required' })
    return
  }
  if (date && !isValidDateInput(date)) { res.status(400).json({ error: 'Invalid date' }); return }
  if (mileage !== undefined && mileage !== null && mileage !== '' && !isValidNumber(mileage, { min: 0, max: MAX_MILEAGE })) {
    res.status(400).json({ error: 'Mileage must be a valid, non-negative number' }); return
  }
  if (cost !== undefined && cost !== null && cost !== '' && !isValidNumber(cost, { min: 0, max: MAX_AMOUNT })) {
    res.status(400).json({ error: 'Cost must be a valid, non-negative number' }); return
  }
  try {
    const share = await prisma.vehicleShare.findFirst({
      where: { vehicleId, sharedWithPhone: req.phoneNumber!, status: 'active' },
      include: { vehicle: true },
    })
    if (!share) { res.status(403).json({ error: 'No active share found for this vehicle' }); return }

    const ownerPhone = share.vehicle.ownerPhone
    const submission = await prisma.serviceSubmission.create({
      data: {
        vehicleId,
        garageId: null,
        submittedByPhone: req.phoneNumber!,
        ownerPhone,
        description: capText(description.trim(), LONG_TEXT_LEN),
        serviceDate: date ? new Date(date) : null,
        mileage: mileage ? Number(mileage) : null,
        cost: cost ? Number(cost) : null,
        notes: notes?.trim() ? capText(notes, LONG_TEXT_LEN) : null,
        structuredData: structuredData ?? null,
        photos: [],
        status: 'pending',
      },
    })

    const vReg = share.vehicle.registrationNo
    const ownerUser = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone } })
    const ownerPrefs = parsePrefs(ownerUser?.notificationPrefs)
    if (ownerPrefs.submission) {
      await sendPush(
        ownerUser?.pushToken,
        'Test Result Submitted for Approval',
        `${req.phoneNumber} logged ${description} for ${vReg} — tap to review`,
        { screen: 'vehicleDashboard', vehicleId }
      )
    }
    await createNotification(
      prisma, ownerPhone,
      'submission',
      vReg,
      `${req.phoneNumber} submitted ${description} for your approval`,
      { screen: 'vehicleDashboard', vehicleId }
    )

    res.status(201).json(submission)
  } catch (error) {
    console.error('POST /service-submissions/shared error:', error)
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

    // Use the mileage the garage recorded (most accurate — read directly from the odometer)
    // Fall back to vehicle's stored mileage only if the garage didn't supply one
    const serviceMileage = submission.mileage ?? vehicle?.mileage ?? null

    const submitterLabel = submission.garage?.name ?? submission.submittedByPhone ?? 'Shared user'
    const garageNote = `Submitted by ${submitterLabel}`
    const record = await prisma.serviceRecord.create({
      data: {
        vehicleId: submission.vehicleId,
        date: (submission as any).serviceDate ?? submission.createdAt,
        description: submission.description,
        mileage: serviceMileage,
        parts: submission.parts,
        brand: submission.brand,
        cost: submission.cost,
        notes: submission.notes ? `${garageNote}. ${submission.notes}` : garageNote,
        structuredData: submission.structuredData ?? undefined,
        photos: submission.photos ?? [],
      },
    })

    await prisma.serviceSubmission.update({ where: { id }, data: { status: 'accepted' } })

    // Mark the linked booking as completed so it disappears from both parties' active lists.
    // Two paths: submission may link via bookingId directly, or via shareSessionId on the booking.
    let bookingIdToComplete = submission.bookingId
    if (!bookingIdToComplete && submission.shareSessionId) {
      const linked = await prisma.booking.findFirst({
        where: { shareSessionId: submission.shareSessionId },
        select: { id: true },
      })
      bookingIdToComplete = linked?.id ?? null
    }
    if (bookingIdToComplete) {
      await prisma.booking.update({
        where: { id: bookingIdToComplete },
        data: { status: 'completed' },
      }).catch(() => {})
    }

    // Update vehicle odometer if the garage's reading is higher than the stored value
    if (submission.mileage && vehicle && submission.mileage > vehicle.mileage) {
      await prisma.vehicle.update({
        where: { id: submission.vehicleId },
        data: { mileage: submission.mileage },
      })
    }

    // Notify submitter (garage or shared user) that owner accepted
    const acceptedVReg = vehicle?.registrationNo ?? 'Vehicle'
    const notifyPhone = submission.garage?.ownerPhone ?? submission.submittedByPhone
    if (notifyPhone) {
      const submitterUser = await prisma.user.findUnique({ where: { phoneNumber: notifyPhone } })
      const prefs = parsePrefs(submitterUser?.notificationPrefs)
      const screenTarget = submission.garage ? 'garage' : 'vehicles'
      if (prefs.submission) {
        await sendPush(
          submitterUser?.pushToken,
          'Submission Accepted',
          `${acceptedVReg} — owner approved your submission and added it to their history`,
          { screen: screenTarget }
        )
      }
      await createNotification(
        prisma, notifyPhone,
        'submission_accepted',
        acceptedVReg,
        `Owner approved your submission and added it to their history`,
        { screen: screenTarget }
      )
    }

    res.json({ success: true, record })
  } catch (error) {
    console.error('POST /service-submissions/:id/accept error:', error)
    res.status(500).json({ error: 'Failed to accept submission' })
  }
})

// POST /service-submissions/:id/reject — owner rejects a submission (shared-user submissions only)
router.post('/:id/reject', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const submission = await prisma.serviceSubmission.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'pending' },
      include: { garage: true },
    })
    if (!submission) { res.status(404).json({ error: 'Submission not found' }); return }

    await prisma.serviceSubmission.update({ where: { id }, data: { status: 'rejected' } })

    const vehicle = await prisma.vehicle.findUnique({ where: { id: submission.vehicleId } })
    const vReg = vehicle?.registrationNo ?? 'Vehicle'
    const notifyPhone = submission.submittedByPhone
    if (notifyPhone) {
      const submitterUser = await prisma.user.findUnique({ where: { phoneNumber: notifyPhone } })
      const prefs = parsePrefs(submitterUser?.notificationPrefs)
      if (prefs.submission) {
        await sendPush(
          submitterUser?.pushToken,
          'Submission Not Added',
          `${vReg} — owner did not add your submission to their history`,
          { screen: 'vehicles' }
        )
      }
      await createNotification(
        prisma, notifyPhone,
        'submission_rejected',
        vReg,
        `Owner did not add your ${submission.description} submission to their history`,
        { screen: 'vehicles' }
      )
    }

    res.json({ success: true })
  } catch (error) {
    console.error('POST /service-submissions/:id/reject error:', error)
    res.status(500).json({ error: 'Failed to reject submission' })
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

// POST /service-submissions/:id/rate — owner rates the garage after accepting a submission
router.post('/:id/rate', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const { rating, comment } = req.body
  const ratingNum = Number(rating)
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: 'rating must be between 1 and 5' }); return
  }
  try {
    const submission = await prisma.serviceSubmission.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'accepted' },
    })
    if (!submission) { res.status(404).json({ error: 'Submission not found or not accepted' }); return }
    if (!submission.garageId) { res.status(400).json({ error: 'This submission has no garage to rate' }); return }

    const existing = await prisma.garageRating.findUnique({ where: { submissionId: id } })
    if (existing) { res.status(409).json({ error: 'You already rated this service' }); return }

    const created = await prisma.garageRating.create({
      data: {
        garageId: submission.garageId,
        vehicleId: submission.vehicleId,
        ownerPhone: req.phoneNumber!,
        submissionId: id,
        rating: ratingNum,
        comment: comment?.trim() ? capText(comment, LONG_TEXT_LEN) : null,
      },
    })
    res.status(201).json(created)
  } catch (error) {
    console.error('POST /service-submissions/:id/rate error:', error)
    res.status(500).json({ error: 'Failed to submit rating' })
  }
})

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

export default router
