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

export function openPhone(phone: string) {
  Linking.openURL(`tel:${phone}`)
}

// wa.me works whether or not WhatsApp is installed (falls back to a web prompt),
// same approach other Mart contact buttons should use for consistency.
export function openWhatsApp(phone: string) {
  const digitsOnly = phone.replace(/[^0-9]/g, '')
  Linking.openURL(`https://wa.me/${digitsOnly}`)
}
