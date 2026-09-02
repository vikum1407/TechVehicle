import { Request, Response, NextFunction } from 'express'
import { checkRateLimit } from '../utils/rateLimit'

// Backstop against a scripted flood hitting any endpoint — not meant to shape normal
// app usage (a dashboard load can easily fire a dozen requests at once), just to cap
// runaway abuse before it drives up Render/Neon usage on the free tier. Endpoint-
// specific limits (OTP, notification-spam-prone routes) still apply on top of this.
const WINDOW_MS = 5 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 600

export function globalRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown'
  const result = checkRateLimit('global', key, MAX_REQUESTS_PER_WINDOW, WINDOW_MS)
  if (!result.allowed) {
    res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' })
    return
  }
  next()
}
