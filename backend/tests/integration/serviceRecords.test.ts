import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Service Records — CRUD, validation, mileage propagation, IDOR', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
    return { owner, vehicle }
  }

  it('creates a record with valid data', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change', mileage: 51000, cost: 9000 })
    expect(res.status).toBe(201)
    expect(res.body.description).toBe('Oil Change')
    expect(res.body.mileage).toBe(51000)
  })

  it('rejects a record missing date or description', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01' })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid (negative) mileage', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change', mileage: -5 })
    expect(res.status).toBe(400)
  })

  // The mileage engine is "the master key" per the project's own vision doc -
  // a service record with a higher mileage than currently on file must bump
  // the vehicle's mileage, same as the fuel-log flow does.
  it('bumps the vehicle mileage when the record mileage is higher', async () => {
    const { owner, vehicle } = await setup()
    await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change', mileage: 55000 })
      .expect(201)

    const list = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    const updated = list.body.find((v: any) => v.id === vehicle.id)
    expect(updated.mileage).toBe(55000)
  })

  it('does not reduce the vehicle mileage when the record mileage is lower (a past/backdated entry)', async () => {
    const { owner, vehicle } = await setup()
    await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2020-01-01', description: 'Old service', mileage: 10000 })
      .expect(201)

    const list = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    const updated = list.body.find((v: any) => v.id === vehicle.id)
    expect(updated.mileage).toBe(50000) // unchanged from setup()
  })

  it('lists records for the vehicle, newest first', async () => {
    const { owner, vehicle } = await setup()
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2025-01-01', description: 'Older' }).expect(201)
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Newer' }).expect(201)

    const res = await request(app).get(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
    expect(res.body[0].description).toBe('Newer')
  })

  it('a different owner cannot patch or delete someone else\'s record', async () => {
    const { owner, vehicle } = await setup()
    const attacker = await loginAsNewUser()
    const created = await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change' })
      .expect(201)

    const patchRes = await request(app)
      .patch(`/service-records/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ description: 'hijacked' })
    expect(patchRes.status).toBe(404)

    const deleteRes = await request(app)
      .delete(`/service-records/${created.body.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(deleteRes.status).toBe(404)

    // Confirm it genuinely wasn't touched
    const stillThere = await request(app).get(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(stillThere.body[0].description).toBe('Oil Change')
  })
})
