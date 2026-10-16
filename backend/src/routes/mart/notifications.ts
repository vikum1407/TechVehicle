import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'
import { MART_LIMITS } from '../../data/martLimits'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md §0, 02-data-model.md §7.2, 04-screens.md §13 "Notification center".
// Mart-only view over the existing shared `AppNotification` table (same one every other
// notification type already writes to, including the 8 mart_* types built across Steps
// 1.9-2.8) — filtered to `type` starting with "mart_", never touching the existing
// (non-Mart) /notifications routes or their own rows.
router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const and: Prisma.AppNotificationWhereInput[] = [{ userPhone: me, type: { startsWith: 'mart_' } }]
  if (cursor) {
    const t = new Date(cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { AND: [{ createdAt: t }, { id: { lt: cursor.id } }] }] })
  }

  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)
  const rows = await prisma.appNotification.findMany({
    where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows

  const items = page.map(n => {
    let linkTo: object | null = null
    if (n.linkTo) {
      try { linkTo = JSON.parse(n.linkTo) } catch { linkTo = null }
    }
    return { id: n.id, type: n.type, title: n.title, body: n.body, linkTo, read: n.read, createdAt: n.createdAt.toISOString() }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null

  res.json({ items, nextCursor })
})

router.get('/unread-count', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const count = await prisma.appNotification.count({ where: { userPhone: me, type: { startsWith: 'mart_' }, read: false } })
  res.json({ count })
})

router.post('/read-all', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  await prisma.appNotification.updateMany({
    where: { userPhone: me, type: { startsWith: 'mart_' }, read: false },
    data: { read: true },
  })
  res.json({ ok: true })
})

router.post('/:id/read', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  // Own rows only — updateMany with the ownership check baked into `where` rather than
  // a separate findUnique-then-update, so this is naturally idempotent (a row that
  // doesn't belong to me or doesn't exist just updates 0 rows, no error either way).
  await prisma.appNotification.updateMany({
    where: { id: req.params.id as string, userPhone: me, type: { startsWith: 'mart_' } },
    data: { read: true },
  })
  res.json({ ok: true })
})

export default router
