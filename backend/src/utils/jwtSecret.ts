// Central place to read JWT_SECRET. Throws instead of silently falling back to a
// hardcoded/default value — a fail-open default here would mean anyone who has
// ever seen that default string (e.g. from docs or source history) could forge
// a valid login token for any phone number if the real env var is ever unset.
let cachedSecret: string | null = null

// Known placeholder/example values that must never be used as a real secret —
// including the literal fallback this codebase used to hardcode, which was also
// visible in this repo's public git history. If JWT_SECRET is ever set to one of
// these, treat it as effectively public knowledge, not a secret.
const KNOWN_WEAK_VALUES = [
  'dev-secret-change-in-production',
  'your-jwt-secret-here',
  'secret',
  'changeme',
]

export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret

  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 16 || KNOWN_WEAK_VALUES.includes(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET is missing, too short, or set to a known placeholder value. Set a ' +
      'long, random JWT_SECRET in your .env (or deployment environment variables) ' +
      'before starting the server. Never use a hardcoded or example value here.'
    )
  }

  cachedSecret = secret
  return cachedSecret
}
