import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { normalizePhone } from '../utils/phone'

// Spec: 03-api.md "GET /admin/reports — admin only. Caller phone must be in
// ADMIN_PHONES else 404." Unlike martGate's MART_BETA_PHONES (empty/unset = everyone
// allowed — a feature-availability gate), this fails CLOSED: empty/unset ADMIN_PHONES
// means nobody is treated as admin. This guards genuinely sensitive data (report
// contents, reporter identities), not just an unshipped feature.
export function isAdminPhone(phone: string | undefined): boolean {
  const raw = process.env.ADMIN_PHONES
  if (!raw || !raw.trim() || !phone) return false
  const allowed = raw.split(',').map(p => normalizePhone(p.trim())).filter(Boolean)
  return allowed.includes(normalizePhone(phone))
}

// 404, not 403 — same reasoning as martGate: a restricted admin surface should look
// like it doesn't exist, not announce that it exists but is off-limits.
export function adminGate(req: AuthRequest, res: Response, next: NextFunction) {
  if (isAdminPhone(req.phoneNumber)) {
    next()
    return
  }
  res.status(404).json({ error: 'Not found' })
}
