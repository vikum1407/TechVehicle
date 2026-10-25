import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Fuel Logs — CRUD, validation, mileage propagation, IDOR', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
    return { owner, vehicle }
  }

  it('creates a fuel log with valid data', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/fuel-logs/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', mileage: 50500, litres: 30, cost: 12000 })
    expect(res.status).toBe(201)
    expect(res.body.mileage).toBe(50500)
    expect(res.body.fullTank).toBe(true) // defaults true unless explicitly false
  })

  it('rejects a log missing date or mileage', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/fuel-logs/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01' })
    expect(res.status).toBe(400)
  })

  // Fuel fill-up is the PRIMARY mileage-entry method per the project's own
  // Mileage Engine design - this propagation path is the most important one
  // to get right of the two (service records being the secondary path).
  it('bumps the vehicle mileage when the fuel log mileage is higher', async () => {
    const { owner, vehicle } = await setup()
    await request(app)
      .post(`/fuel-logs/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', mileage: 52000, litres: 30 })
      .expect(201)

    const list = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    const updated = list.body.find((v: any) => v.id === vehicle.id)
    expect(updated.mileage).toBe(52000)
  })

  it('does not reduce the vehicle mileage when the fuel log mileage is lower', async () => {
    const { owner, vehicle } = await setup()
    await request(app)
      .post(`/fuel-logs/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2020-01-01', mileage: 10000, litres: 30 })
      .expect(201)

    const list = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    const updated = list.body.find((v: any) => v.id === vehicle.id)
    expect(updated.mileage).toBe(50000)
  })

  it('a different owner cannot patch or delete someone else\'s fuel log', async () => {
    const { owner, vehicle } = await setup()
    const attacker = await loginAsNewUser()
    const created = await request(app)
      .post(`/fuel-logs/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', mileage: 50500 })
      .expect(201)

    const patchRes = await request(app)
      .patch(`/fuel-logs/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ mileage: 999999 })
    expect(patchRes.status).toBe(404)

    const deleteRes = await request(app)
      .delete(`/fuel-logs/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(deleteRes.status).toBe(404)
  })
})
