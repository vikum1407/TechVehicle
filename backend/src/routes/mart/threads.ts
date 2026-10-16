import express from 'express'
import { PrismaClient, MartListing } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { requireProfile } from '../../middleware/requireProfile'
import { requireRules } from '../../middleware/requireRules'
import { checkRateLimit } from '../../utils/rateLimit'
import { capText } from '../../utils/validate'
import { blockedSet } from '../../utils/blockedSet'
import { getSellerTags } from '../../utils/sellerInfo'
import { getShopProfiles } from '../../utils/shopIdentity'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { MART_LIMITS, MART_RATE_LIMITS } from '../../data/martLimits'
import { parsePrefs } from '../../utils/notificationPrefs'
import { sendPush } from '../../utils/push'
import { threadCanRate } from '../../utils/dealRating'

const prisma = new PrismaClient()
const router = express.Router()

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const NOT_FOUND = { error: 'This ad is no longer available', code: 'NOT_FOUND' }

// Spec: 02-data-model.md §3.4. "Closed time = the earlier of listing.removedAt and
// listing.closedAt (whichever are set)" — comparing two possibly-null dates and taking
// the min can't be expressed as a single Prisma `where` filter, so this is computed in
// application code (exported as a pure function so it's unit-testable without a DB).
export function isThreadListingVisible(listing: Pick<MartListing, 'removedAt' | 'closedAt' | 'status'>): boolean {
  const isActive = !listing.removedAt && (listing.status === 'available' || listing.status === 'reserved' || listing.status === 'open')
  if (isActive) return true
  const closedTimes = [listing.removedAt, listing.closedAt].filter((d): d is Date => d !== null)
  if (closedTimes.length === 0) return false
  const earliest = Math.min(...closedTimes.map(d => d.getTime()))
  return Date.now() - earliest < SEVEN_DAYS_MS
}

// Spec: 03-api.md §8 inbox roles. Selling ad & I'm the owner -> selling; selling ad &
// I'm the other person -> buying. Wanted ad & I'm the owner (the requester) -> buying;
// wanted & I'm the other person (the one who answered) -> selling.
export function roleFor(listingType: string, listingOwnerPhone: string, me: string): 'buying' | 'selling' {
  const isOwner = listingOwnerPhone === me
  if (listingType === 'selling') return isOwner ? 'selling' : 'buying'
  return isOwner ? 'buying' : 'selling'
}

function isCanceled(status: string): status is 'sold' | 'fulfilled' {
  return status === 'sold' || status === 'fulfilled'
}

function listingSnapshotStatus(listing: MartListing): 'active' | 'sold' | 'fulfilled' | 'removed' {
  if (listing.removedAt) return 'removed'
  if (isCanceled(listing.status)) return listing.status
  return 'active'
}

// Exported so listings.ts's mark-sold/deal-confirm endpoints (Step 2.4) can reuse the
// same name+photo+tag lookup instead of a parallel copy.
export async function resolveOtherInfo(phones: string[]) {
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return new Map<string, { id: string; name: string; photoUrl: string | null; tag: 'shop' | 'casual' }>()
  const [users, tagMap, shopMap] = await Promise.all([
    prisma.user.findMany({ where: { phoneNumber: { in: uniquePhones } }, select: { id: true, phoneNumber: true, displayName: true, profilePhotoUrl: true } }),
    getSellerTags(prisma, uniquePhones),
    getShopProfiles(prisma, uniquePhones),
  ])
  const map = new Map<string, { id: string; name: string; photoUrl: string | null; tag: 'shop' | 'casual' }>()
  for (const u of users) {
    const tag = tagMap.get(u.phoneNumber) || 'casual'
    const shop = shopMap.get(u.phoneNumber)
    map.set(u.phoneNumber, { id: u.id, name: shop?.name || publicName(u.displayName, tag), photoUrl: shop?.logoUrl || u.profilePhotoUrl, tag })
  }
  return map
}

