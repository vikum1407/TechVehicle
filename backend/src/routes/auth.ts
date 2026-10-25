import express from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getJwtSecret } from '../utils/jwtSecret'
import { checkOtpSendRateLimit, checkOtpVerifyRateLimit, resetOtpVerifyRateLimit } from '../utils/otpRateLimit'
import { normalizePhone, isValidPhone } from '../utils/phone'
import { capText, SHORT_TEXT_LEN } from '../utils/validate'
import { ensurePromoCode } from '../utils/promoCode'
import { checkRateLimit } from '../utils/rateLimit'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'
import { cancelGarageBookingsNow, cancelVehicleBookingsNow } from '../utils/accountDeletion'

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

  const otp = crypto.randomInt(100000, 1000000).toString()
  const expires = Date.now() + 5 * 60 * 1000

  otpStore.set(phoneNumber, { otp, expires })

  // There is no real SMS provider wired up yet — this log line is the ONLY way
  // anyone (dev, tester, or real user) can currently receive their OTP. Gating
  // it behind NODE_ENV !== 'production' made login completely impossible on
  // Render (which sets NODE_ENV=production), since testers have no other way
  // to see the code. Once a real SMS provider is integrated, delivery moves
  // there and this log line should be removed for real.
  console.log(`\n=============================`)
  console.log(`OTP for ${phoneNumber}: ${otp}`)
  console.log(`=============================\n`)

  res.json({ message: 'OTP sent', phoneNumber })
})

// GET /auth/dev-otp?phoneNumber=...
// Local-dev convenience only: lets the dev-client phone fetch its own OTP
// instead of asking for it in chat. Blocked outright in production (Render
// sets NODE_ENV=production), so this can never leak a real user's OTP.
router.get('/dev-otp', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).end()
    return
  }
  const rawPhone = req.query.phoneNumber
  if (!rawPhone) {
    res.status(400).json({ error: 'Phone number is required' })
    return
  }
  const phoneNumber = normalizePhone(String(rawPhone).trim())
  const stored = otpStore.get(phoneNumber)
  if (!stored) { res.status(404).json({ error: 'No OTP found for this number. Request one first.' }); return }
  if (Date.now() > stored.expires) { res.status(404).json({ error: 'OTP expired. Request a new one.' }); return }
  res.json({ otp: stored.otp })
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

    // Account deletion (2026-10-25): logging back in during the 14-day grace period
    // cancels the pending deletion - standard practice both app stores expect.
    let deletionCancelled = false
    if (user.pendingDeletionAt) {
      await prisma.user.update({ where: { phoneNumber }, data: { pendingDeletionAt: null } })
      deletionCancelled = true
    }

    // Temporary promo/referral campaign (2026-10-23) - every login ensures this user
    // has their own shareable code, generated once and kept stable thereafter. See
    // schema.prisma's User.promoCode comment for the full removal plan. Deliberately
    // non-fatal: this is a side feature, not core to auth - it must never be able to
    // block login if generation fails for any reason (DB hiccup, exhausted collision
    // retries). Safe to just retry on the user's next login since it's idempotent.
    try {
      await ensurePromoCode(prisma, phoneNumber, (user as any).promoCode)
    } catch (promoError) {
      console.error('ensurePromoCode (verify-otp) error:', promoError)
    }

    const token = jwt.sign(
      { phoneNumber, tokenVersion: user.tokenVersion ?? 0 },
      getJwtSecret(),
      { expiresIn: '30d', algorithm: 'HS256' }
    )

    res.json({ token, phoneNumber, userType: user.userType, isNewUser, deletionCancelled })
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

const DELETION_GRACE_DAYS = 14

// DELETE /auth/account — request account deletion (Apple 5.1.1(v) / Google Play
// compliance). Not immediate: marks a 14-day grace period, during which logging
// back in (verify-otp) cancels it. A daily job hard-deletes once it passes - see
// jobs/accountDeletionSweep.ts and utils/accountDeletion.ts for the full flow.
router.delete('/account', authMiddleware, async (req: AuthRequest, res) => {
  // Per the security standards checklist: this can push-notify other people (booking
  // cancellations), so it needs the same rate-limit treatment every other
  // notification-triggering endpoint gets, even though it's authenticated - a repeat
  // call just re-marks the same 14-day date, but would also re-fire those
  // notifications each time without this.
  const deletionLimit = checkRateLimit('account-deletion', req.phoneNumber!, 3, 60 * 60 * 1000)
  if (!deletionLimit.allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' }); return
  }
  try {
    const phoneNumber = req.phoneNumber!
    const deletionDate = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)

    await prisma.user.update({ where: { phoneNumber }, data: { pendingDeletionAt: deletionDate } })

    // Garage bookings other customers are relying on must be released right away,
    // not left hanging until the grace period ends - same reasoning as the agreed
    // design: an owner with a pending appointment shouldn't find out 14 days later.
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: phoneNumber } })
    if (garage) {
      await cancelGarageBookingsNow(prisma, garage.id, garage.name)
    }
    const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: phoneNumber }, select: { id: true } })
    for (const vehicle of vehicles) {
      await cancelVehicleBookingsNow(prisma, vehicle.id)
    }

    res.json({ ok: true, deletionDate: deletionDate.toISOString() })
  } catch (error) {
    console.error('DELETE /auth/account error:', error)
    res.status(500).json({ error: 'Failed to request account deletion' })
  }
})

