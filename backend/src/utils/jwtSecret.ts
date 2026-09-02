// Central place to read JWT_SECRET. Throws instead of silently falling back to a
// hardcoded/default value — a fail-open default here would mean anyone who has
// ever seen that default string (e.g. from docs or source history) could forge
// a valid login token for any phone number if the real env var is ever unset.
let cachedSecret: string | null = null

export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret

  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error(
      'JWT_SECRET is missing or too short. Set a long, random JWT_SECRET in your .env ' +
      '(or deployment environment variables) before starting the server. Never use a ' +
      'hardcoded or example value here.'
    )
  }

  cachedSecret = secret
  return cachedSecret
}