// Spec: 02-data-model.md §7.1 "One row per thread for messages": if an unread
// mart_message row already exists for this thread (matched on the exact `linkTo` JSON
// text this file always builds the same way), update it in place instead of creating
// a second one — a burst of messages in one thread shows as one notification, not many.
async function upsertMartMessageNotification(threadId: string, recipientPhone: string, title: string, body: string) {
  try {
    const linkTo = JSON.stringify({ screen: 'martThread', threadId })
    const existing = await prisma.appNotification.findFirst({
      where: { userPhone: recipientPhone, type: 'mart_message', read: false, linkTo },
    })
    if (existing) {
      await prisma.appNotification.update({ where: { id: existing.id }, data: { title, body, createdAt: new Date() } })
    } else {
      await prisma.appNotification.create({ data: { userPhone: recipientPhone, type: 'mart_message', title, body, linkTo } })
    }
  } catch {
    // never let a notification failure break the message send itself
  }
}

// Spec: 02-data-model.md §7.1 mart_message row + 03-api.md §8 "sends push in the
// background (never block the request)" — called without `await` at both call sites
// below, after the response has already been sent. Exported so listings.ts's offer
// endpoint (04-screens.md §14.1: "push mart_message to the owner") can reuse the exact
// same notification path rather than a parallel implementation.
export async function notifyNewMessage(threadId: string, senderPhone: string, recipientPhone: string, messageBody: string) {
  try {
    const [recipient, senderInfoMap] = await Promise.all([
      prisma.user.findUnique({ where: { phoneNumber: recipientPhone } }),
      resolveOtherInfo([senderPhone]),
    ])
    const senderName = senderInfoMap.get(senderPhone)?.name || publicName(null, 'casual')
    const notifBody = capText(messageBody, 80)
    await upsertMartMessageNotification(threadId, recipientPhone, senderName, notifBody)
    const prefs = parsePrefs(recipient?.notificationPrefs)
    if (prefs.mart_message) {
      await sendPush(recipient?.pushToken, senderName, notifBody, { screen: 'martThread', threadId })
    }
  } catch {
    // background task — a failure here must never surface to the caller
  }
}

// Spec: 03-api.md §8 POST /mart/threads. "The thread is created only on the first
// send" — the app only ever calls this when no thread exists yet (Detail's
// `myThreadId` short-circuits straight to GET /:threadId otherwise), but the upsert
// still handles a retry/race gracefully by returning the existing thread.
router.post('/', requireProfile, requireRules, async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const { listingId, text } = req.body as { listingId?: string; text?: string }
  if (!listingId || typeof listingId !== 'string') { res.status(400).json({ error: 'Invalid listing', code: 'VALIDATION' }); return }

  const listing = await prisma.martListing.findUnique({ where: { id: listingId } })
  if (!listing || listing.removedAt) { res.status(404).json(NOT_FOUND); return }
  if (listing.ownerPhone === me) { res.status(400).json({ error: "You can't message yourself", code: 'VALIDATION' }); return }

  const blocked = await blockedSet(prisma, me)
  if (blocked.has(listing.ownerPhone)) { res.status(403).json({ error: "You can't message this user", code: 'BLOCKED' }); return }

  if (isCanceled(listing.status)) { res.status(409).json({ error: 'This ad is no longer active', code: 'LISTING_CLOSED' }); return }

  const existing = await prisma.martThread.findUnique({ where: { listingId_otherPhone: { listingId, otherPhone: me } } })
  if (existing) { res.json({ threadId: existing.id, created: false }); return }

  const body = capText(text ?? '', MART_LIMITS.MESSAGE_MAX).trim()
  if (!body) { res.status(400).json({ error: 'Enter a message', code: 'VALIDATION' }); return }

  const openLimit = checkRateLimit('mart-misc', me, MART_RATE_LIMITS.MISC_WRITE.max, MART_RATE_LIMITS.MISC_WRITE.windowMs)
  if (!openLimit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }
  const msgLimit = checkRateLimit('mart-msg', me, MART_RATE_LIMITS.SEND_MESSAGE.max, MART_RATE_LIMITS.SEND_MESSAGE.windowMs)
  if (!msgLimit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const thread = await prisma.martThread.create({
    data: {
      listingId, ownerPhone: listing.ownerPhone, otherPhone: me,
      listingType: listing.type, listingTitle: listing.title, listingThumbUrl: listing.photoUrls[0] || null,
      lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 80), lastMessageSenderPhone: me,
    },
  })
  await prisma.martMessage.create({ data: { threadId: thread.id, senderPhone: me, kind: 'text', body } })
  res.json({ threadId: thread.id, created: true })
  notifyNewMessage(thread.id, me, listing.ownerPhone, body)
})