// POST /auth/push-token — save Expo push token for this user
router.post('/push-token', authMiddleware, async (req: AuthRequest, res) => {
  const { pushToken } = req.body
  if (!pushToken || typeof pushToken !== 'string' || !/^ExponentPushToken\[.{1,200}\]$/.test(pushToken)) {
    res.status(400).json({ error: 'Invalid push token format' }); return
  }
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
    console.error('GET /auth/notification-prefs error:', error)
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
    console.error('PUT /auth/notification-prefs error:', error)
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
    // Fallback generation for users already mid-session (30-day token) who won't hit
    // verify-otp's own generation again until their token expires - see
    // schema.prisma's User.promoCode comment. Non-fatal, same reasoning as verify-otp -
    // the rest of the account summary must still load even if this fails.
    let promoCode: string | null = (user as any)?.promoCode ?? null
    try {
      promoCode = await ensurePromoCode(prisma, phone, promoCode)
    } catch (promoError) {
      console.error('ensurePromoCode (/stats) error:', promoError)
    }
    res.json({ vehicleCount, serviceCount, fuelCount, expenseCount, profilePhotoUrl: user?.profilePhotoUrl || null, email: (user as any)?.email || null, promoCode })
  } catch (error) {
    console.error('GET /auth/stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// PATCH /auth/email — save or update the user's email address and/or city.
// Email is optional (2026-10-23 - mandatory-email-at-signup was reconsidered as too
// much friction for this market, validated only if actually given); city stays
// required at the EmailSetupScreen UI level, but this route itself doesn't enforce
// that - it's generic enough for ProfileScreen's email-only inline edit too.
router.patch('/email', authMiddleware, async (req: AuthRequest, res) => {
  const { email, city, referredByCode } = req.body
  let normalised: string | undefined
  if (email) {
    if (typeof email !== 'string') { res.status(400).json({ error: 'Invalid email' }); return }
    normalised = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised) || normalised.length > 254) {
      res.status(400).json({ error: 'Please enter a valid email address' }); return
    }
  }
  if (city !== undefined && city !== null && typeof city !== 'string') {
    res.status(400).json({ error: 'Invalid city' }); return
  }
  if (normalised === undefined && city === undefined && !referredByCode) {
    res.status(400).json({ error: 'email or city is required' }); return
  }
  try {
    const data: any = {}
    if (normalised !== undefined) data.email = normalised
    if (city !== undefined) data.city = city?.trim() ? capText(city, SHORT_TEXT_LEN) : null

    // Temporary promo/referral campaign (2026-10-23) - set once, never overwritten
    // (first submission wins), same removal plan as schema.prisma's comment. Length
    // cap enforced server-side even though the mobile UI already caps at 10 chars -
    // client-side limits don't protect the backend from a direct API call.
    if (referredByCode && typeof referredByCode === 'string' && referredByCode.trim()) {
      if (referredByCode.length > 20) { res.status(400).json({ error: 'Invalid promo code' }); return }
      const codeLimit = checkRateLimit('promo-code-attempt', req.phoneNumber!, 10, 60 * 60 * 1000)
      if (!codeLimit.allowed) { res.status(429).json({ error: 'Too many attempts. Please try again later.' }); return }
      const self = await prisma.user.findUnique({ where: { phoneNumber: req.phoneNumber! } })
      if (!(self as any)?.referredByCode) {
        const code = referredByCode.trim().toUpperCase()
        const referrer = await prisma.user.findUnique({ where: { promoCode: code } as any })
        if (!referrer) { res.status(400).json({ error: 'Invalid promo code' }); return }
        if (referrer.phoneNumber === req.phoneNumber!) { res.status(400).json({ error: 'You cannot use your own promo code' }); return }
        data.referredByCode = code
      }
    }

    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data,
    })
    res.json({ ok: true, email: normalised ?? null, city: data.city ?? null })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'This email is already linked to another account' }); return
    }
    console.error('PATCH /auth/email error:', error)
    res.status(500).json({ error: 'Failed to save email' })
  }
})

