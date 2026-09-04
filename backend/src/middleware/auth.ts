import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { getJwtSecret } from '../utils/jwtSecret'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  phoneNumber?: string
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
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorised — invalid or expired token' })
  }
}
