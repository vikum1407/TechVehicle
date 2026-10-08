// Spec: 02-data-model.md §4.1. Used for matching make/model between listings, wanted
// requests, and "similar ads" — not for display (the original casing is what's shown).
export function normalizeVehicleText(s: string | null | undefined): string | null {
  if (!s) return null
  let v = s.toLowerCase().trim().replace(/\s+/g, ' ')
  const slashIndex = v.indexOf(' / ')
  if (slashIndex !== -1) v = v.slice(0, slashIndex)
  v = v.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  return v || null
}
