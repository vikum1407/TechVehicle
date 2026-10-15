import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { MART_RATE_LIMITS, MART_LIMITS } from '../../data/martLimits'
import { getSellerTags, getSellerRatings, getActiveAdsCounts } from '../../utils/sellerInfo'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md §7 Follows. POST/DELETE built in Milestone 2 Step 2.7 (needed to make
// the Seller Public Profile's Follow button real). GET / (the Followings list screen)
// added in Step 2.8. /follows/feed is explicitly "no screen uses it at launch... implement
// last or skip" per 03-api.md §7 — skipped, same as that line invites.
router.post('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const { sellerId } = req.body as { sellerId?: string }
  if (!sellerId || typeof sellerId !== 'string') { res.status(400).json({ error: 'Invalid seller', code: 'VALIDATION' }); return }

  const limit = checkRateLimit('mart-social', me, MART_RATE_LIMITS.FOLLOW_BLOCK.max, MART_RATE_LIMITS.FOLLOW_BLOCK.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const target = await prisma.user.findUnique({ where: { id: sellerId }, select: { phoneNumber: true } })
  if (!target) { res.status(404).json({ error: 'Seller not found', code: 'NOT_FOUND' }); return }
  if (target.phoneNumber === me) { res.status(400).json({ error: "You can't follow yourself", code: 'VALIDATION' }); return }

  const blocked = await prisma.martBlock.findFirst({
    where: { OR: [{ blockerPhone: me, blockedPhone: target.phoneNumber }, { blockerPhone: target.phoneNumber, blockedPhone: me }] },
  })
  if (blocked) { res.status(404).json({ error: 'Seller not found', code: 'NOT_FOUND' }); return }

  await prisma.martFollow.upsert({
    where: { followerPhone_sellerPhone: { followerPhone: me, sellerPhone: target.phoneNumber } },
    create: { followerPhone: me, sellerPhone: target.phoneNumber },
    update: {},
  })
  res.json({ ok: true })
})

router.delete('/:sellerId', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const target = await prisma.user.findUnique({ where: { id: req.params.sellerId as string }, select: { phoneNumber: true } })
  if (target) {
    await prisma.martFollow.deleteMany({ where: { followerPhone: me, sellerPhone: target.phoneNumber } })
  }
  res.json({ ok: true })
})

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
  const sellerPhones = page.map(r => r.sellerPhone)

  if (sellerPhones.length === 0) { res.json({ items: [], nextCursor: null }); return }

  const [users, tagMap, ratingMap, activeAdsMap, shopProfiles, garages, newestAdRows] = await Promise.all([
    prisma.user.findMany({ where: { phoneNumber: { in: sellerPhones } }, select: { id: true, phoneNumber: true, displayName: true, district: true, profilePhotoUrl: true } }),
    getSellerTags(prisma, sellerPhones),
    getSellerRatings(prisma, sellerPhones),
    getActiveAdsCounts(prisma, sellerPhones),
    prisma.martShopProfile.findMany({ where: { ownerPhone: { in: sellerPhones } } }),
    prisma.garage.findMany({ where: { ownerPhone: { in: sellerPhones } }, select: { ownerPhone: true, verified: true } }),
    prisma.martListing.groupBy({ by: ['ownerPhone'], where: { ownerPhone: { in: sellerPhones }, type: 'selling', removedAt: null }, _max: { postedAt: true } }),
  ])
  const userByPhone = new Map(users.map(u => [u.phoneNumber, u]))
  const shopByPhone = new Map(shopProfiles.map(s => [s.ownerPhone, s]))
  const garageVerifiedByPhone = new Map(garages.map(g => [g.ownerPhone, g.verified]))
  const newestAdByPhone = new Map(newestAdRows.map(r => [r.ownerPhone, r._max.postedAt]))

  const items = page.map(f => {
    const phone = f.sellerPhone
    const user = userByPhone.get(phone)
    const tag = tagMap.get(phone) || 'casual'
    const shop = shopByPhone.get(phone)
    return {
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
    }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

export default router
