import express from 'express'
import jwt from 'jsonwebtoken'

const router = express.Router()

// Temporary in-memory OTP store — replace with Redis in production
const otpStore = new Map<string, { otp: string; expires: number }>()

// POST /auth/send-otp
router.post('/send-otp', (req, res) => {
  const { phoneNumber } = req.body

  if (!phoneNumber) {
    res.status(400).json({ error: 'Phone number is required' })
    return
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = Date.now() + 5 * 60 * 1000 // 5 minutes

  otpStore.set(phoneNumber, { otp, expires })

  // Development: print OTP to backend console instead of sending SMS
  console.log(`\n=============================`)
  console.log(`OTP for ${phoneNumber}: ${otp}`)
  console.log(`=============================\n`)

  res.json({ message: 'OTP sent', phoneNumber })
})

// POST /auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body

  if (!phoneNumber || !otp) {
    res.status(400).json({ error: 'Phone number and OTP are required' })
    return
  }

  const stored = otpStore.get(phoneNumber)

  if (!stored) {
    res.status(400).json({ error: 'OTP not found. Please request a new one.' })
    return
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(phoneNumber)
    res.status(400).json({ error: 'OTP has expired. Please request a new one.' })
    return
  }

  if (stored.otp !== otp) {
    res.status(400).json({ error: 'Invalid OTP. Please try again.' })
    return
  }

  otpStore.delete(phoneNumber)

  const token = jwt.sign(
    { phoneNumber },
    process.env.JWT_SECRET || 'dev-secret-change-in-production',
    { expiresIn: '30d' }
  )

  res.json({ token, phoneNumber })
})

export default router
