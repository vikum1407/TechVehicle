import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

describe('Share Sessions — record ownership IDOR, cost-stripping for the garage', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token)
    const record = await request(app)
      .post(`/service-records/${vehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change', mileage: 51000, cost: 9000 })
      .expect(201)
    return { owner, garageOwner, vehicle, garage, record: record.body }
  }

  it('creates a share session for a record the owner actually owns', async () => {
    const { owner, vehicle, garage, record } = await setup()
    const res = await request(app)
      .post('/share-sessions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, recordIds: [record.id] })
    expect(res.status).toBe(201)
  })

  // Direct regression test for the IDOR fix already documented in
  // shareSessions.ts's own comment: passing another vehicle's record id
  // must not let it leak into a share session for THIS vehicle.
  it('refuses to share a record that belongs to a different vehicle', async () => {
    const { owner, vehicle, garage } = await setup()
    const otherVehicle = await createTestVehicle(owner.token, { registrationNo: `WP OTHER-${Math.floor(Math.random() * 1e6)}` })
    const foreignRecord = await request(app)
      .post(`/service-records/${otherVehicle.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-01-01', description: 'Belongs to the other vehicle' })
      .expect(201)

    const res = await request(app)
      .post('/share-sessions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, recordIds: [foreignRecord.body.id] })
    expect(res.status).toBe(400)
  })

  it('a different owner cannot create a share session for a vehicle they don\'t own', async () => {
    const { vehicle, garage, record } = await setup()
    const attacker = await loginAsNewUser()
    const res = await request(app)
      .post('/share-sessions')
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, recordIds: [record.id] })
    expect(res.status).toBe(404)
  })

  // Same "never show a garage what the owner paid elsewhere" rule as the
  // booking flow's requestedServices - this is the original call site that
  // rule was built for.
  it('strips cost from what the garage sees via GET /share-sessions/incoming', async () => {
    const { owner, garageOwner, vehicle, garage, record } = await setup()
    await request(app)
      .post('/share-sessions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, recordIds: [record.id] })
      .expect(201)

    const res = await request(app)
      .get('/share-sessions/incoming')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .expect(200)

    expect(res.body.length).toBeGreaterThan(0)
    const session = res.body[0]
    for (const r of session.records) {
      expect(r.cost).toBeNull()
    }
    expect(session.healthSummary.showCosts).toBe(false)
  })
})
