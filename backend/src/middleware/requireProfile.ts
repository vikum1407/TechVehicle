import { Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from './auth'

const prisma = new PrismaClient()

// Spec: 03-api.md §0. Applied to write routes that need a name + district on file
// before they make sense (posting, messaging, offering). Reading never needs this.
export async function requireProfile(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: req.phoneNumber! },
    select: { displayName: true, district: true },
  })
  if (!user?.displayName || !user?.district) {
    res.status(400).json({ error: 'Add your name and district first', code: 'PROFILE_REQUIRED' })
    return
  }
  next()
}
