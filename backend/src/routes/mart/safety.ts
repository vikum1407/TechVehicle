import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { requireProfile } from '../../middleware/requireProfile'
import { requireRules } from '../../middleware/requireRules'
import { checkRateLimit } from '../../utils/rateLimit'
import { capText } from '../../utils/validate'
import { normalizePhone } from '../../utils/phone'
import { MART_LIMITS, MART_RATE_LIMITS } from '../../data/martLimits'
import { createNotification } from '../../utils/appNotifications'
import { sendPush } from '../../utils/push'

const prisma = new PrismaClient()
const router = express.Router()

const REASONS = ['scam', 'fake', 'prohibited', 'spam', 'abuse', 'other']
const TARGET_TYPES = ['listing', 'user', 'message']

// Vikum's request 2026-10-16 (discussed first): once a listing or user has 3 *distinct*
// reporters (not just 3 report rows — one person re-reporting after the 24h window
// shouldn't alone trigger this), send the reported person a one-time, generic heads-up.
// No reasons, no reporter count, no mention of who — just a reminder to review the
// rules, so the notice can't be used to infer exactly what's being watched or by whom.
const REPORT_THRESHOLD = 3

// Spec: 03-api.md §0 file list names this `safety.ts` (Report + Block together) —
// Block is Step 3.2, not built yet; this file starts with Report only.
//
// Spec: 03-api.md §"POST /mart/reports" + 02-data-model.md §4.5.
router.post('/reports', requireProfile, requireRules, async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const { targetType, targetId, reason, note } = (req.body || {}) as {
    targetType?: string; targetId?: string; reason?: string; note?: string
  }

  if (!targetType || !TARGET_TYPES.includes(targetType)) { res.status(400).json({ error: 'Invalid report target', code: 'VALIDATION' }); return }
  if (!targetId || typeof targetId !== 'string') { res.status(400).json({ error: 'Invalid report target', code: 'VALIDATION' }); return }
  if (!reason || !REASONS.includes(reason)) { res.status(400).json({ error: 'Select a reason', code: 'VALIDATION' }); return }
  // "abuse only for targetType user or message" — hidden for ads in the UI (04-screens.md
  // §20.1 point 5), enforced server-side too since the UI check alone isn't a guarantee.
  if (reason === 'abuse' && targetType === 'listing') { res.status(400).json({ error: 'Invalid reason for this report', code: 'VALIDATION' }); return }

  let noteText: string | null = null
  if (note !== undefined && note !== null) {
    const trimmed = capText(note, MART_LIMITS.REPORT_NOTE_MAX).trim()
    noteText = trimmed.length > 0 ? trimmed : null
  }
  if (reason === 'other' && !noteText) { res.status(400).json({ error: 'Tell us a bit more', code: 'VALIDATION' }); return }

  // Resolve targetPhone (who's being reported) + a snapshot of what's being reported,
  // per type. 404 only on a genuinely missing target — reporting something already
  // removed/closed is still meaningful (that's often exactly what's being reported).
  let targetPhone: string | null = null
  let targetTitle: string | null = null
  let targetSnippet: string | null = null

  if (targetType === 'listing') {
    const listing = await prisma.martListing.findUnique({ where: { id: targetId } })
    if (!listing) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return }
    targetPhone = listing.ownerPhone
    targetTitle = capText(listing.title, 200)
  } else if (targetType === 'user') {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { phoneNumber: true } })
    if (!user) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return }
    targetPhone = user.phoneNumber
  } else {
    const message = await prisma.martMessage.findUnique({ where: { id: targetId } })
    if (!message) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return }
    targetPhone = message.senderPhone
    targetSnippet = capText(message.body, 200)
  }

  if (!targetPhone) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return }
  if (targetPhone === me) { res.status(400).json({ error: "You can't report yourself", code: 'VALIDATION' }); return }

  const limit = checkRateLimit('mart-report', me, MART_RATE_LIMITS.REPORT.max, MART_RATE_LIMITS.REPORT.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many reports. Please try again later.' }); return }

  const since = new Date(Date.now() - MART_LIMITS.DUPLICATE_REPORT_HOURS * 60 * 60 * 1000)
  const existing = await prisma.martReport.findFirst({
    where: { reporterPhone: me, targetType, targetId, createdAt: { gte: since } },
  })
  if (existing) { res.status(200).json({ ok: true, code: 'ALREADY_REPORTED' }); return }

  await prisma.martReport.create({
    data: { reporterPhone: me, targetType, targetId, targetPhone, targetTitle, targetSnippet, reason, note: noteText },
  })

  notifyAdmins(reason, targetTitle).catch(() => {})
  notifyTargetIfThreshold(targetType, targetId, targetPhone, targetTitle).catch(() => {})

  res.status(201).json({ ok: true })
})

// "always" pref per 02-data-model.md §7.1's own table (the only mart_* type with no
// pref-key gate) — admins always get this push, regardless of their own notification
// settings, since it's not optional moderation work.
async function notifyAdmins(reason: string, targetTitle: string | null) {
  const raw = process.env.ADMIN_PHONES
  if (!raw || !raw.trim()) return
  const phones = [...new Set(raw.split(',').map(p => normalizePhone(p.trim())).filter(Boolean))]
  const title = 'New Mart report'
  const body = targetTitle ? `${reason} · ${targetTitle}` : reason
  for (const phone of phones) {
    await createNotification(prisma, phone, 'mart_report_received', title, body)
    const user = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { pushToken: true } })
    await sendPush(user?.pushToken, title, body)
  }
}

// Threshold check runs after every new report, since any report could be the one that
// crosses it. "Open" reports only — once an admin marks them reviewed the count resets
// (no point re-flagging something already looked at). Dedup is by checking for a prior
// `mart_report_threshold` notification carrying this exact `targetId` in its `linkTo` —
// no new schema field needed, same string-match-on-linkTo approach already used
// elsewhere (e.g. the existing non-Mart `/notifications/read-booking/:bookingId`).
// `linkTo` isn't a real navigable target (deliberately — there's nothing useful to jump
// to for a generic "review the rules" notice) but still carries targetId so this dedup
// check works; tapping it just stays on the notification list, same as `linkTo: null`
// elsewhere in Mart.
async function notifyTargetIfThreshold(targetType: string, targetId: string, targetPhone: string, targetTitle: string | null) {
  const distinctReporters = await prisma.martReport.findMany({
    where: { targetType, targetId, status: 'open' },
    select: { reporterPhone: true },
    distinct: ['reporterPhone'],
  })
  if (distinctReporters.length < REPORT_THRESHOLD) return

  const already = await prisma.appNotification.findFirst({
    where: { userPhone: targetPhone, type: 'mart_report_threshold', linkTo: { contains: targetId } },
  })
  if (already) return

  const title = 'Please review the Mart rules'
  const body = targetType === 'listing'
    ? `Your ad${targetTitle ? ` "${targetTitle}"` : ''} has received multiple reports. Please make sure it follows the Mart rules.`
    : 'Your account has received multiple reports. Please make sure your activity follows the Mart rules.'
  const linkTo = { screen: 'martReportThreshold', targetType, targetId }

  // Same "always" reasoning as notifyAdmins — this is an account-standing notice, not
  // optional social noise, so it isn't gated behind a notification preference.
  await createNotification(prisma, targetPhone, 'mart_report_threshold', title, body, linkTo)
  const user = await prisma.user.findUnique({ where: { phoneNumber: targetPhone }, select: { pushToken: true } })
  await sendPush(user?.pushToken, title, body, linkTo)
}

export default router
