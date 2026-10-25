import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('IDOR protection — one owner cannot read/modify another owner\'s vehicle', () => {
  it('returns 404 (not the vehicle) when a different owner tries to update it', async () => {
    const ownerA = await loginAsNewUser()
    const ownerB = await loginAsNewUser()

    const vehicle = await createTestVehicle(ownerA.token)

    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ vehicleNotes: 'hijacked by owner B' })

    expect(res.status).toBe(404)

    // Confirm the vehicle genuinely wasn't modified, not just that the
    // response masked a silent write.
    const ownerAView = await request(app).get('/vehicles').set('Authorization', `Bearer ${ownerA.token}`)
    const stillOwned = ownerAView.body.find((v: any) => v.id === vehicle.id)
    expect(stillOwned.vehicleNotes).not.toBe('hijacked by owner B')
  })

  it('does not list another owner\'s vehicle in GET /vehicles at all', async () => {
    const ownerA = await loginAsNewUser()
    const ownerB = await loginAsNewUser()
    const vehicle = await createTestVehicle(ownerA.token)

    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${ownerB.token}`)
    const ids = res.body.map((v: any) => v.id)
    expect(ids).not.toContain(vehicle.id)
  })
})
