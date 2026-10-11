import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { blockedSet } from '../../utils/blockedSet'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { MART_LIMITS, MART_RATE_LIMITS } from '../../data/martLimits'
import { buildListingCards } from './listings'

const prisma = new PrismaClient()
const router = express.Router()

const NOT_FOUND = { error: 'This ad is no longer available', code: 'NOT_FOUND' }

// Spec: 03-api.md §6. POST/DELETE are idempotent (repeat calls are a no-op success, no
// error) via the unique (userPhone, listingId) pair.
router.post('/', async (req: AuthRequest, res) => {
  const { listingId } = req.body as { listingId?: string }
  if (!listingId || typeof listingId !== 'string') { res.status(400).json({ error: 'Invalid listing', code: 'VALIDATION' }); return }

  const me = req.phoneNumber!
  const limit = checkRateLimit('mart-fav', me, MART_RATE_LIMITS.FAVORITE.max, MART_RATE_LIMITS.FAVORITE.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  // "Listing must be visible" — same visibility rule as GET /mart/listings/:id (02 §3.4):
  // not removed, active OR within the 7-day closed window, owner not blocked.
  const listing = await prisma.martListing.findUnique({ where: { id: listingId } })
  if (!listing || listing.removedAt) { res.status(404).json(NOT_FOUND); return }
  const blocked = await blockedSet(prisma, me)
  if (blocked.has(listing.ownerPhone)) { res.status(404).json(NOT_FOUND); return }
  const activeStatuses = listing.type === 'wanted' ? ['open'] : ['available', 'reserved']
  const isActive = activeStatuses.includes(listing.status)
  const withinClosedWindow = !!listing.closedAt && (Date.now() - listing.closedAt.getTime()) < 7 * 24 * 60 * 60 * 1000
  if (!isActive && !withinClosedWindow) { res.status(404).json(NOT_FOUND); return }

  await prisma.martFavorite.upsert({
    where: { userPhone_listingId: { userPhone: me, listingId } },
    create: { userPhone: me, listingId },
    update: {},
  })
  res.json({ ok: true })
})

router.delete('/:listingId', async (req: AuthRequest, res) => {
  await prisma.martFavorite.deleteMany({ where: { userPhone: req.phoneNumber!, listingId: req.params.listingId as string } })
  res.json({ ok: true })
})

// Spec: 03-api.md §6 GET /mart/favorites. Removed ads return a minimal card (title,
// cover, unavailable:'removed') rather than the full ListingCard shape — deliberately
// less detail than an active or sold ad, since the ad may have been removed for a
// reason the favoriter has no need to see more of.
function buildFavoritesListingWhere(filter: string, blockedPhones: string[]): Prisma.MartListingWhereInput {
  const and: Prisma.MartListingWhereInput[] = []
  if (blockedPhones.length > 0) and.push({ ownerPhone: { notIn: blockedPhones } })
  if (filter === 'available') {
    and.push({ removedAt: null })
    and.push({ OR: [{ type: 'selling', status: { in: ['available', 'reserved'] } }, { type: 'wanted', status: 'open' }] })
  } else if (filter === 'closed') {
    and.push({ OR: [{ removedAt: { not: null } }, { status: { in: ['sold', 'fulfilled'] } }] })
  }
  return and.length > 0 ? { AND: and } : {}
}

router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const filter = req.query.filter === 'available' || req.query.filter === 'closed' ? req.query.filter : 'all'
  const blocked = await blockedSet(prisma, me)
  const blockedList = [...blocked]

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const listingWhere = buildFavoritesListingWhere(filter, blockedList)
  const and: Prisma.MartFavoriteWhereInput[] = [
    { userPhone: me, ...(Object.keys(listingWhere).length > 0 ? { listing: listingWhere } : {}) },
  ]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.martFavorite.findMany({
    where: { AND: and }, include: { listing: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows

  const visibleListings = page.filter(r => !r.listing.removedAt).map(r => r.listing)
  const cards = await buildListingCards(visibleListings, me)
  const cardByListingId = new Map(cards.map(c => [c.id, c]))

  const items = page.map(r => {
    if (r.listing.removedAt) {
      return { id: r.listing.id, title: r.listing.title, coverUrl: r.listing.photoUrls[0] || null, unavailable: 'removed' as const }
    }
    const card = cardByListingId.get(r.listing.id)!
    const unavailable = (r.listing.status === 'sold' || r.listing.status === 'fulfilled') ? ('sold' as const) : null
    return { ...card, unavailable }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  // "count" is the total saved regardless of which filter chip is selected (the "5
  // saved" header count), but still respects blocks for the same reason the list does.
  const count = await prisma.martFavorite.count({
    where: { userPhone: me, ...(blockedList.length > 0 ? { listing: { ownerPhone: { notIn: blockedList } } } : {}) },
  })

  res.json({ items, nextCursor, count })
})

export default router
