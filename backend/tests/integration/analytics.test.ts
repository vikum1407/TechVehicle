import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Analytics — spend totals, Legal & Compliance classification (the double-counting regression)', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    return { owner, vehicle }
  }

  it('a different owner cannot view another vehicle\'s analytics', async () => {
    const { vehicle } = await setup()
    const attacker = await loginAsNewUser()
    const res = await request(app).get(`/analytics/${vehicle.id}`).set('Authorization', `Bearer ${attacker.token}`)
    expect(res.status).toBe(404)
  })

  it('sums service, fuel, and expense costs into totalSpend', async () => {
    const { owner, vehicle } = await setup()
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Brake Pads', cost: 5000 }).expect(201)
    await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', mileage: 50500, litres: 20, cost: 8000 }).expect(201)
    await request(app).post(`/expenses/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: 500 }).expect(201)

    const res = await request(app).get(`/analytics/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.totalSpend).toBe(5000 + 8000 + 500)
  })

  // Direct regression test for the bug CLAUDE.md documents as the reason
  // serviceCatalog.ts exists: an Emission Test logged as a ServiceRecord must
  // count ONCE, as Legal & Compliance - not also fall into Service & Repairs.
  it('an Emission Test service record counts once, as Legal & Compliance, not Service & Repairs', async () => {
    const { owner, vehicle } = await setup()
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Emission Test / Carbon Test', cost: 4500 }).expect(201)

    const res = await request(app).get(`/analytics/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(res.body.legalComplianceCost).toBe(4500)
    expect(res.body.serviceCost).toBe(0)
    expect(res.body.totalSpend).toBe(4500) // not 9000 - must not be counted twice
  })

  // Same rule from the Add Expense side: Insurance/Revenue Licence/Emission
  // Test expense categories merge into the same Legal & Compliance bucket,
  // not shown as their own separate line items in the breakdown.
  it('Insurance/Revenue Licence expense categories merge into Legal & Compliance, not their own line items', async () => {
    const { owner, vehicle } = await setup()
    await request(app).post(`/expenses/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Insurance', amount: 45000 }).expect(201)
    await request(app).post(`/expenses/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Revenue Licence', amount: 8500 }).expect(201)

    const res = await request(app).get(`/analytics/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(res.body.legalComplianceCost).toBe(45000 + 8500)
    const categories = res.body.expenseBreakdown.map((c: any) => c.category)
    expect(categories).not.toContain('Insurance')
    expect(categories).not.toContain('Revenue Licence')
    expect(categories).toContain('Legal & Compliance')
  })

  it('surfaces structured Oil Change history when a matching record exists', async () => {
    const { owner, vehicle } = await setup()
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({
        date: '2026-01-01', description: 'Oil Change', mileage: 50500, cost: 9000,
        structuredData: { 'Oil Change': { oilBrand: 'Castrol', oilGrade: '5W-30', oilType: 'Full Synthetic' } },
      }).expect(201)

    const res = await request(app).get(`/analytics/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(res.body.oilAnalytics).not.toBeNull()
    expect(res.body.oilAnalytics.history[0].brand).toBe('Castrol')
    expect(res.body.oilAnalytics.history[0].grade).toBe('5W-30')
  })
})
