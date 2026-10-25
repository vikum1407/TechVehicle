import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Expenses — CRUD, category validation, IDOR', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    return { owner, vehicle }
  }

  it('creates an expense with a valid category', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: 500 })
    expect(res.status).toBe(201)
    expect(res.body.category).toBe('Parking')
  })

  // Legal & Compliance categories (Insurance/Revenue Licence) matter beyond
  // generic validation - predictions.ts's Cost Forecast depends on an exact
  // string match against these two category names to build renewal items.
  it('accepts Insurance and Revenue Licence as valid categories', async () => {
    const { owner, vehicle } = await setup()
    const res1 = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Insurance', amount: 45000 })
    expect(res1.status).toBe(201)

    const res2 = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Revenue Licence', amount: 8500 })
    expect(res2.status).toBe(201)
  })

  it('rejects an unrecognized category', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Not A Real Category', amount: 500 })
    expect(res.status).toBe(400)
  })

  it('rejects a missing or negative amount', async () => {
    const { owner, vehicle } = await setup()
    const missing = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Parking' })
    expect(missing.status).toBe(400)

    const negative = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: -100 })
    expect(negative.status).toBe(400)
  })

  it('a different owner cannot patch or delete someone else\'s expense', async () => {
    const { owner, vehicle } = await setup()
    const attacker = await loginAsNewUser()
    const created = await request(app)
      .post(`/expenses/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: 500 })
      .expect(201)

    const patchRes = await request(app)
      .patch(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ amount: 1 })
    expect(patchRes.status).toBe(404)

    const deleteRes = await request(app)
      .delete(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(deleteRes.status).toBe(404)
  })
})
