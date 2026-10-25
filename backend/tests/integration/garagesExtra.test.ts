import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

// Round-robin across a small pool of owners - avoids the 10/hour per-phone
// vehicle-creation rate limit. See backend_test_suite_status_2026_10_25 memory note.
describe('Garages — profile, customer ledger, reminders, ratings', () => {
  let owners: { phoneNumber: string; token: string }[]
  let ownerIdx = 0
  function owner() { return owners[ownerIdx++ % owners.length] }

  beforeAll(async () => {
    owners = [await loginAsNewUser(), await loginAsNewUser()]
  })

  async function makeCustomer(garageOwnerToken: string, serviceMileage: number) {
    const o = owner()
    const vehicle = await createTestVehicle(o.token, { mileage: 50000 })
    const submission = await request(app).post('/service-submissions/walkin').set('Authorization', `Bearer ${garageOwnerToken}`)
      .send({ vehicleId: vehicle.id, description: 'Engine Oil Change', cost: 9000, mileage: serviceMileage }).expect(201)
    await request(app).post(`/service-submissions/${submission.body.id}/accept`).set('Authorization', `Bearer ${o.token}`).expect(200)
    return { o, vehicle }
  }

  it('GET /me returns the garage profile with rating stats', async () => {
    const garageOwner = await loginAsNewUser()
    const garage = await createTestGarage(garageOwner.token)
    const res = await request(app).get('/garages/me').set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(garage.id)
    expect(res.body.ratingCount).toBe(0)
    expect(res.body.avgRating).toBeNull()
  })

  it('GET /customers lists a vehicle after an accepted job, with job count/revenue/overdue prediction', async () => {
    const garageOwner = await loginAsNewUser()
    await createTestGarage(garageOwner.token)
    // Logged at a low mileage relative to the vehicle's current 50000 -> overdue oil change
    const { vehicle } = await makeCustomer(garageOwner.token, 1000)

    const res = await request(app).get('/garages/customers').set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(200)
    const entry = res.body.find((c: any) => c.vehicleId === vehicle.id)
    expect(entry).toBeDefined()
    expect(entry.jobCount).toBe(1)
    expect(entry.totalRevenue).toBe(9000)
    expect(entry.prediction?.status).toBe('overdue')
  })

  it('GET /customers/:vehicleId/history returns the itemized accepted job, but 404s for a garage that never served this vehicle', async () => {
    const garageOwner = await loginAsNewUser()
    await createTestGarage(garageOwner.token)
    const { vehicle } = await makeCustomer(garageOwner.token, 45000)

    const res = await request(app).get(`/garages/customers/${vehicle.id}/history`).set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].description).toBe('Engine Oil Change')
    expect(res.body[0].cost).toBe(9000)

    const strangerGarageOwner = await loginAsNewUser()
    await createTestGarage(strangerGarageOwner.token)
    const strangerRes = await request(app).get(`/garages/customers/${vehicle.id}/history`).set('Authorization', `Bearer ${strangerGarageOwner.token}`)
    expect(strangerRes.status).toBe(404)
  })

  it('POST /customers/:vehicleId/remind sends a reminder when overdue, then 429s on a second attempt within 7 days', async () => {
    const garageOwner = await loginAsNewUser()
    await createTestGarage(garageOwner.token)
    const { o, vehicle } = await makeCustomer(garageOwner.token, 1000) // overdue, same as the /customers test above

    const first = await request(app).post(`/garages/customers/${vehicle.id}/remind`).set('Authorization', `Bearer ${garageOwner.token}`)
    expect(first.status).toBe(200)
    expect(first.body.success).toBe(true)

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${o.token}`)
    expect(notifs.body.some((n: any) => n.type === 'garage_reminder')).toBe(true)

    const second = await request(app).post(`/garages/customers/${vehicle.id}/remind`).set('Authorization', `Bearer ${garageOwner.token}`)
    expect(second.status).toBe(429)
  })

  it('POST /customers/:vehicleId/remind refuses when there is nothing overdue or due soon', async () => {
    const garageOwner = await loginAsNewUser()
    await createTestGarage(garageOwner.token)
    // Serviced at (approximately) the vehicle's current mileage -> freshly done, not due
    const { vehicle } = await makeCustomer(garageOwner.token, 50000)

    const res = await request(app).post(`/garages/customers/${vehicle.id}/remind`).set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(400)
  })

  it('GET /:id/ratings aggregates stars and includes written reviews', async () => {
    const garageOwner = await loginAsNewUser()
    const garage = await createTestGarage(garageOwner.token)
    const { o } = await makeCustomer(garageOwner.token, 48000)
    // The walkin submission accepted in makeCustomer is the thing we rate
    const submissions = await request(app).get('/service-submissions/garage').set('Authorization', `Bearer ${garageOwner.token}`)
    const submissionId = submissions.body[0].id
    await request(app).post(`/service-submissions/${submissionId}/rate`).set('Authorization', `Bearer ${o.token}`)
      .send({ rating: 4, comment: 'Good, honest work' }).expect(201)

    const res = await request(app).get(`/garages/${garage.id}/ratings`).set('Authorization', `Bearer ${o.token}`)
    expect(res.status).toBe(200)
    expect(res.body.avgRating).toBe(4)
    expect(res.body.ratingCount).toBe(1)
    expect(res.body.distribution['4']).toBe(1)
    expect(res.body.reviews.some((r: any) => r.comment === 'Good, honest work')).toBe(true)
  })
})
