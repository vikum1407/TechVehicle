import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

// Regression coverage for the exact bug class that shipped in release 17 and
// prompted the "pre-build cross-feature consistency sweep" rule in CLAUDE.md:
// a garage must never see what the owner paid elsewhere. estimatedCost on
// requestedServices is the owner's own historical payment average - sent to
// the garage, it leaks private payment history and could anchor their quote.
describe('Garage-facing booking responses never include requestedServices cost', () => {
  async function setupBookingWithRequestedServices() {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token)

    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        vehicleId: vehicle.id,
        garageId: garage.id,
        date: tomorrow,
        requestedServices: [{ name: 'Engine Oil Change', estimatedCost: 9078 }],
      })
      .expect(201)

    return { owner, garageOwner, garage, booking: createRes.body }
  }

  it('GET /bookings/garage never includes estimatedCost', async () => {
    const { garageOwner } = await setupBookingWithRequestedServices()

    const res = await request(app)
      .get('/bookings/garage')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .expect(200)

    expect(res.body.length).toBeGreaterThan(0)
    for (const booking of res.body) {
      for (const service of booking.requestedServices ?? []) {
        expect(service.estimatedCost).toBeNull()
        expect(service.name).toBeTruthy() // the name itself is fine to show
      }
    }
  })

  it('POST /bookings/:id/confirm response also strips estimatedCost', async () => {
    const { garageOwner, booking } = await setupBookingWithRequestedServices()

    const res = await request(app)
      .post(`/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .expect(200)

    for (const service of res.body.requestedServices ?? []) {
      expect(service.estimatedCost).toBeNull()
    }
  })

  it('sanity check: the cost genuinely was stored (not just always null) - the owner can still see it elsewhere', async () => {
    // This guards against a vacuous pass: if estimatedCost were always null
    // everywhere (e.g. parseRequestedServices silently dropped it), the tests
    // above would pass for the wrong reason. Confirm it's actually non-null
    // in the raw DB write by checking it round-trips through the owner-facing
    // booking creation response, which is not garage-facing and keeps cost.
    const { booking } = await setupBookingWithRequestedServices()
    expect(booking.requestedServices[0].estimatedCost).toBe(9078)
  })
})