router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const roleFilter = req.query.role === 'buying' || req.query.role === 'selling' ? req.query.role : 'all'

  const rows = await prisma.martThread.findMany({
    where: {
      OR: [
        { ownerPhone: me, ownerHiddenAt: null },
        { otherPhone: me, otherHiddenAt: null },
      ],
      // Ignored by the inbox per 03-api.md §8's own POST /mart/threads note — a thread
      // with no message yet shouldn't be able to exist via this router, but filtering
      // defensively costs nothing.
      lastMessageSenderPhone: { not: null },
    },
    include: { listing: true },
    orderBy: { lastMessageAt: 'desc' },
  })

  const blocked = await blockedSet(prisma, me)
  const otherPhones = rows.map(r => (r.ownerPhone === me ? r.otherPhone : r.ownerPhone))
  const otherInfoMap = await resolveOtherInfo(otherPhones)

  const visible = rows.filter(r => {
    const otherPhone = r.ownerPhone === me ? r.otherPhone : r.ownerPhone
    if (blocked.has(otherPhone)) return false
    if (!isThreadListingVisible(r.listing)) return false
    const role = roleFor(r.listing.type, r.listing.ownerPhone, me)
    if (roleFilter !== 'all' && role !== roleFilter) return false
    return true
  })

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }
  const startIndex = cursor ? visible.findIndex(r => r.lastMessageAt.toISOString() === cursor.t && r.id === cursor.id) + 1 : 0
  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const page = visible.slice(startIndex, startIndex + limitN)
  const hasMore = startIndex + limitN < visible.length

  const items = page.map(r => {
    const otherPhone = r.ownerPhone === me ? r.otherPhone : r.ownerPhone
    const role = roleFor(r.listing.type, r.listing.ownerPhone, me)
    const myReadAt = r.ownerPhone === me ? r.ownerReadAt : r.otherReadAt
    const unread = r.lastMessageSenderPhone !== me && (!myReadAt || r.lastMessageAt > myReadAt)
    const removed = !!r.listing.removedAt
    // 2026-10-16, Vikum's feedback: the inbox showed "Sold" for the winning thread even
    // while still waiting on the other side's confirmation (dealState 'pending'), which
    // read as contradictory right after he'd gotten a "confirm sale" push for that exact
    // thread — same fix as the chat thread's own pinned header, applied here too.
    // First attempt only checked the seller's own view (dealPartnerPhone === otherPhone,
    // i.e. "the person I'm chatting with is the buyer I chose") — missed the buyer's own
    // view of that same thread, where dealPartnerPhone === me (I AM the chosen buyer),
    // not otherPhone (which is the seller). Both directions need checking.
    // Extended for the decline case (found via a follow-up bug report): `status` stays
    // sold/fulfilled forever after a decline (until Relist), so without this the inbox
    // kept saying "Sold" right after the seller got a "they didn't sell this" push —
    // just as contradictory as the pending case was.
    const isDealThread = !!r.listing.dealPartnerPhone
      && (r.listing.dealPartnerPhone === me || r.listing.dealPartnerPhone === otherPhone)
    const dealStatus = isDealThread && (r.listing.dealState === 'pending' || r.listing.dealState === 'declined')
      ? r.listing.dealState : null
    return {
      id: r.id,
      listing: {
        id: r.listingId, type: r.listingType,
        title: removed ? r.listingTitle : r.listing.title,
        thumbUrl: removed ? r.listingThumbUrl : (r.listing.photoUrls[0] || null),
        status: listingSnapshotStatus(r.listing),
        dealStatus,
      },
      other: otherInfoMap.get(otherPhone) || { id: '', name: publicName(null, 'casual'), photoUrl: null, tag: 'casual' as const },
      lastMessagePreview: r.lastMessagePreview, lastMessageAt: r.lastMessageAt.toISOString(),
      unread, role,
    }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.lastMessageAt.toISOString(), id: last.id }) : null
  res.json({ items, nextCursor })
})

