import express from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

const otpStore = new Map<string, { otp: string; expires: number }>()

// POST /auth/send-otp
router.post('/send-otp', (req, res) => {
  const { phoneNumber } = req.body
  if (!phoneNumber) {
    res.status(400).json({ error: 'Phone number is required' })
    return
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = Date.now() + 5 * 60 * 1000

  otpStore.set(phoneNumber, { otp, expires })

  console.log(`\n=============================`)
  console.log(`OTP for ${phoneNumber}: ${otp}`)
  console.log(`=============================\n`)

  res.json({ message: 'OTP sent', phoneNumber })
})

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { phoneNumber, otp } = req.body
  if (!phoneNumber || !otp) {
    res.status(400).json({ error: 'Phone number and OTP are required' })
    return
  }

  const stored = otpStore.get(phoneNumber)
  if (!stored) { res.status(400).json({ error: 'OTP not found. Please request a new one.' }); return }
  if (Date.now() > stored.expires) {
    otpStore.delete(phoneNumber)
    res.status(400).json({ error: 'OTP has expired. Please request a new one.' }); return
  }
  if (stored.otp !== otp) { res.status(400).json({ error: 'Invalid OTP. Please try again.' }); return }

  otpStore.delete(phoneNumber)

  try {
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: { garage: true },
    })

    let isNewUser = false

    if (!user) {
      user = await prisma.user.create({
        data: { phoneNumber },
        include: { garage: true },
      })
      isNewUser = true
    } else if (!user.userType) {
      // Existing user without a role — migrate: if they have a garage, set garage type
      if (user.garage) {
        await prisma.user.update({ where: { phoneNumber }, data: { userType: 'garage' } })
        user = { ...user, userType: 'garage' }
      } else {
        isNewUser = true // ask them to pick a role
      }
    }

    const token = jwt.sign(
      { phoneNumber },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '30d' }
    )

    res.json({ token, phoneNumber, userType: user.userType, isNewUser })
  } catch (error) {
    console.error('verify-otp error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

// PUT /auth/user-type — set role after role selection screen
router.put('/user-type', authMiddleware, async (req: AuthRequest, res) => {
  const { userType } = req.body
  if (!['owner', 'garage'].includes(userType)) {
    res.status(400).json({ error: 'userType must be owner or garage' }); return
  }
  try {
    await prisma.user.update({
      where: { phoneNumber: req.phoneNumber! },
      data: { userType },
    })
    res.json({ userType })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user type' })
  }
})

export default router
