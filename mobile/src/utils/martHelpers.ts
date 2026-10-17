import { Linking } from 'react-native'
import type { Language } from '../i18n/LanguageContext'

// Step 3.7: every Mart screen read district/category labels via a hardcoded `.en`,
// ignoring the current language even though DISTRICTS already has si/ta for every
// entry and MART_CATEGORIES has si/ta on the 12 top-level categories (never on the
// `types` sub-list — 02-data-model.md §8.3's own shape has no si/ta there, so those
// stay English-only by design). This is the single shared place that now decides
// which label wins, instead of each screen repeating the same `.en` read.
export function localizedLabel(language: Language, item: { en: string; si?: string; ta?: string }): string {
  if (language === 'si' && item.si) return item.si
  if (language === 'ta' && item.ta) return item.ta
  return item.en
}

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
// "Up to Rs. 20,000" (min omitted), "Open budget" (neither given). Takes `t` the same
// way timeAgo() does above, so the wording follows the current language too.
export function formatBudget(t: (key: any, params?: Record<string, string | number>) => string, min: number | null | undefined, max: number | null | undefined): string {
  if (max === null || max === undefined) return t('mart.common.openBudget')
  if (min === null || min === undefined) return t('mart.common.upTo', { amount: formatLKR(max) })
  return `${formatLKR(min)} – ${formatLKR(max)}`
}

// "Member since Jan 2026" per 04-screens.md §16 Layout B. The month/year formatting
// itself stays in `en-US` regardless of language — Hermes's Intl support for si-LK/
// ta-LK locale month names is unreliable on-device, so only the "Member since" prefix
// is translated rather than risk month names silently falling back to numbers.
export function memberSinceLabel(t: (key: any, params?: Record<string, string | number>) => string, iso: string): string {
  const d = new Date(iso)
  return t('mart.common.memberSince', { date: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })
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
