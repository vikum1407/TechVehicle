import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Vehicle Shares — family sharing', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const family = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    return { owner, family, vehicle }
  }

  it('creates a share and the recipient sees it in /received as pending', async () => {
    const { owner, family, vehicle } = await setup()
    const create = await request(app)
      .post('/vehicle-shares')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber })
    expect(create.status).toBe(201)
    expect(create.body.status).toBe('pending')

    const received = await request(app).get('/vehicle-shares/received').set('Authorization', `Bearer ${family.token}`)
    expect(received.body.some((s: any) => s.vehicleId === vehicle.id)).toBe(true)
  })

  it('rejects sharing with yourself', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .post('/vehicle-shares')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: owner.phoneNumber })
    expect(res.status).toBe(400)
  })

  it('a non-owner cannot share a vehicle they don\'t own', async () => {
    const { family, vehicle } = await setup()
    const attacker = await loginAsNewUser()
    const res = await request(app)
      .post('/vehicle-shares')
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber })
    expect(res.status).toBe(403)
  })

  it('only the intended recipient can accept the share', async () => {
    const { owner, family, vehicle } = await setup()
    const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)

    const attacker = await loginAsNewUser()
    const blocked = await request(app)
      .patch(`/vehicle-shares/${share.body.id}/accept`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(blocked.status).toBe(404)

    const accepted = await request(app)
      .patch(`/vehicle-shares/${share.body.id}/accept`)
      .set('Authorization', `Bearer ${family.token}`)
    expect(accepted.status).toBe(200)
    expect(accepted.body.status).toBe('active')
  })

  it('an accepted share gives the recipient read access via GET /vehicles', async () => {
    const { owner, family, vehicle } = await setup()
    const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)
    await request(app).patch(`/vehicle-shares/${share.body.id}/accept`).set('Authorization', `Bearer ${family.token}`).expect(200)

    const list = await request(app).get('/vehicles').set('Authorization', `Bearer ${family.token}`)
    const shared = list.body.find((v: any) => v.id === vehicle.id)
    expect(shared).toBeDefined()
    expect(shared.isShared).toBe(true)
  })

  it('a third party cannot revoke a share they\'re not part of, but the owner or recipient can', async () => {
    const { owner, family, vehicle } = await setup()
    const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)

    const stranger = await loginAsNewUser()
    const blocked = await request(app)
      .delete(`/vehicle-shares/${share.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
    expect(blocked.status).toBe(403)

    const revoked = await request(app)
      .delete(`/vehicle-shares/${share.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
    expect(revoked.status).toBe(200)
  })
})
