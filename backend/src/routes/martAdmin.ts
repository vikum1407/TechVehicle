import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import { getSellerTags } from '../utils/sellerInfo'
import { publicName } from '../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../utils/pagination'
import { MART_LIMITS } from '../data/martLimits'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md "GET /admin/reports" + "POST /admin/reports/:id/reviewed" +
// "POST /admin/mart/listings/:id/remove". Mounted at /admin (not /mart) in index.ts,
// guarded by `adminGate` (ADMIN_PHONES only) rather than `martGate` — a stricter,
// separate gate for a genuinely sensitive surface (reporter identities, report
// contents), not just an unshipped-feature check. "Phones are never returned."
router.get('/reports', async (req: AuthRequest, res) => {
  const status = req.query.status === 'reviewed' ? 'reviewed' : 'open'

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: any[] = [{ status }]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.martReport.findMany({
    where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows

  if (page.length === 0) { res.json({ items: [], nextCursor: null }); return }

  const reporterPhones = [...new Set(page.map(r => r.reporterPhone))]
  const targetPhones = [...new Set(page.filter(r => r.targetPhone).map(r => r.targetPhone as string))]
  const allPhones = [...new Set([...reporterPhones, ...targetPhones])]

  const [users, tagMap, openCountGroups] = await Promise.all([
    prisma.user.findMany({ where: { phoneNumber: { in: allPhones } }, select: { id: true, phoneNumber: true, displayName: true } }),
    getSellerTags(prisma, allPhones),
    prisma.martReport.groupBy({
      by: ['targetType', 'targetId'],
      where: { status: 'open', OR: page.map(r => ({ targetType: r.targetType, targetId: r.targetId })) },
      _count: { _all: true },
    }),
  ])
  const userByPhone = new Map(users.map(u => [u.phoneNumber, u]))
  const openCountMap = new Map(openCountGroups.map(g => [`${g.targetType}:${g.targetId}`, g._count._all]))

  const items = page.map(r => {
    const reporterUser = userByPhone.get(r.reporterPhone)
    const targetUser = r.targetPhone ? userByPhone.get(r.targetPhone) : undefined
    return {
      id: r.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, note: r.note,
      status: r.status, createdAt: r.createdAt.toISOString(),
      reporter: { id: reporterUser?.id || '', name: publicName(reporterUser?.displayName, tagMap.get(r.reporterPhone) || 'casual') },
      target: {
        title: r.targetTitle || r.targetSnippet || undefined,
        ownerName: targetUser ? publicName(targetUser.displayName, tagMap.get(r.targetPhone!) || 'casual') : undefined,
        ownerId: targetUser?.id || undefined,
      },
      openReportsForTarget: openCountMap.get(`${r.targetType}:${r.targetId}`) || 0,
    }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

router.post('/reports/:id/reviewed', async (req: AuthRequest, res) => {
  await prisma.martReport.updateMany({ where: { id: req.params.id as string }, data: { status: 'reviewed' } })
  res.json({ ok: true })
})

// "Admin actions on accounts are manual (SQL) in Phase 1" — this is the one admin
// action that IS wired up: approving a report by removing the listing it's about.
router.post('/mart/listings/:id/remove', async (req: AuthRequest, res) => {
  const listing = await prisma.martListing.findUnique({ where: { id: req.params.id as string } })
  if (!listing) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return }
  await prisma.martListing.update({ where: { id: listing.id }, data: { removedAt: new Date() } })
  res.json({ ok: true })
})

export default router
