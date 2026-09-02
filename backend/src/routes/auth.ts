import express from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getJwtSecret } from '../utils/jwtSecret'
import { checkOtpSendRateLimit, checkOtpVerifyRateLimit, resetOtpVerifyRateLimit } from '../utils/otpRateLimit'
import { normalizePhone, isValidPhone } from '../utils/phone'

const router = express.Router()
const prisma = new PrismaClient()

const otpStore = new Map<string, { otp: string; expires: number }>()

// POST /auth/send-otp
router.post('/send-otp', (req, res) => {
  const rawPhone = req.body.phoneNumber
  if (!rawPhone) {
    res.status(400).json({ error: 'Phone number is required' })
    return
  }
  const phoneNumber = normalizePhone(String(rawPhone).trim())
  if (!isValidPhone(phoneNumber)) {
    res.status(400).json({ error: 'Please enter a valid phone number in international format, e.g. +94771234567' })
    return
  }

  const rateLimit = checkOtpSendRateLimit(phoneNumber, req.ip || 'unknown')
  if (!rateLimit.allowed) {
    res.status(429).json({ error: `Too many OTP requests. Please try again in ${Math.ceil((rateLimit.retryAfterSeconds ?? 60) / 60)} minute(s).` })
    return
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = Date.now() + 5 * 60 * 1000

  otpStore.set(phoneNumber, { otp, expires })

  console.log(`\n=============================`)
  console.log(`OTP for ${phoneNumber}: ${otp}`)
  console.log(`=============================\n`)

  res.json({ message: 'OTP sent', phoneNumber })
})

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { otp } = req.body
  const rawPhone = req.body.phoneNumber
  if (!rawPhone || !otp) {
    res.status(400).json({ error: 'Phone number and OTP are required' })
    return
  }
  const phoneNumber = normalizePhone(String(rawPhone).trim())
  if (!isValidPhone(phoneNumber)) {
    res.status(400).json({ error: 'Please enter a valid phone number in international format, e.g. +94771234567' })
    return
  }

  const verifyLimit = checkOtpVerifyRateLimit(phoneNumber)
  if (!verifyLimit.allowed) {
    res.status(429).json({ error: `Too many attempts. Please try again in ${Math.ceil((verifyLimit.retryAfterSeconds ?? 60) / 60)} minute(s).` })
    return
  }

  const stored = otpStore.get(phoneNumber)
  if (!stored) { res.status(400).json({ error: 'OTP not found. Please request a new one.' }); return }
  if (Date.now() > stored.expires) {
    otpStore.delete(phoneNumber)
    res.status(400).json({ error: 'OTP has expired. Please request a new one.' }); return
  }
  if (stored.otp !== otp) { res.status(400).json({ error: 'Invalid OTP. Please try again.' }); return }

  otpStore.delete(phoneNumber)
  resetOtpVerifyRateLimit(phoneNumber)

  try {
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: { garage: true },
    })

    let isNewUser = false

    if (!user) {
      user = await prisma.user.create({
        data: { phoneNumber },
        include: { garage: true },
      })
      isNewUser = true
    } else if (!user.userType) {
      // Existing user without a role — migrate: if they have a garage, set garage type
      if (user.garage) {
        await prisma.user.update({ where: { phoneNumber }, data: { userType: 'garage' } })
        user = { ...user, userType: 'garage' }
      } else {
        isNewUser = true // ask them to pick a role
      }
    }

    const token = jwt.sign(
      { phoneNumber, tokenVersion: user.tokenVersion ?? 0 },
      getJwtSecret(),
      { expiresIn: '30d' }
    )

    res.json({ token, phoneNumber, userType: user.userType, isNewUser })
  } catch (error) {
    console.error('verify-otp error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

// POST /auth/logout-everywhere — invalidate every previously issued token for this
// user (e.g. lost/stolen phone). Bumps tokenVersion so all existing JWTs fail the
// check in authMiddleware; this device must log in again with a fresh OTP too.
router.post('/logout-everywhere', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { tokenVersion: { increment: 1 } },
    })
    res.json({ ok: true, tokenVersion: user.tokenVersion })
  } catch (error) {
    console.error('logout-everywhere error:', error)
    res.status(500).json({ error: 'Failed to revoke sessions' })
  }
})

