// Single source of truth for notification preference keys and their defaults.
// Replaces 6 duplicated local parsePrefs() copies (garages.ts, bookings.ts,
// serviceSubmissions.ts, serviceNotifications.ts, renewalReminders.ts, mileageReminders.ts)
// plus the separate inline version in auth.ts's GET/PUT /auth/notification-prefs.
//
// Add new keys here only — never rename or remove one, the shipped mobile app and the
// background jobs both read these by name.
export const NOTIFICATION_PREF_DEFAULTS: Record<string, boolean> = {
  service_due: true,
  mileage_reminder: true,
  renewal: true,
  insurance_reminder: true,
  booking: true,
  transfer: true,
  submission: true,
  garage_reminder: true,
  mart_message: true,
  mart_wanted: true,
  mart_rating: true,
}

export function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return { ...NOTIFICATION_PREF_DEFAULTS }
  try {
    return { ...NOTIFICATION_PREF_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...NOTIFICATION_PREF_DEFAULTS }
  }
}
