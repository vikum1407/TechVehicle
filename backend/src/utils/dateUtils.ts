// Bookings/overrides are stored as a calendar date represented by UTC midnight
// (e.g. "2026-09-14T00:00:00.000Z" *is* the 14th, not an instant to convert to
// local time). Computing "midnight" via `new Date(); setHours(0,0,0,0)` sets
// midnight in whatever timezone the Node process happens to be running under,
// then converting that to UTC silently shifts the resulting date backward by
// a day on any server not running in UTC. Originally found and fixed only in
// availability.ts (confirmed on a dev machine running GMT+2/+1, which
// mislabelled a date as the previous day); bookings.ts independently computed
// the same kind of date key its own way and had the identical bug - this file
// is the single shared implementation both now use, so a third place can't
// reintroduce it by copying the wrong one.

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function utcDayKey(d: Date): string {
  return utcDayStart(d).toISOString().split('T')[0]
}

export function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = utcDayStart(d)
  const end = new Date(start.getTime() + 86400000 - 1) // 23:59:59.999 UTC same day
  return { start, end }
}

export function todayUTCMidnight(): Date {
  return utcDayStart(new Date())
}