// POST /auth/push-token — save Expo push token for this user
router.post('/push-token', authMiddleware, async (req: AuthRequest, res) => {
  const { pushToken } = req.body
  if (!pushToken) { res.status(400).json({ error: 'pushToken is required' }); return }
  try {
    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { pushToken },
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('push-token error:', error)
    res.status(500).json({ error: 'Failed to save push token' })
  }
})

// PUT /auth/user-type — set role after role selection screen
router.put('/user-type', authMiddleware, async (req: AuthRequest, res) => {
  const { userType } = req.body
  if (!['owner', 'garage'].includes(userType)) {
    res.status(400).json({ error: 'userType must be owner or garage' }); return
  }
  try {
    await prisma.user.upsert({
      where: { phoneNumber: req.phoneNumber! },
      update: { userType },
      create: { phoneNumber: req.phoneNumber!, userType },
    })
  } catch (error) {
    // Non-fatal — role is persisted in SecureStore on the device.
    // DB may not have userType column yet if prisma db push hasn't run.
    console.error('update user-type (non-fatal):', error)
  }
  res.json({ userType })
})

// GET /auth/notification-prefs — get current user's notification preferences
router.get('/notification-prefs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber: req.phoneNumber! } })
    const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true }
    if (!user?.notificationPrefs) { res.json(defaults); return }
    try {
      res.json({ ...defaults, ...JSON.parse(user.notificationPrefs) })
    } catch {
      res.json(defaults)
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// PUT /auth/notification-prefs — update notification preferences
router.put('/notification-prefs', authMiddleware, async (req: AuthRequest, res) => {
  const { service_due, mileage_reminder, renewal, insurance_reminder, booking, transfer, submission } = req.body
  const prefs: Record<string, boolean> = {}
  if (service_due !== undefined) prefs.service_due = Boolean(service_due)
  if (mileage_reminder !== undefined) prefs.mileage_reminder = Boolean(mileage_reminder)
  if (renewal !== undefined) prefs.renewal = Boolean(renewal)
  if (insurance_reminder !== undefined) prefs.insurance_reminder = Boolean(insurance_reminder)
  if (booking !== undefined) prefs.booking = Boolean(booking)
  if (transfer !== undefined) prefs.transfer = Boolean(transfer)
  if (submission !== undefined) prefs.submission = Boolean(submission)
  try {
    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { notificationPrefs: JSON.stringify(prefs) },
    })
    res.json({ ok: true, prefs })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' })
  }
})

// GET /auth/stats — account summary counts
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const phone = req.phoneNumber!
    const [vehicleCount, serviceCount, fuelCount, expenseCount, user] = await Promise.all([
      prisma.vehicle.count({ where: { ownerPhone: phone } }),
      prisma.serviceRecord.count({ where: { vehicle: { ownerPhone: phone } } }),
      prisma.fuelLog.count({ where: { vehicle: { ownerPhone: phone } } }),
      prisma.expense.count({ where: { vehicle: { ownerPhone: phone } } }),
      prisma.user.findUnique({ where: { phoneNumber: phone } }),
    ])
    res.json({ vehicleCount, serviceCount, fuelCount, expenseCount, profilePhotoUrl: user?.profilePhotoUrl || null })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// PATCH /auth/profile-photo — update the user's profile photo
router.patch('/profile-photo', authMiddleware, async (req: AuthRequest, res) => {
  const { photoUrl } = req.body
  try {
    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { profilePhotoUrl: photoUrl || null },
    })
    res.json({ ok: true, profilePhotoUrl: photoUrl || null })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile photo' })
  }
})

export default router
