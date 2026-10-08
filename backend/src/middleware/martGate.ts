import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { normalizePhone } from '../utils/phone'

// Spec: 03-api.md §0. MART_BETA_PHONES = comma list of phones. Empty/unset = everyone
// allowed. If set and the caller isn't in it, respond 404 (not 403) so the route looks
// like it doesn't exist at all, rather than revealing that a restricted feature exists.
export function martGate(req: AuthRequest, res: Response, next: NextFunction) {
  const raw = process.env.MART_BETA_PHONES
  if (!raw || !raw.trim()) {
    next()
    return
  }

  const allowed = raw.split(',').map(p => normalizePhone(p.trim())).filter(Boolean)
  if (allowed.includes(normalizePhone(req.phoneNumber!))) {
    next()
    return
  }

  res.status(404).json({ error: 'Not found' })
}

// Used by GET /app-config, which has no token requirement. Same allow-list logic, just
// without assuming req.phoneNumber is set.
export function isMartBetaPhone(phone: string | undefined): boolean {
  const raw = process.env.MART_BETA_PHONES
  if (!raw || !raw.trim()) return true
  if (!phone) return false
  const allowed = raw.split(',').map(p => normalizePhone(p.trim())).filter(Boolean)
  return allowed.includes(normalizePhone(phone))
}
