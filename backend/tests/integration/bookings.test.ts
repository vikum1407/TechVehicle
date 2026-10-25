import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

describe('Bookings — creation, slot capacity, counter-offers, cancellation', () => {
  async function setupGarageWithSlots(capacity = 1) {
    const garageOwner = await loginAsNewUser()
    const garage = await createTestGarage(garageOwner.token)
    await request(app).put('/availability').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ workDays: [0, 1, 2, 3, 4, 5, 6], timeSlots: [{ label: 'Morning', capacity }] })
      .expect(200)
    return { garageOwner, garage }
  }

  const futureDate = () => new Date(Date.now() + 5 * 86400000).toISOString()

  it('creates a booking on an open slot', async () => {
    const owner = await loginAsNewUser()
    const { garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate(), slotLabel: 'Morning' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
  })

  // The exact pattern the project's own booking UI relies on: "Already Booked"
  // once a slot's own capacity is reached, even if the day overall isn't full.
  it('refuses a second booking once a specific slot\'s own capacity is reached', async () => {
    const owner = await loginAsNewUser()
    const { garage } = await setupGarageWithSlots(1) // capacity 1 - the very next booking on this slot must fail
    const date = futureDate()

    const v1 = await createTestVehicle(owner.token)
    await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: v1.id, garageId: garage.id, date, slotLabel: 'Morning' }).expect(201)

    const v2 = await createTestVehicle(owner.token)
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: v2.id, garageId: garage.id, date, slotLabel: 'Morning' })
    expect(res.status).toBe(400)
  })

  it('a closed calendar override blocks booking that date entirely', async () => {
    const owner = await loginAsNewUser()
    const { garageOwner, garage } = await setupGarageWithSlots(5)
    const date = futureDate()
    const dateOnly = date.split('T')[0]
    await request(app).post('/availability/override').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ date: dateOnly, status: 'closed' }).expect(200)

    const vehicle = await createTestVehicle(owner.token)
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date })
    expect(res.status).toBe(400)
  })

  it('the owner can cancel their own booking; a stranger cannot', async () => {
    const owner = await loginAsNewUser()
    const { garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate() }).expect(201)

    const stranger = await loginAsNewUser()
    const blocked = await request(app).delete(`/bookings/${booking.body.id}`).set('Authorization', `Bearer ${stranger.token}`)
    expect(blocked.status).toBe(404)

    const cancelled = await request(app).delete(`/bookings/${booking.body.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(cancelled.status).toBe(200)
  })

  it('the garage can cancel a booking, which is distinct from the owner cancelling', async () => {
    const owner = await loginAsNewUser()
    const { garageOwner, garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate() }).expect(201)

    const res = await request(app)
      .post(`/bookings/${booking.body.id}/garage-cancel`)
      .set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(200)
  })

  // Counter-offer flow: garage suggests a different slot, owner accepts ->
  // the booking's actual date/slot move to the counter values.
  it('owner accepting a counter-offer moves the booking to the suggested date/slot', async () => {
    const owner = await loginAsNewUser()
    const { garageOwner, garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate(), slotLabel: 'Morning' }).expect(201)

    const counterDate = new Date(Date.now() + 10 * 86400000).toISOString()
    const counter = await request(app)
      .post(`/bookings/${booking.body.id}/counter`)
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ counterDate, counterSlot: 'Afternoon' })
    expect(counter.status).toBe(200)
    expect(counter.body.status).toBe('counter_suggested')

    const accept = await request(app)
      .post(`/bookings/${booking.body.id}/accept-counter`)
      .set('Authorization', `Bearer ${owner.token}`)
    expect(accept.status).toBe(200)
    expect(accept.body.status).toBe('confirmed')
    expect(accept.body.slotLabel).toBe('Afternoon')
  })

  it('owner declining a counter-offer cancels the booking', async () => {
    const owner = await loginAsNewUser()
    const { garageOwner, garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate() }).expect(201)

    await request(app).post(`/bookings/${booking.body.id}/counter`).set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ counterDate: new Date(Date.now() + 10 * 86400000).toISOString() }).expect(200)

    const decline = await request(app)
      .post(`/bookings/${booking.body.id}/decline-counter`)
      .set('Authorization', `Bearer ${owner.token}`)
    expect(decline.status).toBe(200)
  })

  it('a third party cannot read booking notes', async () => {
    const owner = await loginAsNewUser()
    const { garage } = await setupGarageWithSlots(3)
    const vehicle = await createTestVehicle(owner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: futureDate() }).expect(201)

    const stranger = await loginAsNewUser()
    const res = await request(app).get(`/bookings/${booking.body.id}/notes`).set('Authorization', `Bearer ${stranger.token}`)
    expect(res.status).toBe(403)
  })
})