router.get('/unread-count', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const rows = await prisma.martThread.findMany({
    where: {
      OR: [{ ownerPhone: me, ownerHiddenAt: null }, { otherPhone: me, otherHiddenAt: null }],
      lastMessageSenderPhone: { not: null },
    },
    include: { listing: true },
  })
  const blocked = await blockedSet(prisma, me)
  const count = rows.filter(r => {
    const otherPhone = r.ownerPhone === me ? r.otherPhone : r.ownerPhone
    if (blocked.has(otherPhone)) return false
    if (!isThreadListingVisible(r.listing)) return false
    const myReadAt = r.ownerPhone === me ? r.ownerReadAt : r.otherReadAt
    return r.lastMessageSenderPhone !== me && (!myReadAt || r.lastMessageAt > myReadAt)
  }).length
  res.json({ count })
})

const MESSAGE_PAGE_SIZE = 30

// Spec: 03-api.md §8 GET /mart/threads/:threadId. "Side effect: none (read marking is
// its own call)" — opening this does NOT mark the thread read; the app calls
// POST /:threadId/read separately, matching §6's "Opening a thread marks it read"
// behavior at the UI layer rather than baking it into this GET.
router.get('/:threadId', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const thread = await prisma.martThread.findUnique({ where: { id: req.params.threadId as string }, include: { listing: true } })
  if (!thread || (thread.ownerPhone !== me && thread.otherPhone !== me)) { res.status(404).json(NOT_FOUND); return }

  const otherPhone = thread.ownerPhone === me ? thread.otherPhone : thread.ownerPhone
  const blocked = await blockedSet(prisma, me)
  const isBlocked = blocked.has(otherPhone)

  const removed = !!thread.listing.removedAt
  const closed = isCanceled(thread.listing.status)
  const role = roleFor(thread.listing.type, thread.listing.ownerPhone, me)
  const isListingOwner = thread.listing.ownerPhone === me
  // The winning buyer/seller's own thread (dealPartnerPhone === thread.otherPhone)
  // stays sendable past the listing closing — they still need to coordinate pickup/
  // payment/delivery after the deal, unlike every other thread on the same ad, which
  // has nothing left to discuss once it's sold/fulfilled. Product decision 2026-10-15
  // (Vikum): closing the deal thread immediately on mark-sold was blocking exactly the
  // conversation that matters most at that point.
  const isDealThread = !!thread.listing.dealPartnerPhone && thread.listing.dealPartnerPhone === thread.otherPhone
  const canSend = !removed && !isBlocked && (!closed || isDealThread)

  // deal/canRate/dealBanner. The CONFIRMER is always dealPartnerPhone (iAmPartner)
  // regardless of type — but the RATER swaps by type (02-data-model.md §3.3): selling
  // -> the buyer (dealPartnerPhone, i.e. iAmPartner); wanted -> the requester
  // (ownerPhone, i.e. isListingOwner). A bug here showed "Rate seller" to the Wanted
  // seller (iAmPartner) instead of the requester (isListingOwner) — found testing on a
  // real device (2026-10-15): the wrong person could open the rate modal repeatedly,
  // and every attempt was silently treated as "success" by the client even though the
  // backend correctly 404'd it every time (not actually the rater), because the modal's
  // error handling only specifically recognized ALREADY_RATED and failed open for
  // anything else. Both fixed together.
  let deal: { state: string; iAmPartner: boolean; outside: boolean; canRate: boolean } | null = null
  let dealBanner: 'confirm_sale' | 'rate' | null = null
  if (thread.listing.dealState) {
    const iAmPartner = thread.listing.dealPartnerPhone === me
    if (isListingOwner || iAmPartner) {
      const iAmRater = thread.listing.type === 'selling' ? iAmPartner : isListingOwner
      let canRateFlag = false
      if (iAmRater && thread.listing.dealState === 'confirmed') {
        const sellerPhone = thread.listing.type === 'selling' ? thread.listing.ownerPhone : thread.listing.dealPartnerPhone!
        const [alreadyRated, messagedEnough] = await Promise.all([
          prisma.martSellerRating.findFirst({ where: { raterPhone: me, sellerPhone } }),
          threadCanRate(prisma, thread.id, thread.listing.ownerPhone, thread.otherPhone),
        ])
        canRateFlag = !alreadyRated && messagedEnough
      }
      deal = { state: thread.listing.dealState, iAmPartner, outside: thread.listing.dealOutside, canRate: canRateFlag }
      if (iAmPartner && thread.listing.dealState === 'pending') dealBanner = 'confirm_sale'
      else if (canRateFlag) dealBanner = 'rate'
    }
  }

  const otherInfoMap = await resolveOtherInfo([otherPhone])
  const other = otherInfoMap.get(otherPhone) || { id: '', name: publicName(null, 'casual' as const), photoUrl: null, tag: 'casual' as const }

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const msgAnd: any[] = [{ threadId: thread.id }]
  if (cursor) {
    const t = new Date(cursor.t)
    msgAnd.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }
  const msgRows = await prisma.martMessage.findMany({
    where: { AND: msgAnd }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MESSAGE_PAGE_SIZE + 1,
  })
  const hasMoreMsgs = msgRows.length > MESSAGE_PAGE_SIZE
  const msgPage = hasMoreMsgs ? msgRows.slice(0, MESSAGE_PAGE_SIZE) : msgRows
  const lastMsg = msgPage[msgPage.length - 1]
  const nextCursor = hasMoreMsgs && lastMsg ? encodeCursor({ t: lastMsg.createdAt.toISOString(), id: lastMsg.id }) : null

  const messages = msgPage.map(m => ({
    id: m.id, mine: m.senderPhone === me, kind: m.kind, body: m.body,
    offerPrice: m.offerPrice, offerPhotos: m.offerPhotos, systemCode: m.systemCode,
    createdAt: m.createdAt.toISOString(),
  }))

  res.json({
    thread: {
      id: thread.id, role,
      listing: {
        id: thread.listingId, type: thread.listingType,
        title: removed ? thread.listingTitle : thread.listing.title,
        thumbUrl: removed ? thread.listingThumbUrl : (thread.listing.photoUrls[0] || null),
        price: thread.listing.price, budgetMin: thread.listing.budgetMin, budgetMax: thread.listing.budgetMax,
        status: thread.listing.status, closed, removed,
        closedAt: thread.listing.closedAt ? thread.listing.closedAt.toISOString() : null,
        removedAt: thread.listing.removedAt ? thread.listing.removedAt.toISOString() : null,
        deal, isOwner: isListingOwner,
      },
      other, canSend, canRate: deal?.canRate || false, dealBanner,
    },
    messages, nextCursor,
  })
})

