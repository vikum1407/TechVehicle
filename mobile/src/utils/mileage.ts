// Shared across every mileage text input in the app - a bug let users type an
// arbitrarily large number (e.g. accidentally fat-fingering extra digits),
// which only got caught server-side after submitting, with a generic error.
// This clamps live, while typing, so it's caught immediately instead.
export const MAX_MILEAGE = 1_000_000

export function sanitizeMileageInput(text: string): string {
  const digitsOnly = text.replace(/[^0-9]/g, '')
  if (digitsOnly === '') return ''
  const num = parseInt(digitsOnly, 10)
  if (num > MAX_MILEAGE) return String(MAX_MILEAGE)
  return digitsOnly
}
