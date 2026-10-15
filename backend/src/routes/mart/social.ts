import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { MART_RATE_LIMITS, MART_LIMITS } from '../../data/martLimits'
import { getSellerTags, getSellerRatings, getActiveAdsCounts } from '../../utils/sellerInfo'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { resolveOtherInfo } from './threads'
import { createNotification } from '../../utils/appNotifications'
import { sendPush } from '../../utils/push'
import { parsePrefs } from '../../utils/notificationPrefs'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md §7 Follows. POST/DELETE built in Milestone 2 Step 2.7 (needed to make
// the Seller Public Profile's Follow button real). GET / (the Followings list screen)
// added in Step 2.8. /follows/feed is explicitly "no screen uses it at launch... implement
// last or skip" per 03-api.md §7 — skipped, same as that line invites.
//
// Added 2026-10-15, Vikum's request: notify the seller when someone follows them —
// only on a genuinely NEW follow (checked via `existing` below), never re-notifying on
// an idempotent repeat POST of an already-active follow.
router.post('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const { sellerId } = req.body as { sellerId?: string }
  if (!sellerId || typeof sellerId !== 'string') { res.status(400).json({ error: 'Invalid seller', code: 'VALIDATION' }); return }

  const limit = checkRateLimit('mart-social', me, MART_RATE_LIMITS.FOLLOW_BLOCK.max, MART_RATE_LIMITS.FOLLOW_BLOCK.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const [target, meUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: sellerId }, select: { phoneNumber: true } }),
    prisma.user.findUnique({ where: { phoneNumber: me }, select: { id: true } }),
  ])
  if (!target) { res.status(404).json({ error: 'Seller not found', code: 'NOT_FOUND' }); return }
  if (target.phoneNumber === me) { res.status(400).json({ error: "You can't follow yourself", code: 'VALIDATION' }); return }

  const blocked = await prisma.martBlock.findFirst({
    where: { OR: [{ blockerPhone: me, blockedPhone: target.phoneNumber }, { blockerPhone: target.phoneNumber, blockedPhone: me }] },
  })
  if (blocked) { res.status(404).json({ error: 'Seller not found', code: 'NOT_FOUND' }); return }

  const existing = await prisma.martFollow.findUnique({
    where: { followerPhone_sellerPhone: { followerPhone: me, sellerPhone: target.phoneNumber } },
  })
  await prisma.martFollow.upsert({
    where: { followerPhone_sellerPhone: { followerPhone: me, sellerPhone: target.phoneNumber } },
    create: { followerPhone: me, sellerPhone: target.phoneNumber },
    update: {},
  })
  res.json({ ok: true })

  if (!existing) notifyNewFollower(target.phoneNumber, me, meUser?.id || '').catch(() => {})
})

async function notifyNewFollower(sellerPhone: string, followerPhone: string, followerId: string) {
  const [followerInfoMap, sellerUser] = await Promise.all([
    resolveOtherInfo([followerPhone]),
    prisma.user.findUnique({ where: { phoneNumber: sellerPhone }, select: { pushToken: true, notificationPrefs: true } }),
  ])
  const followerName = followerInfoMap.get(followerPhone)?.name || publicName(null, 'casual')
  const title = `${followerName} started following you`
  const linkTo = { screen: 'martSellerProfile', sellerId: followerId }
  await createNotification(prisma, sellerPhone, 'mart_new_follower', title, '', linkTo)
  if (parsePrefs(sellerUser?.notificationPrefs).mart_follow) {
    await sendPush(sellerUser?.pushToken, title, '', linkTo)
  }
}

router.delete('/:sellerId', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const target = await prisma.user.findUnique({ where: { id: req.params.sellerId as string }, select: { phoneNumber: true } })
  if (target) {
    await prisma.martFollow.deleteMany({ where: { followerPhone: me, sellerPhone: target.phoneNumber } })
  }
  res.json({ ok: true })
})

// Shared by GET / (Followings) and GET /followers — both return the same enriched
// "person card" shape, just keyed off the opposite side of a MartFollow row.
async function buildFollowRows(phones: string[]) {
  if (phones.length === 0) return new Map<string, any>()

  const [users, tagMap, ratingMap, activeAdsMap, shopProfiles, garages, newestAdRows] = await Promise.all([
    prisma.user.findMany({ where: { phoneNumber: { in: phones } }, select: { id: true, phoneNumber: true, displayName: true, district: true, profilePhotoUrl: true } }),
    getSellerTags(prisma, phones),
    getSellerRatings(prisma, phones),
    getActiveAdsCounts(prisma, phones),
    prisma.martShopProfile.findMany({ where: { ownerPhone: { in: phones } } }),
    prisma.garage.findMany({ where: { ownerPhone: { in: phones } }, select: { ownerPhone: true, verified: true } }),
    prisma.martListing.groupBy({ by: ['ownerPhone'], where: { ownerPhone: { in: phones }, type: 'selling', removedAt: null }, _max: { postedAt: true } }),
  ])
  const userByPhone = new Map(users.map(u => [u.phoneNumber, u]))
  const shopByPhone = new Map(shopProfiles.map(s => [s.ownerPhone, s]))
  const garageVerifiedByPhone = new Map(garages.map(g => [g.ownerPhone, g.verified]))
  const newestAdByPhone = new Map(newestAdRows.map(r => [r.ownerPhone, r._max.postedAt]))

  const result = new Map<string, any>()
  for (const phone of phones) {
    const user = userByPhone.get(phone)
    const tag = tagMap.get(phone) || 'casual'
    const shop = shopByPhone.get(phone)
    result.set(phone, {
      seller: {
        id: user?.id || '',
        name: shop?.name || publicName(user?.displayName, tag),
        tag,
        photoUrl: shop?.logoUrl || user?.profilePhotoUrl || null,
        district: user?.district || null,
        rating: ratingMap.get(phone) || { avg: null, count: 0 },
        verified: tag === 'shop' && !!garageVerifiedByPhone.get(phone),
      },
      townAddress: shop?.townAddress || null,
      activeAdsCount: activeAdsMap.get(phone) || 0,
      newestAdAt: newestAdByPhone.get(phone)?.toISOString() || null,
    })
  }
  return result
}

// Spec: 03-api.md §7 GET /mart/follows, 04-screens.md §18. Ordered by most recently
// followed (createdAt desc). Row needs `townAddress` for a Shop's area line (point 3:
// "For Shops use MartShopProfile town; else district") — an extra field beyond the
// documented minimal response shape, added since the data model already has it and the
// screen's own spec explicitly asks for it.
router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: any[] = [{ followerPhone: me }]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.martFollow.findMany({
    where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows
  const rowsByPhone = await buildFollowRows(page.map(r => r.sellerPhone))

  const items = page.map(f => rowsByPhone.get(f.sellerPhone)).filter(Boolean)
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

// Added 2026-10-15, Vikum's request: a basic follower dashboard — "who follows me" was
// never in the original spec at all (no endpoint, no screen, not even a `followers`
// count anywhere). Same shape/pagination as GET / above, just reversed: keyed off
// `sellerPhone = me` instead of `followerPhone = me`. No unfollow button makes sense
// here (that's the follower's own choice, not something the seller controls from this
// side) — the mobile screen renders these rows read-only.
router.get('/followers', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: any[] = [{ sellerPhone: me }]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.martFollow.findMany({
    where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows
  const rowsByPhone = await buildFollowRows(page.map(r => r.followerPhone))

  const items = page.map(f => rowsByPhone.get(f.followerPhone)).filter(Boolean)
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

export default router
