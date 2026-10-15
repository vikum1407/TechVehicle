import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { getSellerTags, getSellerRatings, getActiveAdsCounts } from '../../utils/sellerInfo'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { MART_LIMITS } from '../../data/martLimits'
import { buildListingCards } from './listings'
import { getRatingStats } from '../garages'

const prisma = new PrismaClient()
const router = express.Router()

const NOT_FOUND = { error: 'Seller not found', code: 'NOT_FOUND' }

async function resolveSeller(sellerId: string) {
  return prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, phoneNumber: true, displayName: true, district: true, profilePhotoUrl: true, createdAt: true },
  })
}

// "Blocked-me" (the seller blocked the viewer) hides the profile entirely, same as every
// other blocked-relationship check in Mart (02-data-model.md §5). The reverse direction
// (viewer blocked the seller) is NOT a 404 here — the profile still returns, with
// `iBlockedThem: true`, so the viewer can see who they blocked and unblock if they want.
async function blockedByTarget(targetPhone: string, viewerPhone: string): Promise<boolean> {
  const row = await prisma.martBlock.findFirst({ where: { blockerPhone: targetPhone, blockedPhone: viewerPhone } })
  return !!row
}

// Spec: 03-api.md §7 GET /mart/sellers/:sellerId. `sellerId` is always `User.id`, never
// a phone (03-api.md §0's own rule: never return raw phones except a Shop's own public
// contactPhone, section 7).
router.get('/:sellerId', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const target = await resolveSeller(req.params.sellerId as string)
  if (!target) { res.status(404).json(NOT_FOUND); return }
  const isMe = target.phoneNumber === me

  if (!isMe && (await blockedByTarget(target.phoneNumber, me))) { res.status(404).json(NOT_FOUND); return }

  const [tagMap, ratingMap, activeAdsMap, shopProfile, garage] = await Promise.all([
    getSellerTags(prisma, [target.phoneNumber]),
    getSellerRatings(prisma, [target.phoneNumber]),
    getActiveAdsCounts(prisma, [target.phoneNumber]),
    prisma.martShopProfile.findUnique({ where: { ownerPhone: target.phoneNumber } }),
    prisma.garage.findUnique({ where: { ownerPhone: target.phoneNumber }, select: { id: true, verified: true } }),
  ])
  const tag = tagMap.get(target.phoneNumber) || 'casual'
  const rating = ratingMap.get(target.phoneNumber) || { avg: null, count: 0 }

  const [soldCount, iBlockedThemRow, isFollowingRow, serviceStats] = await Promise.all([
    // Mirrors getActiveAdsCounts' own established scope (selling ads only, see its
    // comment in sellerInfo.ts) — "sold" has no meaning for a wanted request (those use
    // 'fulfilled', tracked separately and not part of this stat).
    prisma.martListing.count({ where: { ownerPhone: target.phoneNumber, type: 'selling', status: 'sold', removedAt: null } }),
    isMe ? Promise.resolve(null) : prisma.martBlock.findFirst({ where: { blockerPhone: me, blockedPhone: target.phoneNumber } }),
    isMe ? Promise.resolve(null) : prisma.martFollow.findUnique({ where: { followerPhone_sellerPhone: { followerPhone: me, sellerPhone: target.phoneNumber } } }),
    garage ? getRatingStats(garage.id) : Promise.resolve(null),
  ])

  res.json({
    seller: {
      id: target.id,
      // Same rule as everywhere else a seller's name/photo is shown (04-screens.md §24):
      // Shop shows MartShopProfile.name/logoUrl, never Garage's own name.
      name: shopProfile?.name || publicName(target.displayName, tag),
      tag,
      photoUrl: shopProfile?.logoUrl || target.profilePhotoUrl,
      district: target.district,
      rating,
      verified: tag === 'shop' && !!garage?.verified,
    },
    shop: tag === 'shop' && shopProfile ? {
      about: shopProfile.about,
      contactPhone: shopProfile.contactPhone,
      townAddress: shopProfile.townAddress,
      websiteUrl: shopProfile.websiteUrl,
      googleMapsUrl: shopProfile.googleMapsUrl,
      district: shopProfile.district,
    } : null,
    memberSince: target.createdAt.toISOString(),
    stats: { activeAds: activeAdsMap.get(target.phoneNumber) || 0, soldCount, ratingCount: rating.count },
    serviceRating: serviceStats && serviceStats.ratingCount > 0 ? { avg: serviceStats.avgRating, count: serviceStats.ratingCount } : null,
    isFollowing: !!isFollowingRow,
    isMe,
    iBlockedThem: !!iBlockedThemRow,
  })
})

