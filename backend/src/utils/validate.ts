// Shared request-body validation for numeric/date/text fields. Without these checks,
// `Number(badInput)` silently produces NaN and `new Date(badInput)` silently produces
// an Invalid Date — both would otherwise reach Prisma and either corrupt stored data
// (NaN mileage/cost breaks analytics and predictions, which are mileage-anchored) or
// throw an opaque 500 instead of a clear 400.

export function isValidNumber(value: unknown, opts: { min?: number; max?: number } = {}): boolean {
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  if (opts.min !== undefined && n < opts.min) return false
  if (opts.max !== undefined && n > opts.max) return false
  return true
}

export function isValidDateInput(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  const d = new Date(value as any)
  return !isNaN(d.getTime())
}

// Sri Lankan LKR amounts and km readings don't legitimately need more than this —
// caps guard against fat-finger/garbage input (e.g. a stray extra digit) and abuse.
export const MAX_AMOUNT = 100_000_000
export const MAX_MILEAGE = 5_000_000
export const MAX_LITRES = 10_000

export const SHORT_TEXT_LEN = 300
export const LONG_TEXT_LEN = 3000

export function capText(value: unknown, maxLen: number): string {
  return String(value).slice(0, maxLen)
}
