// Spec: 03-api.md §0 "Pagination". Cursor = base64url of JSON.stringify({ t, id }).
export type Cursor = { t: string | number; id: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

// Returns null for a missing cursor (first page) or anything that doesn't decode to a
// well-formed { t, id } object — callers should treat null-but-cursor-was-given as a
// 400 "Invalid cursor", per 03-api.md §0.
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    if (!('t' in parsed) || !('id' in parsed)) return null
    return parsed as Cursor
  } catch {
    return null
  }
}

// Spec: 02-data-model.md §8.1 — PAGE_SIZE 20, PAGE_SIZE_MAX 50.
export function clampLimit(requested: unknown, def = 20, max = 50): number {
  const n = Number(requested)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(Math.floor(n), max)
}
