// Spec: 02-data-model.md §1.1 and §4.7. Shops show their full typed name; Casual sellers
// show "first name + last initial" so a stranger's real identity isn't fully exposed.
// Never stored — computed fresh every time a name is shown.
export function publicName(displayName: string | null | undefined, tag: 'shop' | 'casual'): string {
  const name = (displayName || '').trim()
  if (!name) return 'Vocksy user'
  if (tag === 'shop') return name

  const parts = name.split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const last = parts[parts.length - 1]

  let firstGrapheme = last[0]
  try {
    // @ts-ignore — Intl.Segmenter exists on modern Node but may not be in older @types/node
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const seg = segmenter.segment(last)[Symbol.iterator]().next().value
    if (seg?.segment) firstGrapheme = seg.segment
  } catch {
    // Fallback below already set from last[0] — good enough for scripts without
    // combining marks; Intl.Segmenter (when available) handles Sinhala/Tamil correctly.
  }

  return `${first} ${firstGrapheme}.`
}
