import { Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from './auth'
import { MART_RULES_VERSION } from '../data/martRules'

const prisma = new PrismaClient()

// Spec: 03-api.md §0. Applied to posting/editing a listing, sending a message, sending
// an offer. If MART_RULES_VERSION is ever bumped, everyone must re-accept before their
// next write — comparing the version, not just presence of martRulesAcceptedAt, is what
// makes that re-ask happen automatically.
export async function requireRules(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: req.phoneNumber! },
    select: { martRulesAcceptedAt: true, martRulesVersion: true },
  })
  if (!user?.martRulesAcceptedAt || user.martRulesVersion !== MART_RULES_VERSION) {
    res.status(403).json({ error: 'Please accept the Mart rules', code: 'RULES_REQUIRED' })
    return
  }
  next()
}