// Spec: 03-api.md §8 POST /:threadId/messages.
router.post('/:threadId/messages', requireProfile, requireRules, async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const thread = await prisma.martThread.findUnique({ where: { id: req.params.threadId as string }, include: { listing: true } })
  if (!thread || (thread.ownerPhone !== me && thread.otherPhone !== me)) { res.status(404).json(NOT_FOUND); return }

  const otherPhone = thread.ownerPhone === me ? thread.otherPhone : thread.ownerPhone
  const blocked = await blockedSet(prisma, me)
  if (blocked.has(otherPhone)) { res.status(403).json({ error: "You can't message this user", code: 'BLOCKED' }); return }
  // Same exception as GET /:threadId's canSend: the winning buyer/seller's own thread
  // stays sendable past the listing closing, so this check must mirror that logic
  // rather than just the listing's own status.
  const isDealThread = !!thread.listing.dealPartnerPhone && thread.listing.dealPartnerPhone === thread.otherPhone
  if (thread.listing.removedAt || (isCanceled(thread.listing.status) && !isDealThread)) {
    res.status(403).json({ error: 'This ad is no longer active', code: 'LISTING_CLOSED' }); return
  }

  const { text } = req.body as { text?: string }
  const body = capText(text ?? '', MART_LIMITS.MESSAGE_MAX).trim()
  if (!body) { res.status(400).json({ error: 'Enter a message', code: 'VALIDATION' }); return }

  const limit = checkRateLimit('mart-msg', me, MART_RATE_LIMITS.SEND_MESSAGE.max, MART_RATE_LIMITS.SEND_MESSAGE.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const message = await prisma.martMessage.create({ data: { threadId: thread.id, senderPhone: me, kind: 'text', body } })

  const isMeOwner = thread.ownerPhone === me
  await prisma.martThread.update({
    where: { id: thread.id },
    data: {
      lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, 80), lastMessageSenderPhone: me,
      // Un-hides the thread for the RECIPIENT only — the sender's own hidden flag (if
      // they'd deleted it on their side too) is untouched.
      ...(isMeOwner ? { otherHiddenAt: null } : { ownerHiddenAt: null }),
    },
  })
  res.status(201).json({
    message: {
      id: message.id, mine: true, kind: message.kind, body: message.body,
      offerPrice: message.offerPrice, offerPhotos: message.offerPhotos, systemCode: message.systemCode,
      createdAt: message.createdAt.toISOString(),
    },
  })
  notifyNewMessage(thread.id, me, otherPhone, body)
})

