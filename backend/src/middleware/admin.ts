import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { normalizePhone } from '../utils/phone'
import { checkRateLimit } from '../utils/rateLimit'

// Admin panel (2026-10-26). ADMIN_PHONES is a comma-separated env var - accepts either
// local Sri Lankan format (0771234567) or international (+94771234567), since that's
// one less way to silently lock an admin out over a formatting mismatch. Every real
// User.phoneNumber in the DB is always international (the mobile app constructs it
// that way before ever calling the backend), so this is what every comparison is
// normalized to.
function toInternational(phone: string): string {
  const n = normalizePhone(phone.trim())
  if (n.startsWith('+')) return n
  if (n.startsWith('0')) return `+94${n.slice(1)}`
  return n
}

const adminPhones = new Set(
  (process.env.ADMIN_PHONES || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(toInternational)
)

export function isAdminPhone(phoneNumber: string | null | undefined): boolean {
  return !!phoneNumber && adminPhones.has(phoneNumber)
}

// Exported so admin.ts's queries can exclude admin phones from every count (section 7's
// general rule) without re-parsing ADMIN_PHONES themselves.
export function getAdminPhones(): string[] {
  return Array.from(adminPhones)
}

// Runs after authMiddleware on every /admin/* route - hiding the admin screen in the
// app is not security on its own, this is the actual gate. Also applies the shared
// admin rate limit (120/hour/phone) here so every /admin/* route gets it automatically
// rather than each route remembering to add it.
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isAdminPhone(req.phoneNumber)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  const limit = checkRateLimit('admin', req.phoneNumber!, 120, 60 * 60 * 1000)
  if (!limit.allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return
  }
  console.log(`[admin] ${req.method} ${req.originalUrl} by ${req.phoneNumber} at ${new Date().toISOString()}`)
  next()
}
