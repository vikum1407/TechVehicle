// Shared across every mileage text input in the app - a bug let users type an
// arbitrarily large number (e.g. accidentally fat-fingering extra digits),
// which only got caught server-side after submitting, with a generic error.
// This clamps live, while typing, so it's caught immediately instead.
export const MAX_MILEAGE = 1_000_000

export function sanitizeMileageInput(text: string): string {
  const digitsOnly = text.replace(/[^0-9]/g, '')
  if (digitsOnly === '') return ''
  // Reject the keystroke(s) that would push the value over the cap, rather than
  // snapping straight to MAX_MILEAGE - dropping trailing digits until the number
  // fits leaves whatever was already validly typed in place (e.g. appending a 0
  // to 608750 just gets ignored, instead of the field jumping to 1000000).
  let result = digitsOnly
  while (result !== '' && parseInt(result, 10) > MAX_MILEAGE) {
    result = result.slice(0, -1)
  }
  return result
}