// Spec: 03-api.md §7 GET /mart/sellers/:sellerId/listings — "active ads only", same
// shared card builder as every other listing list in the app.
router.get('/:sellerId/listings', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const target = await resolveSeller(req.params.sellerId as string)
  if (!target) { res.status(404).json(NOT_FOUND); return }
  if (target.phoneNumber !== me && (await blockedByTarget(target.phoneNumber, me))) { res.status(404).json(NOT_FOUND); return }

  const type = req.query.type === 'wanted' ? 'wanted' : 'selling'
  const activeStatuses = type === 'wanted' ? ['open'] : ['available', 'reserved']

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: Prisma.MartListingWhereInput[] = [
    { ownerPhone: target.phoneNumber, type, status: { in: activeStatuses }, removedAt: null },
  ]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ postedAt: { lt: t } }, { AND: [{ postedAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.martListing.findMany({
    where: { AND: and }, orderBy: [{ postedAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows

  const items = await buildListingCards(page, me)
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.postedAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

// Spec: 03-api.md §7 GET /mart/sellers/:sellerId/reviews?kind=parts|service.
router.get('/:sellerId/reviews', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const target = await resolveSeller(req.params.sellerId as string)
  if (!target) { res.status(404).json(NOT_FOUND); return }
  if (target.phoneNumber !== me && (await blockedByTarget(target.phoneNumber, me))) { res.status(404).json(NOT_FOUND); return }

  const kind = req.query.kind === 'service' ? 'service' : 'parts'

  if (kind === 'service') {
    // Spec: "reuse GET /garages/:id/ratings logic" — same shape (take 30, no cursor) as
    // that existing endpoint, not a new paginated scheme, to minimize touching working
    // garage-rating logic for this.
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: target.phoneNumber }, select: { id: true } })
    if (!garage) { res.status(404).json({ error: 'This seller has no garage ratings', code: 'NOT_FOUND' }); return }

    const [distGroups, reviews, stats] = await Promise.all([
      prisma.garageRating.groupBy({ by: ['rating'], where: { garageId: garage.id }, _count: { rating: true } }),
      prisma.garageRating.findMany({
        where: { garageId: garage.id, comment: { not: null } },
        orderBy: { createdAt: 'desc' }, take: 30,
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
      getRatingStats(garage.id),
    ])
    const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
    distGroups.forEach(g => { distribution[String(g.rating)] = g._count.rating })

    res.json({
      summary: { avg: stats.avgRating, count: stats.ratingCount, distribution },
      items: reviews.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString() })),
      nextCursor: null,
    })
    return
  }

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: Prisma.MartSellerRatingWhereInput[] = [{ sellerPhone: target.phoneNumber }]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const [distGroups, rows] = await Promise.all([
    prisma.martSellerRating.groupBy({ by: ['rating'], where: { sellerPhone: target.phoneNumber }, _count: { rating: true } }),
    prisma.martSellerRating.findMany({
      where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
    }),
  ])
  const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  distGroups.forEach(g => { distribution[String(g.rating)] = g._count.rating })
  const totalCount = Object.values(distribution).reduce((a, b) => a + b, 0)
  const avg = totalCount > 0
    ? Math.round((Object.entries(distribution).reduce((sum, [star, n]) => sum + Number(star) * n, 0) / totalCount) * 10) / 10
    : null

  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({
    summary: { avg, count: totalCount, distribution },
    items: page.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString(), listingTitle: r.listingTitle })),
    nextCursor,
  })
})

export default router
