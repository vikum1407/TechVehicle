// Spec: 02-data-model.md §6 "Computed values". Every function here is batched (one query
// per page, never one query per card) — all take an array of phones and return a Map.
import { PrismaClient } from '@prisma/client'
import { MART_LIMITS } from '../data/martLimits'

const { SHOP_MIN_ADS, SHOP_WINDOW_DAYS } = MART_LIMITS

// shop = has a Garage row OR >= SHOP_MIN_ADS selling ads in the last SHOP_WINDOW_DAYS days.
export async function getSellerTags(
  prisma: PrismaClient,
  phones: string[]
): Promise<Map<string, 'shop' | 'casual'>> {
  const result = new Map<string, 'shop' | 'casual'>()
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return result

  const [garages, adCounts] = await Promise.all([
    prisma.garage.findMany({ where: { ownerPhone: { in: uniquePhones } }, select: { ownerPhone: true } }),
    prisma.martListing.groupBy({
      by: ['ownerPhone'],
      where: {
        ownerPhone: { in: uniquePhones },
        type: 'selling',
        removedAt: null,
        createdAt: { gte: new Date(Date.now() - SHOP_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
    }),
  ])

  const garagePhones = new Set(garages.map(g => g.ownerPhone))
  const adCountMap = new Map(adCounts.map(a => [a.ownerPhone, a._count._all]))

  for (const phone of uniquePhones) {
    const isShop = garagePhones.has(phone) || (adCountMap.get(phone) || 0) >= SHOP_MIN_ADS
    result.set(phone, isShop ? 'shop' : 'casual')
  }
  return result
}

// avg rounded to 1 decimal, null avg + 0 count when the seller has no ratings yet.
export async function getSellerRatings(
  prisma: PrismaClient,
  phones: string[]
): Promise<Map<string, { avg: number | null; count: number }>> {
  const result = new Map<string, { avg: number | null; count: number }>()
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return result

  for (const phone of uniquePhones) result.set(phone, { avg: null, count: 0 })

  const groups = await prisma.martSellerRating.groupBy({
    by: ['sellerPhone'],
    where: { sellerPhone: { in: uniquePhones } },
    _avg: { rating: true },
    _count: { _all: true },
  })
  for (const g of groups) {
    const avg = g._avg.rating !== null ? Math.round(g._avg.rating * 10) / 10 : null
    result.set(g.sellerPhone, { avg, count: g._count._all })
  }
  return result
}

// Used on the Detail seller row ("6 active ads") and Seller Profile's "Ads N" tab —
// both contexts mean active SELLING ads (available or reserved), not wanted requests.
export async function getActiveAdsCounts(
  prisma: PrismaClient,
  phones: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return result

  for (const phone of uniquePhones) result.set(phone, 0)

  const groups = await prisma.martListing.groupBy({
    by: ['ownerPhone'],
    where: {
      ownerPhone: { in: uniquePhones },
      type: 'selling',
      status: { in: ['available', 'reserved'] },
      removedAt: null,
    },
    _count: { _all: true },
  })
  for (const g of groups) result.set(g.ownerPhone, g._count._all)
  return result
}
