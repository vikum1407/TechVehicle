// Simple in-memory rate limiting for the OTP flow. Two things this guards against:
//   1. SMS-cost / spam abuse — someone hammering /auth/send-otp for arbitrary numbers.
//   2. OTP brute-forcing — someone hammering /auth/verify-otp trying every 6-digit code.
// In-memory is sufficient for a single backend instance; if this ever runs as multiple
// instances behind a load balancer, move these buckets to Redis or the database instead.

type Bucket = { count: number; resetAt: number }

const sendBucketsByPhone = new Map<string, Bucket>()
const sendBucketsByIp = new Map<string, Bucket>()
const verifyAttempts = new Map<string, Bucket>()

const SEND_PER_PHONE_MAX = 5
const SEND_PER_PHONE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const SEND_PER_IP_MAX = 20
const SEND_PER_IP_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const VERIFY_MAX_ATTEMPTS = 5
const VERIFY_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number }

function checkBucket(map: Map<string, Bucket>, key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = map.get(key)
  if (!existing || now > existing.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  if (existing.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }
  existing.count += 1
  return { allowed: true }
}

export function checkOtpSendRateLimit(phoneNumber: string, ip: string): RateLimitResult {
  const perPhone = checkBucket(sendBucketsByPhone, phoneNumber, SEND_PER_PHONE_MAX, SEND_PER_PHONE_WINDOW_MS)
  if (!perPhone.allowed) return perPhone
  return checkBucket(sendBucketsByIp, ip, SEND_PER_IP_MAX, SEND_PER_IP_WINDOW_MS)
}

export function checkOtpVerifyRateLimit(phoneNumber: string): RateLimitResult {
  return checkBucket(verifyAttempts, phoneNumber, VERIFY_MAX_ATTEMPTS, VERIFY_WINDOW_MS)
}

export function resetOtpVerifyRateLimit(phoneNumber: string): void {
  verifyAttempts.delete(phoneNumber)
}

// Periodic cleanup so these maps don't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of sendBucketsByPhone) if (now > v.resetAt) sendBucketsByPhone.delete(k)
  for (const [k, v] of sendBucketsByIp) if (now > v.resetAt) sendBucketsByIp.delete(k)
  for (const [k, v] of verifyAttempts) if (now > v.resetAt) verifyAttempts.delete(k)
}, 10 * 60 * 1000).unref()
