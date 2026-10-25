import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

describe('Service Submissions — walk-in, shared-user, reject, rate', () => {
  it('a garage can submit a walk-in service with no prior booking or share', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    await createTestGarage(garageOwner.token)

    const res = await request(app)
      .post('/service-submissions/walkin')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Walk-in Oil Change', cost: 9000 })
    expect(res.status).toBe(201)
  })

  it('a non-garage account cannot submit a walk-in service', async () => {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const res = await request(app)
      .post('/service-submissions/walkin')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Walk-in Oil Change', cost: 9000 })
    expect(res.status).toBe(403)
  })

  it('a family-share recipient with active access can submit a test result for owner approval', async () => {
    const owner = await loginAsNewUser()
    const family = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)
    await request(app).patch(`/vehicle-shares/${share.body.id}/accept`).set('Authorization', `Bearer ${family.token}`).expect(200)

    const res = await request(app)
      .post('/service-submissions/shared')
      .set('Authorization', `Bearer ${family.token}`)
      .send({ vehicleId: vehicle.id, description: 'Emission Test', mileage: 50500 })
    expect(res.status).toBe(201)
  })

  it('a user without an active share cannot submit on a vehicle', async () => {
    const owner = await loginAsNewUser()
    const stranger = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const res = await request(app)
      .post('/service-submissions/shared')
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ vehicleId: vehicle.id, description: 'Emission Test' })
    expect(res.status).toBe(403)
  })

  it('owner can reject a submission, and the garage sees it in their own submission history', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    await createTestGarage(garageOwner.token)
    const submission = await request(app).post('/service-submissions/walkin').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Walk-in', cost: 1000 }).expect(201)

    const reject = await request(app).post(`/service-submissions/${submission.body.id}/reject`).set('Authorization', `Bearer ${owner.token}`)
    expect(reject.status).toBe(200)

    const garageList = await request(app).get('/service-submissions/garage').set('Authorization', `Bearer ${garageOwner.token}`)
    expect(garageList.body.some((s: any) => s.id === submission.body.id)).toBe(true)
  })

  it('owner can rate the garage after accepting a submission, but not twice', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    await createTestGarage(garageOwner.token)
    const submission = await request(app).post('/service-submissions/walkin').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Walk-in', cost: 1000 }).expect(201)
    await request(app).post(`/service-submissions/${submission.body.id}/accept`).set('Authorization', `Bearer ${owner.token}`).expect(200)

    const rate = await request(app).post(`/service-submissions/${submission.body.id}/rate`).set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 5, comment: 'Great service' })
    expect(rate.status).toBe(201)

    const rateAgain = await request(app).post(`/service-submissions/${submission.body.id}/rate`).set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 3 })
    expect(rateAgain.status).toBe(409)
  })

  it('rejects an out-of-range rating', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    await createTestGarage(garageOwner.token)
    const submission = await request(app).post('/service-submissions/walkin').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Walk-in', cost: 1000 }).expect(201)
    await request(app).post(`/service-submissions/${submission.body.id}/accept`).set('Authorization', `Bearer ${owner.token}`).expect(200)

    const res = await request(app).post(`/service-submissions/${submission.body.id}/rate`).set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 10 })
    expect(res.status).toBe(400)
  })
})
