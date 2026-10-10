import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { MART_RULES_VERSION } from '../../data/martRules'

const prisma = new PrismaClient()
const router = express.Router()

// Mounted at /mart/rules/accept (not nested under /mart/me) — spec: 03-api.md §2.
router.post('/accept', async (req: AuthRequest, res) => {
  const { version } = req.body as { version?: number }
  if (version !== MART_RULES_VERSION) { res.status(400).json({ error: 'Rules version mismatch', code: 'VALIDATION' }); return }
  await prisma.user.update({
    where: { phoneNumber: req.phoneNumber! },
    data: { martRulesAcceptedAt: new Date(), martRulesVersion: version },
  })
  res.json({ ok: true })
})

export default router
