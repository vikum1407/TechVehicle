import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

describe('Service Submissions — garage submits, owner accepts into permanent history', () => {
  async function setupConfirmedBooking() {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
    const garage = await createTestGarage(garageOwner.token)

    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: new Date(Date.now() + 86400000).toISOString() })
      .expect(201)

    await request(app)
      .post(`/bookings/${booking.body.id}/confirm`)
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .expect(200)

    return { owner, garageOwner, vehicle, garage, booking: booking.body }
  }

  it('a garage can submit a completed service against a confirmed booking', async () => {
    const { garageOwner, vehicle, booking } = await setupConfirmedBooking()
    const res = await request(app)
      .post('/service-submissions')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ bookingId: booking.id, vehicleId: vehicle.id, description: 'Oil Change', cost: 9000, mileage: 51000 })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
  })

  it('rejects a submission with no cost (cost is mandatory for garage submissions)', async () => {
    const { garageOwner, vehicle, booking } = await setupConfirmedBooking()
    const res = await request(app)
      .post('/service-submissions')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ bookingId: booking.id, vehicleId: vehicle.id, description: 'Oil Change' })
    expect(res.status).toBe(400)
  })

  it('rejects a submission against a booking that was never confirmed', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token)
    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: new Date(Date.now() + 86400000).toISOString() })
      .expect(201) // still 'pending', never confirmed

    const res = await request(app)
      .post('/service-submissions')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ bookingId: booking.body.id, vehicleId: vehicle.id, description: 'Oil Change', cost: 9000 })
    expect(res.status).toBe(404)
  })

  // The core of the Share/Garage Engine's accept flow: a permanent, owner-
  // visible ServiceRecord is created, and the vehicle's mileage follows the
  // garage's recorded reading (same mileage-engine rule as every other entry
  // point), only when the garage's figure is actually higher.
  it('accepting a submission creates a permanent service record and updates mileage', async () => {
    const { owner, garageOwner, vehicle, booking } = await setupConfirmedBooking()
    const submission = await request(app)
      .post('/service-submissions')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ bookingId: booking.id, vehicleId: vehicle.id, description: 'Oil Change', cost: 9000, mileage: 52000 })
      .expect(201)

    const accept = await request(app)
      .post(`/service-submissions/${submission.body.id}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
    expect(accept.status).toBe(200)
    expect(accept.body.record.description).toBe('Oil Change')

    const records = await request(app).get(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(records.body.some((r: any) => r.description === 'Oil Change')).toBe(true)

    const vehicles = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    expect(vehicles.body.find((v: any) => v.id === vehicle.id).mileage).toBe(52000)
  })

  it('only the actual owner can accept their submission', async () => {
    const { garageOwner, vehicle, booking } = await setupConfirmedBooking()
    const submission = await request(app)
      .post('/service-submissions')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ bookingId: booking.id, vehicleId: vehicle.id, description: 'Oil Change', cost: 9000 })
      .expect(201)

    const attacker = await loginAsNewUser()
    const blocked = await request(app)
      .post(`/service-submissions/${submission.body.id}/accept`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(blocked.status).toBe(404)
  })
})
