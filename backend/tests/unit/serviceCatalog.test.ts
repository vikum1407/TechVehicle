import { classifyDescription } from '../../src/data/serviceCatalog'

describe('classifyDescription', () => {
  it('classifies a mileage-driven service item as "service"', () => {
    const result = classifyDescription('Engine Oil Change, Oil Filter replaced')
    expect(result).toEqual({ category: 'service', driver: 'mileage' })
  })

  it('classifies a date-driven renewal as "legal_compliance"', () => {
    expect(classifyDescription('Emission Test / Carbon Test')).toEqual({ category: 'legal_compliance', driver: 'date' })
    expect(classifyDescription('Annual Insurance renewal')).toEqual({ category: 'legal_compliance', driver: 'date' })
    expect(classifyDescription('Revenue Licence payment')).toEqual({ category: 'legal_compliance', driver: 'date' })
  })

  it('is case-insensitive', () => {
    expect(classifyDescription('EMISSION TEST')).toEqual({ category: 'legal_compliance', driver: 'date' })
  })

  it('returns null for unrecognized text', () => {
    expect(classifyDescription('Replaced the car radio')).toBeNull()
  })

  // Regression test for the exact bug class CLAUDE.md documents: this file was
  // created specifically because Analytics/Predictions/Cost Forecast each used
  // to guess this independently from description text, causing Emission Test
  // to double-count. This asserts the single source of truth can't drift back
  // into that state for the one item it was built to fix.
  it('classifies Emission Test as legal_compliance, not mileage-driven service', () => {
    const result = classifyDescription('Emission Test')
    expect(result?.category).toBe('legal_compliance')
    expect(result?.driver).toBe('date')
  })

  it('prefers the longer, more specific catalog entry over a shorter substring match', () => {
    // "Spark Plugs (Iridium)" must not get shadowed by the shorter "Spark Plugs" entry
    const result = classifyDescription('Spark Plugs (Iridium) replacement')
    expect(result).toEqual({ category: 'service', driver: 'mileage' })
  })
})
