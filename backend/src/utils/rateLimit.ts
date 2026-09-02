// Generic in-memory fixed-window rate limiter, generalized from otpRateLimit.ts.
// Used to cap actions that push a notification to a phone number the caller doesn't
// control (vehicle share invites, sell/transfer requests, booking messages) — without
// this, an authenticated user could use those flows to spam an arbitrary phone number
// with unlimited push notifications.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Map<string, Bucket>>()

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number }

export function checkRateLimit(scope: string, key: string, max: number, windowMs: number): RateLimitResult {
  let scopeMap = buckets.get(scope)
  if (!scopeMap) {
    scopeMap = new Map()
    buckets.set(scope, scopeMap)
  }

  const now = Date.now()
  const existing = scopeMap.get(key)
  if (!existing || now > existing.resetAt) {
    scopeMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  if (existing.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }
  existing.count += 1
  return { allowed: true }
}

setInterval(() => {
  const now = Date.now()
  for (const scopeMap of buckets.values()) {
    for (const [k, v] of scopeMap) if (now > v.resetAt) scopeMap.delete(k)
  }
}, 10 * 60 * 1000).unref()
