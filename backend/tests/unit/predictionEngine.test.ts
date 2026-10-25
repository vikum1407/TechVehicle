import { computePredictions, VehicleInput } from '../../src/utils/predictionEngine'

function baseVehicle(mileage: number): VehicleInput {
  // A make/model with no manufacturer-specific override, so the generic
  // 'oil_change_general' interval applies - using a real make (e.g. Toyota)
  // would hit its own more-specific override instead (higher specificity
  // wins per group), which is exactly what happened the first time this test
  // was written and silently matched nothing.
  return {
    make: 'GenericTestMake',
    model: 'GenericTestModel',
    year: 2015,
    fuelType: 'petrol',
    vehicleType: 'car-petrol',
    mileage,
  }
}

function oilChangeRecord(mileage: number, date: Date) {
  return {
    id: 'rec-1',
    description: 'Engine Oil Change, Oil Filter replaced',
    mileage,
    date,
  }
}

describe('computePredictions — oil change (kmInterval: 5000)', () => {
  const findOilRow = (vehicle: VehicleInput, records: ReturnType<typeof oilChangeRecord>[]) =>
    computePredictions(vehicle, records).find(p => p.id === 'oil_change_general')!

  it('is "ok" when well within interval and well within the urgency window', () => {
    const row = findOilRow(baseVehicle(44000), [oilChangeRecord(40000, new Date())])
    expect(row.remainingKm).toBe(1000) // dueAt 45000, mileage 44000
    expect(row.status).toBe('ok')
  })

  it('is "due_soon" once remaining km drops to the urgency threshold (500)', () => {
    const row = findOilRow(baseVehicle(44700), [oilChangeRecord(40000, new Date())])
    expect(row.remainingKm).toBe(300)
    expect(row.status).toBe('due_soon')
  })

  it('is "overdue" once the interval has been passed', () => {
    const row = findOilRow(baseVehicle(46000), [oilChangeRecord(40000, new Date())])
    expect(row.remainingKm).toBe(-1000)
    expect(row.status).toBe('overdue')
  })

  it('is "no_data" when no matching record exists and nothing was confirmed never-done', () => {
    const row = findOilRow(baseVehicle(10000), [])
    expect(row.status).toBe('no_data')
    expect(row.lastDoneKm).toBeNull()
  })

  it('an owner-set interval override replaces the default kmInterval for that group', () => {
    const vehicle: VehicleInput = {
      ...baseVehicle(44700),
      intervalOverrides: { oil_change: { kmInterval: 10000 } },
    }
    const row = findOilRow(vehicle, [oilChangeRecord(40000, new Date())])
    // dueAt is now 40000 + 10000 = 50000, not the default 45000 - the earlier
    // "due_soon" case above would be "ok" under this override.
    expect(row.remainingKm).toBe(5300)
    expect(row.status).toBe('ok')
    expect(row.customKmInterval).toBe(10000)
  })
})
