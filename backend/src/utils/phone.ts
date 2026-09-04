// Shared phone number handling. The app is mobile-number-identity based (CLAUDE.md:
// "One person, one account, multiple vehicles. Pricing is tied to the mobile number."),
// so this is effectively the primary key for the whole system — OTP store keys, rate
// limit buckets, JWT subject, and the User.phoneNumber unique column all depend on it
// being handled consistently. Without normalization, "+94771234567" and "+94 77 123
// 4567" would be treated as different identities/rate-limit buckets even though a
// human reading them would call them the same number.

// Strips formatting characters only — callers must supply the full international
// format (e.g. +94771234567), since we support any country and don't want to guess
// a default country code.
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '')
}

// International format: a leading '+', then 8–15 digits (E.164 allows up to 15 total
// digits including country code). Deliberately simple — we're not trying to validate
// that a specific country's numbering plan is followed, just that this looks like a
// real international phone number rather than arbitrary text.
// Exception: Sri Lanka (+94) numbers must be +947X followed by exactly 7 digits
// (E.164: +94 + 9 digits, mobile prefix always 7X).
export function isValidPhone(phone: string): boolean {
  if (phone.startsWith('+94')) {
    return /^\+947\d{8}$/.test(phone)
  }
  return /^\+[1-9]\d{7,14}$/.test(phone)
}
