import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { capText } from '../../utils/validate'
import { DISTRICTS } from '../../data/districts'
import { MART_RULES_VERSION } from '../../data/martRules'
import { MART_LIMITS } from '../../data/martLimits'
import { getSellerTags, getSellerRatings, getActiveAdsCounts } from '../../utils/sellerInfo'
import { getRatingStats } from '../garages'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 02-data-model.md §4.7. Exported for direct unit testing.
const DISPLAY_NAME_RE = /^[\p{L}\p{M}\p{N} .'-]+$/u
export function isValidDisplayName(name: string): boolean {
  return name.length >= MART_LIMITS.DISPLAY_NAME_MIN && name.length <= MART_LIMITS.DISPLAY_NAME_MAX && DISPLAY_NAME_RE.test(name)
}
export function isValidDistrict(id: string): boolean {
  return DISTRICTS.some(d => d.id === id)
}

// Shared by GET and PATCH (PATCH returns the same shape after saving). Spec: 03-api.md §2.
export async function buildMeResponse(phoneNumber: string) {
  const user = await prisma.user.findUnique({ where: { phoneNumber } })
  if (!user) return null

  const [garage, shopProfile, tagMap, ratingMap, activeAdsMap] = await Promise.all([
    prisma.garage.findUnique({ where: { ownerPhone: phoneNumber }, select: { id: true } }),
    prisma.martShopProfile.findUnique({ where: { ownerPhone: phoneNumber }, select: { id: true } }),
    getSellerTags(prisma, [phoneNumber]),
    getSellerRatings(prisma, [phoneNumber]),
    getActiveAdsCounts(prisma, [phoneNumber]),
  ])

  const [statusGroups, unreadNotifCount, followingsCount, favoritesCount, reviewsCount, blockedCount] = await Promise.all([
    prisma.martListing.groupBy({
      by: ['status'],
      where: { ownerPhone: phoneNumber, type: 'selling', removedAt: null },
      _count: { _all: true },
    }),
    prisma.appNotification.count({ where: { userPhone: phoneNumber, type: { startsWith: 'mart_' }, read: false } }),
    prisma.martFollow.count({ where: { followerPhone: phoneNumber } }),
    prisma.martFavorite.count({ where: { userPhone: phoneNumber } }),
    prisma.martSellerRating.count({ where: { sellerPhone: phoneNumber } }),
    prisma.martBlock.count({ where: { blockerPhone: phoneNumber } }),
  ])
  // "Unread thread" needs lastMessageAt > myReadAt, where myReadAt is ownerReadAt or
  // otherReadAt depending on my role in that specific thread — Prisma can't compare two
  // columns of the same row without raw SQL. No Chat UI exists yet (Milestone 1.8), so
  // deferring the real query to that step rather than shipping an unverifiable one now.
  const unreadThreadCount = 0

  const statusCount = (s: string) => statusGroups.find(g => g.status === s)?._count._all || 0

  let serviceRating: { avg: number | null; count: number } | null = null
  if (garage) {
    const stats = await getRatingStats(garage.id)
    if (stats.ratingCount > 0) serviceRating = { avg: stats.avgRating, count: stats.ratingCount }
  }

  return {
    id: user.id,
    displayName: user.displayName,
    district: user.district,
    rulesAccepted: !!user.martRulesAcceptedAt && user.martRulesVersion === MART_RULES_VERSION,
    rulesVersion: user.martRulesVersion,
    currentRulesVersion: MART_RULES_VERSION,
    tag: tagMap.get(phoneNumber) || 'casual',
    hasGarage: !!garage,
    hasShopProfile: !!shopProfile,
    photoUrl: user.profilePhotoUrl,
    rating: ratingMap.get(phoneNumber) || { avg: null, count: 0 },
    serviceRating,
    counts: {
      activeAds: activeAdsMap.get(phoneNumber) || 0,
      unreadThreads: unreadThreadCount,
      unreadNotifications: unreadNotifCount,
      followings: followingsCount,
      available: statusCount('available'),
      reserved: statusCount('reserved'),
      sold: statusCount('sold'),
      favorites: favoritesCount,
      reviews: reviewsCount,
      blocked: blockedCount,
    },
  }
}

router.get('/', async (req: AuthRequest, res) => {
  const data = await buildMeResponse(req.phoneNumber!)
  if (!data) { res.status(404).json({ error: 'Not found' }); return }
  res.json(data)
})

router.patch('/', async (req: AuthRequest, res) => {
  const limit = checkRateLimit('mart-misc', req.phoneNumber!, 60, 60 * 60 * 1000)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const { displayName, district, profilePhotoUrl } = req.body as { displayName?: string; district?: string; profilePhotoUrl?: string }
  const data: Record<string, string> = {}

  if (displayName !== undefined) {
    const trimmed = capText(displayName, MART_LIMITS.DISPLAY_NAME_MAX).trim()
    if (!isValidDisplayName(trimmed)) { res.status(400).json({ error: 'Enter a valid name (2-40 characters)', code: 'VALIDATION' }); return }
    data.displayName = trimmed
  }
  if (district !== undefined) {
    if (!isValidDistrict(district)) { res.status(400).json({ error: 'Select a valid district', code: 'VALIDATION' }); return }
    data.district = district
  }
  if (profilePhotoUrl !== undefined) {
    const publicUrl = process.env.R2_PUBLIC_URL || ''
    if (!profilePhotoUrl.startsWith(`${publicUrl}/mart-photos/`)) { res.status(400).json({ error: 'Invalid photo', code: 'VALIDATION' }); return }
    data.profilePhotoUrl = profilePhotoUrl
  }

  await prisma.user.update({ where: { phoneNumber: req.phoneNumber! }, data })
  const result = await buildMeResponse(req.phoneNumber!)
  res.json(result)
})

export default router