// Spec: 03-api.md §8 POST /:threadId/read.
router.post('/:threadId/read', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const thread = await prisma.martThread.findUnique({ where: { id: req.params.threadId as string } })
  if (!thread || (thread.ownerPhone !== me && thread.otherPhone !== me)) { res.status(404).json(NOT_FOUND); return }

  const isMeOwner = thread.ownerPhone === me
  await prisma.martThread.update({
    where: { id: thread.id },
    data: isMeOwner ? { ownerReadAt: new Date() } : { otherReadAt: new Date() },
  })
  // Marks matching mart_message notifications read (now real since Step 1.9 added
  // notifyNewMessage() above).
  await prisma.appNotification.updateMany({
    where: { userPhone: me, type: 'mart_message', read: false, linkTo: { contains: thread.id } },
    data: { read: true },
  })
  res.json({ ok: true })
})

// Spec: 03-api.md §8 DELETE /:threadId. One-sided, idempotent soft-hide.
router.delete('/:threadId', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const thread = await prisma.martThread.findUnique({ where: { id: req.params.threadId as string } })
  if (!thread) { res.json({ ok: true }); return }
  if (thread.ownerPhone !== me && thread.otherPhone !== me) { res.status(404).json(NOT_FOUND); return }

  const isMeOwner = thread.ownerPhone === me
  await prisma.martThread.update({
    where: { id: thread.id },
    data: isMeOwner ? { ownerHiddenAt: new Date() } : { otherHiddenAt: new Date() },
  })
  res.json({ ok: true })
})

export default router
