import { Linking } from 'react-native'

// "Rs. 3,500" — whole rupees, comma-grouped (matches the existing .toLocaleString()
// pattern already used for mileage elsewhere in the app).
export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return ''
  return `Rs. ${Math.round(amount).toLocaleString()}`
}

// Reuses the app's existing notifications.* i18n keys (same relative-time wording,
// "2 hours ago" / "Yesterday" / "3 days ago") rather than adding duplicate keys —
// logged in docs/mart/DECISIONS-MADE.md. Callers prefix it themselves, e.g.
// `Posted ${timeAgo(t, iso)}`, `Reserved ${timeAgo(t, iso)}`.
export function timeAgo(t: (key: any, params?: Record<string, string | number>) => string, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('notifications.justNow')
  if (mins < 60) return t('notifications.minsAgo', { mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('notifications.hoursAgo', { hrs })
  const days = Math.floor(hrs / 24)
  if (days === 1) return t('notifications.yesterday')
  return t('notifications.daysAgo', { days })
}

// Wanted budget display per 04-screens.md §12/§19: "Rs. 25,000 – 35,000" (both given),
// "Up to Rs. 20,000" (min omitted), "Open budget" (neither given).
export function formatBudget(min: number | null | undefined, max: number | null | undefined): string {
  if (max === null || max === undefined) return 'Open budget'
  if (min === null || min === undefined) return `Up to ${formatLKR(max)}`
  return `${formatLKR(min)} – ${formatLKR(max)}`
}

// "Member since Jan 2026" per 04-screens.md §16 Layout B.
export function memberSinceLabel(iso: string): string {
  const d = new Date(iso)
  return `Member since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

export function openPhone(phone: string) {
  Linking.openURL(`tel:${phone}`)
}

// wa.me works whether or not WhatsApp is installed (falls back to a web prompt),
// same approach other Mart contact buttons should use for consistency.
export function openWhatsApp(phone: string) {
  const digitsOnly = phone.replace(/[^0-9]/g, '')
  Linking.openURL(`https://wa.me/${digitsOnly}`)
}
