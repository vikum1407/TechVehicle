import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Vehicles — interval overrides, never-done confirmation, manual mileage', () => {
  async function setup() {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
    return { owner, vehicle }
  }

  it('sets and then clears a custom service interval override', async () => {
    const { owner, vehicle } = await setup()
    const set = await request(app)
      .patch(`/vehicles/${vehicle.id}/overrides`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ group: 'oil_change', kmInterval: 7000 })
    expect(set.status).toBe(200)
    expect(set.body.intervalOverrides.oil_change.kmInterval).toBe(7000)

    const clear = await request(app)
      .patch(`/vehicles/${vehicle.id}/overrides`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ group: 'oil_change' }) // no kmInterval/daysInterval = clear
    expect(clear.status).toBe(200)
    expect(clear.body.intervalOverrides.oil_change).toBeUndefined()
  })

  it('rejects a kmInterval outside the allowed range', async () => {
    const { owner, vehicle } = await setup()
    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}/overrides`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ group: 'oil_change', kmInterval: 50 }) // below the 100 minimum
    expect(res.status).toBe(400)
  })

  it('confirms and then un-confirms a "never done" item', async () => {
    const { owner, vehicle } = await setup()
    const confirm = await request(app)
      .patch(`/vehicles/${vehicle.id}/never-done`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ groups: ['timing_belt'], confirmed: true })
    expect(confirm.status).toBe(200)
    expect(confirm.body.neverDoneConfirmed).toContain('timing_belt')

    const unconfirm = await request(app)
      .patch(`/vehicles/${vehicle.id}/never-done`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ groups: ['timing_belt'], confirmed: false })
    expect(unconfirm.status).toBe(200)
    expect(unconfirm.body.neverDoneConfirmed).not.toContain('timing_belt')
  })

  it('updates mileage manually when higher than current, rejects when not', async () => {
    const { owner, vehicle } = await setup()
    const higher = await request(app)
      .patch(`/vehicles/${vehicle.id}/mileage`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ mileage: 51000 })
    expect(higher.status).toBe(200)
    expect(higher.body.mileage).toBe(51000)

    const lower = await request(app)
      .patch(`/vehicles/${vehicle.id}/mileage`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ mileage: 40000 })
    expect(lower.status).toBe(400)
  })

  it('a different owner cannot touch overrides, never-done, or mileage on someone else\'s vehicle', async () => {
    const { vehicle } = await setup()
    const attacker = await loginAsNewUser()

    const overrides = await request(app)
      .patch(`/vehicles/${vehicle.id}/overrides`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ group: 'oil_change', kmInterval: 1000 })
    expect(overrides.status).toBe(404)

    const neverDone = await request(app)
      .patch(`/vehicles/${vehicle.id}/never-done`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ groups: ['timing_belt'], confirmed: true })
    expect(neverDone.status).toBe(404)

    const mileage = await request(app)
      .patch(`/vehicles/${vehicle.id}/mileage`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ mileage: 999999 })
    expect(mileage.status).toBe(404)
  })
})
