import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { MART_RATE_LIMITS } from '../../data/martLimits'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md §7 Follows. Only POST/DELETE built now (Milestone 2 Step 2.7 —
// needed to make the Seller Public Profile's Follow button real, not a stub).
// GET /mart/follows (the Followings list screen) and /follows/feed are their own
// Step 2.8 per 05-build-plan.md's explicit split — not built here.
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

export default router
