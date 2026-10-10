import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { getSellerTags } from '../../utils/sellerInfo'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { MART_LIMITS } from '../../data/martLimits'
import { buildListingCards } from './listings'

const prisma = new PrismaClient()
const router = express.Router()

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

// Spec: 03-api.md §4 GET /mart/my-ads + 02-data-model.md §3.4 ("sold tab = sold/fulfilled
// with closedAt within the last 90 days"). "active" is kept as an alias tab (available +
// reserved for selling, open for wanted) even though the mobile screen built in this step
// uses the 3 named tabs directly — some future caller (e.g. a notification link) may want
// "whichever active status" without picking one.
function tabToStatuses(type: string, tab: string): string[] | null {
  if (type === 'wanted') {
    if (tab === 'open' || tab === 'active') return ['open']
    if (tab === 'fulfilled') return ['fulfilled']
    return null
  }
  if (tab === 'available') return ['available']
  if (tab === 'reserved') return ['reserved']
  if (tab === 'active') return ['available', 'reserved']
  if (tab === 'sold') return ['sold']
  return null
}

router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const type = req.query.type === 'wanted' ? 'wanted' : 'selling'
  const tab = typeof req.query.tab === 'string' ? req.query.tab : (type === 'wanted' ? 'open' : 'available')
  const statuses = tabToStatuses(type, tab)
  if (!statuses) { res.status(400).json({ error: 'Invalid tab', code: 'VALIDATION' }); return }

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const isSoldTab = statuses.includes('sold') || statuses.includes('fulfilled')
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS)

  const and: Prisma.MartListingWhereInput[] = [
    { ownerPhone: me, type, removedAt: null, status: { in: statuses } },
    ...(isSoldTab ? [{ closedAt: { gte: ninetyDaysAgo } }] : []),
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

  const listingIds = page.map(r => r.id)
  const [cards, favGroups, threadGroups] = await Promise.all([
    buildListingCards(page, me),
    prisma.martFavorite.groupBy({ by: ['listingId'], where: { listingId: { in: listingIds } }, _count: { _all: true } }),
    // "Chats/replies count" = MartThread rows for this listing. A thread only ever gets
    // created once its first message is sent (03-api.md §23 point 11), so every row here
    // already has >= 1 message by construction — no extra message-count filter needed.
    // Unreachable with real data until Chat ships (Step 1.8); implemented correctly now
    // rather than left as a TODO, same as other backend-ahead-of-UI pieces this build.
    prisma.martThread.groupBy({ by: ['listingId'], where: { listingId: { in: listingIds } }, _count: { _all: true } }),
  ])
  const favMap = new Map(favGroups.map(f => [f.listingId, f._count._all]))
  const threadMap = new Map(threadGroups.map(t => [t.listingId, t._count._all]))

  // dealPartnerPhone/dealState are always null until Mark Sold ships (Milestone 2 Step
  // 2.4) — this still resolves partnerName correctly once that's true, with zero changes
  // needed here later.
  const partnerPhones = [...new Set(page.filter(r => r.dealPartnerPhone).map(r => r.dealPartnerPhone as string))]
  const [partnerUsers, partnerTags] = partnerPhones.length > 0
    ? await Promise.all([
        prisma.user.findMany({ where: { phoneNumber: { in: partnerPhones } }, select: { phoneNumber: true, displayName: true } }),
        getSellerTags(prisma, partnerPhones),
      ])
    : [[] as { phoneNumber: string; displayName: string | null }[], new Map<string, 'shop' | 'casual'>()]
  const partnerUserByPhone = new Map(partnerUsers.map(u => [u.phoneNumber, u]))

  const items = page.map((listing, i) => {
    const partnerPhone = listing.dealPartnerPhone
    const partnerName = partnerPhone
      ? publicName(partnerUserByPhone.get(partnerPhone)?.displayName, partnerTags.get(partnerPhone) || 'casual')
      : null
    return {
      ...cards[i],
      favoritesCount: favMap.get(listing.id) || 0,
      ...(type === 'wanted'
        ? { repliesCount: threadMap.get(listing.id) || 0 }
        : { chatsCount: threadMap.get(listing.id) || 0 }),
      dealState: listing.dealState,
      partnerName,
    }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.postedAt.toISOString(), id: last.id }) : null

  const [activeGroups, soldOrFulfilledCount] = await Promise.all([
    prisma.martListing.groupBy({
      by: ['status'],
      where: { ownerPhone: me, type, removedAt: null, status: { in: type === 'wanted' ? ['open'] : ['available', 'reserved'] } },
      _count: { _all: true },
    }),
    // Matches the sold tab's own 90-day window so the count badge never disagrees with
    // what that tab actually shows.
    prisma.martListing.count({
      where: { ownerPhone: me, type, removedAt: null, status: { in: type === 'wanted' ? ['fulfilled'] : ['sold'] }, closedAt: { gte: ninetyDaysAgo } },
    }),
  ])
  const counts = type === 'wanted'
    ? { open: activeGroups.find(g => g.status === 'open')?._count._all || 0, fulfilled: soldOrFulfilledCount }
    : {
        available: activeGroups.find(g => g.status === 'available')?._count._all || 0,
        reserved: activeGroups.find(g => g.status === 'reserved')?._count._all || 0,
        sold: soldOrFulfilledCount,
      }

  res.json({ items, nextCursor, counts })
})

export default router
