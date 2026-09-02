import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../utils/jwtSecret'

export interface AuthRequest extends Request {
  phoneNumber?: string
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorised — no token provided' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { phoneNumber: string }

    req.phoneNumber = decoded.phoneNumber
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorised — invalid or expired token' })
  }
}
