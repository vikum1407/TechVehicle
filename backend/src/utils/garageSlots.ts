import { capText, isValidNumber, SHORT_TEXT_LEN } from './validate'

export type GarageSlot = { label: string; capacity: number }

// Reads whatever is stored in GarageAvailability.timeSlots — old installs saved a
// plain string array (["Morning","Afternoon"]) with no per-slot capacity, before
// the per-slot capacity feature existed. Upgrade those on the fly by splitting the
// garage's existing daily max evenly across their existing slot names, so nobody
// has to reconfigure from scratch.
export function parseGarageSlots(rawTimeSlots: string | null | undefined, fallbackMaxPerDay: number): GarageSlot[] {
  let parsed: unknown
  try {
    parsed = rawTimeSlots ? JSON.parse(rawTimeSlots) : null
  } catch {
    parsed = null
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [{ label: 'Morning', capacity: Math.ceil(fallbackMaxPerDay / 2) }, { label: 'Afternoon', capacity: Math.floor(fallbackMaxPerDay / 2) || 1 }]
  }

  if (typeof parsed[0] === 'string') {
    const labels = parsed as string[]
    const base = Math.floor(fallbackMaxPerDay / labels.length)
    const remainder = fallbackMaxPerDay % labels.length
    return labels.map((label, i) => ({ label, capacity: Math.max(1, base + (i < remainder ? 1 : 0)) }))
  }

  return (parsed as { label: string; capacity: number }[])
    .filter(s => s && typeof s.label === 'string' && typeof s.capacity === 'number')
    .map(s => ({ label: s.label, capacity: Math.max(1, Math.floor(s.capacity)) }))
}

export function validateGarageSlots(input: unknown): { valid: true; slots: GarageSlot[] } | { valid: false; error: string } {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) {
    return { valid: false, error: 'timeSlots must be a non-empty array of at most 20 slots' }
  }
  const slots: GarageSlot[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object' || typeof (item as any).label !== 'string') {
      return { valid: false, error: 'Each time slot needs a label' }
    }
    const label = capText((item as any).label, SHORT_TEXT_LEN)
    const capacity = (item as any).capacity
    if (!isValidNumber(capacity, { min: 1, max: 50 })) {
      return { valid: false, error: `Capacity for "${label}" must be between 1 and 50` }
    }
    slots.push({ label, capacity: Math.floor(capacity) })
  }
  return { valid: true, slots }
}