// PATCH /auth/profile-photo — update the user's profile photo
router.patch('/profile-photo', authMiddleware, async (req: AuthRequest, res) => {
  const { photoUrl } = req.body
  if (photoUrl !== null && photoUrl !== undefined && photoUrl !== '') {
    if (typeof photoUrl !== 'string' || !photoUrl.startsWith('https://') || photoUrl.length > 2048) {
      res.status(400).json({ error: 'Invalid photo URL' }); return
    }
  }
  try {
    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { profilePhotoUrl: photoUrl || null },
    })
    res.json({ ok: true, profilePhotoUrl: photoUrl || null })
  } catch (error) {
    console.error('PATCH /auth/profile-photo error:', error)
    res.status(500).json({ error: 'Failed to update profile photo' })
  }
})

// ── Public, unauthenticated account-deletion request page ──────────────────────
// Required separately from the in-app flow above: Google Play's account-deletion
// policy specifically requires a path that works for someone who has already
// uninstalled the app. Hosted here on the existing Render backend rather than a
// new domain/service (2026-10-25 design decision - no new infra needed).
//
// There's no OTP available here (the visitor isn't authenticated), so this can't
// safely prove the submitter owns the phone number - the same trade-off any
// "email us to delete your account" flow has. Mitigated the same way: this reuses
// the exact same pendingDeletionAt + 14-day-grace-period mechanism as the in-app
// button (not an instant delete), and the account's real owner gets an immediate
// push + in-app notification, so a bad-faith submission by someone else is both
// rate-limited and trivially reversible (the real owner just logs in to cancel it,
// exactly as if they'd requested it themselves and changed their mind).
const deleteAccountPageHtml = (message?: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete Your Vocksy Account</title>
</head>
<body>
<h1>Delete Your Vocksy Account</h1>
<p>If you no longer have the Vocksy app installed, you can request account deletion here using your registered mobile number.</p>
<p>What happens next:</p>
<ul>
<li>Your account is scheduled for deletion in 14 days.</li>
<li>If this request wasn't made by you, simply log back in to the Vocksy app within those 14 days to cancel it - we'll also notify your account immediately when a request like this is made.</li>
<li>After 14 days, your account, vehicles, and all associated history are permanently deleted. Any booking history shared with a garage or vehicle owner you've interacted with is kept on their side, with your identifying details removed.</li>
</ul>
${message ? `<p><strong>${message}</strong></p>` : ''}
<form method="POST" action="/auth/account-deletion-request">
<label for="phoneNumber">Registered mobile number (international format, e.g. +94771234567)</label><br>
<input type="tel" id="phoneNumber" name="phoneNumber" required placeholder="+94771234567"><br><br>
<button type="submit">Request Account Deletion</button>
</form>
<p>If you still have the app installed, it's faster to use "Delete my account" from the Profile/Settings screen instead.</p>
</body>
</html>`

router.get('/delete-account', (_req, res) => {
  res.type('html').send(deleteAccountPageHtml())
})

router.post('/account-deletion-request', express.urlencoded({ extended: true }), async (req, res) => {
  const rawPhone = req.body?.phoneNumber
  const requestLimit = checkRateLimit('account-deletion-request', req.ip || 'unknown', 5, 60 * 60 * 1000)
  if (!requestLimit.allowed) {
    res.status(429).type('html').send(deleteAccountPageHtml('Too many requests from this network. Please try again later.'))
    return
  }
  if (!rawPhone) {
    res.status(400).type('html').send(deleteAccountPageHtml('Please enter a phone number.'))
    return
  }
  const phoneNumber = normalizePhone(String(rawPhone).trim())
  if (!isValidPhone(phoneNumber)) {
    res.status(400).type('html').send(deleteAccountPageHtml('Please enter a valid phone number in international format, e.g. +94771234567.'))
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } })
    // Same response either way, regardless of whether an account exists for this
    // number - avoids letting this page be used to check which phone numbers have
    // a Vocksy account.
    if (user) {
      const deletionDate = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
      await prisma.user.update({ where: { phoneNumber }, data: { pendingDeletionAt: deletionDate } })

      const garage = await prisma.garage.findUnique({ where: { ownerPhone: phoneNumber } })
      if (garage) await cancelGarageBookingsNow(prisma, garage.id, garage.name)
      const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: phoneNumber }, select: { id: true } })
      for (const vehicle of vehicles) await cancelVehicleBookingsNow(prisma, vehicle.id)

      const title = 'Account Deletion Requested'
      const body = `A deletion request for your account was made from the web. If this wasn't you, log in within 14 days to cancel it.`
      await sendPush(user.pushToken, title, body, { screen: 'profile' })
      await createNotification(prisma, phoneNumber, 'account_deletion_requested', title, body, { screen: 'profile' })
    }
    res.type('html').send(deleteAccountPageHtml('If an account exists for that number, deletion has been requested. You can cancel it anytime in the next 14 days by logging back into the app.'))
  } catch (error) {
    console.error('POST /auth/account-deletion-request error:', error)
    res.status(500).type('html').send(deleteAccountPageHtml('Something went wrong. Please try again later.'))
  }
})

export default router
