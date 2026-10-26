import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { getJwtSecret } from '../utils/jwtSecret'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  phoneNumber?: string
}

// Admin panel (2026-10-26): per-process memory of which "userId:day" pairs have
// already been written this run, so a user's 50th request of the day doesn't hit the
// DB again - the UserActiveDay table itself still enforces one-row-per-user-per-day
// via its @@unique, this is purely an optimisation. Lost on restart, which is fine -
// the next request just does one harmless extra write attempt.
const activeDayWrittenThisProcess = new Set<string>()

// Sri Lanka has a fixed +5:30 offset, no DST - safe to compute without a timezone
// library (the admin panel's own constraint: no new dependency).
function colomboDayKey(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Fire-and-forget: never awaited from the request path, never allowed to slow or
// fail a real request. Writes today's UserActiveDay row (once per process per user
// per day) and refreshes lastAppVersion/lastPlatform if the request's headers differ
// from what's stored.
function trackActivity(req: Request, user: { id: string; lastAppVersion: string | null; lastPlatform: string | null }) {
  const day = colomboDayKey(new Date())
  const cacheKey = `${user.id}:${day}`
  if (activeDayWrittenThisProcess.has(cacheKey)) return
  activeDayWrittenThisProcess.add(cacheKey)

  prisma.userActiveDay.createMany({ data: [{ userId: user.id, day }], skipDuplicates: true })
    .catch(e => console.error('UserActiveDay write failed (non-fatal):', e))

  const appVersion = (req.headers['x-app-version'] as string | undefined) || null
  const platform = (req.headers['x-platform'] as string | undefined) || null
  if ((appVersion && appVersion !== user.lastAppVersion) || (platform && platform !== user.lastPlatform)) {
    prisma.user.update({
      where: { id: user.id },
      data: { ...(appVersion ? { lastAppVersion: appVersion } : {}), ...(platform ? { lastPlatform: platform } : {}) },
    }).catch(e => console.error('lastAppVersion/lastPlatform update failed (non-fatal):', e))
  }
}

// tokenVersion is embedded in the JWT at login and compared against the User row on
// every request. Bumping User.tokenVersion (via POST /auth/logout-everywhere)
// immediately invalidates every previously issued token for that user — otherwise a
// 30-day JWT has no way to be revoked short of rotating JWT_SECRET for all users.
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorised — no token provided' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { phoneNumber: string; tokenVersion?: number }

    const user = await prisma.user.findUnique({ where: { phoneNumber: decoded.phoneNumber } })
    if (!user || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Unauthorised — session has been revoked, please log in again' })
      return
    }

    req.phoneNumber = decoded.phoneNumber
    trackActivity(req, user)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorised — invalid or expired token' })
  }
}
