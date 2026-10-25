import request from 'supertest'
import crypto from 'crypto'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'

// Shared logged-in identities across the whole file (not beforeAll-per-describe) -
// every test creates its own fresh vehicle via createTestVehicle (no OTP cost), so
// a small, fixed pool of logins covers the entire file instead of one per test. See
// backend_test_otp_rate_limit_gotcha memory note: the real 20/hour anti-abuse OTP
// send limit is shared across the whole test process (maxWorkers: 1, one IP).
//
// vehicles.ts also rate-limits vehicle CREATION itself (10/hour per phone number,
// a separate anti-abuse limit) - this file creates ~17 vehicles across its tests,
// so a single shared owner would trip that limit. `owner()` round-robins across a
// small pool of owner identities to stay under it per-phone while still only
// costing a handful of OTP logins overall.
describe('Vehicles — list, create validation, edit, photo, lookup, progress, anomalies', () => {
  let owners: { phoneNumber: string; token: string }[]
  let attacker: { phoneNumber: string; token: string }
  let family: { phoneNumber: string; token: string }
  let garageOwner: { phoneNumber: string; token: string }
  let ownerIdx = 0
  function owner() { return owners[ownerIdx++ % owners.length] }

  beforeAll(async () => {
    owners = [await loginAsNewUser(), await loginAsNewUser(), await loginAsNewUser()]
    attacker = await loginAsNewUser()
    family = await loginAsNewUser()
    garageOwner = await loginAsNewUser()
    await createTestGarage(garageOwner.token)
  })

  describe('GET / — owned + shared vehicles', () => {
    it('lists only the caller\'s own vehicles when nothing is shared with them', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body.some((v: any) => v.id === vehicle.id && v.isShared === false)).toBe(true)
    })

    it('includes a vehicle shared with the caller, flagged isShared', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${o.token}`)
        .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)
      await request(app).patch(`/vehicle-shares/${share.body.id}/accept`).set('Authorization', `Bearer ${family.token}`).expect(200)

      const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${family.token}`)
      const shared = res.body.find((v: any) => v.id === vehicle.id)
      expect(shared).toBeDefined()
      expect(shared.isShared).toBe(true)
    })
  })

  describe('POST / — create validation', () => {
    it('rejects an invalid fuelType', async () => {
      const o = owner()
      const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${o.token}`)
        .send({ registrationNo: `WP TEST-${Math.floor(Math.random() * 1e6)}`, make: 'Toyota', model: 'Corolla', year: 2015, fuelType: 'Kerosene', mileage: 1000 })
      expect(res.status).toBe(400)
    })

    it('rejects an invalid vehicleType', async () => {
      const o = owner()
      const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${o.token}`)
        .send({ registrationNo: `WP TEST-${Math.floor(Math.random() * 1e6)}`, make: 'Toyota', model: 'Corolla', year: 2015, fuelType: 'Petrol 92', vehicleType: 'spaceship', mileage: 1000 })
      expect(res.status).toBe(400)
    })

    it('rejects a year outside the valid range', async () => {
      const o = owner()
      const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${o.token}`)
        .send({ registrationNo: `WP TEST-${Math.floor(Math.random() * 1e6)}`, make: 'Toyota', model: 'Corolla', year: 1800, fuelType: 'Petrol 92', mileage: 1000 })
      expect(res.status).toBe(400)
    })

    it('rejects a duplicate registration number', async () => {
      const o = owner()
      const regNo = `WP DUP-${crypto.randomInt(1_000_000, 999_999_999)}`
      await createTestVehicle(o.token, { registrationNo: regNo })
      const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${o.token}`)
        .send({ registrationNo: regNo, make: 'Honda', model: 'Fit', year: 2018, fuelType: 'Petrol 92', mileage: 2000 })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/already registered/i)
    })
  })

  describe('PATCH /:id — edit vehicle profile', () => {
    it('updates make/model/year/vehicleNotes', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ make: 'Honda', model: 'Vezel', year: 2019, vehicleNotes: 'Bought second-hand' })
      expect(res.status).toBe(200)
      expect(res.body.make).toBe('Honda')
      expect(res.body.model).toBe('Vezel')
      expect(res.body.vehicleNotes).toBe('Bought second-hand')
    })

    it('rejects an invalid fuelType on edit', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ fuelType: 'Kerosene' })
      expect(res.status).toBe(400)
    })

    it('a different owner cannot edit someone else\'s vehicle', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${attacker.token}`)
        .send({ make: 'Hijacked' })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /:id/photo', () => {
    it('sets a valid https photo URL', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}/photo`).set('Authorization', `Bearer ${o.token}`)
        .send({ photoUrl: 'https://example.com/photo.jpg' })
      expect(res.status).toBe(200)
      expect(res.body.photoUrl).toBe('https://example.com/photo.jpg')
    })

    it('rejects a non-https photo URL', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}/photo`).set('Authorization', `Bearer ${o.token}`)
        .send({ photoUrl: 'http://example.com/photo.jpg' })
      expect(res.status).toBe(400)
    })

    it('a different owner cannot set someone else\'s vehicle photo', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).patch(`/vehicles/${vehicle.id}/photo`).set('Authorization', `Bearer ${attacker.token}`)
        .send({ photoUrl: 'https://example.com/hijack.jpg' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /lookup — garage-only walk-in vehicle lookup', () => {
    it('a garage account finds a vehicle by registration number (minimal fields only)', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get('/vehicles/lookup')
        .set('Authorization', `Bearer ${garageOwner.token}`)
        .query({ registrationNo: vehicle.registrationNo })
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(vehicle.id)
      expect(res.body.ownerPhone).toBeUndefined() // no owner identity leaked
    })

    it('a non-garage account cannot use the lookup', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get('/vehicles/lookup')
        .set('Authorization', `Bearer ${o.token}`)
        .query({ registrationNo: vehicle.registrationNo })
      expect(res.status).toBe(403)
    })

    it('returns 404 for a registration number that doesn\'t exist', async () => {
      const res = await request(app).get('/vehicles/lookup')
        .set('Authorization', `Bearer ${garageOwner.token}`)
        .query({ registrationNo: 'ZZ NOPE-999999' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /:id/progress — profile completion score', () => {
    it('starts with a low score on a bare new vehicle', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get(`/vehicles/${vehicle.id}/progress`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body.score).toBeLessThan(100)
      expect(res.body.items.find((i: any) => i.id === 'photo').done).toBe(false)
    })

    // 7 sequential network round-trips against the real remote Neon test DB
    // (create vehicle, 2 GETs, 3 writes) - occasionally exceeds the default 30s
    // suite-wide timeout under load from the rest of the suite running before it.
    it('score rises as a photo, service record, and fuel log are added', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const before = await request(app).get(`/vehicles/${vehicle.id}/progress`).set('Authorization', `Bearer ${o.token}`)

      await request(app).patch(`/vehicles/${vehicle.id}/photo`).set('Authorization', `Bearer ${o.token}`)
        .send({ photoUrl: 'https://example.com/p.jpg' }).expect(200)
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2026-01-01', description: 'Oil Change' }).expect(201)
      await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2026-01-01', mileage: vehicle.mileage + 100, litres: 20, cost: 5000 }).expect(201)

      const after = await request(app).get(`/vehicles/${vehicle.id}/progress`).set('Authorization', `Bearer ${o.token}`)
      expect(after.body.score).toBeGreaterThan(before.body.score)
      expect(after.body.items.find((i: any) => i.id === 'photo').done).toBe(true)
      expect(after.body.items.find((i: any) => i.id === 'fuel').done).toBe(true)
    }, 60000)

    it('a different owner cannot view someone else\'s progress', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get(`/vehicles/${vehicle.id}/progress`).set('Authorization', `Bearer ${attacker.token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /:id/anomalies — service history pattern scan', () => {
    it('returns an empty list for a vehicle with no concerning history', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2026-01-01', description: 'Oil Change' }).expect(201)

      const res = await request(app).get(`/vehicles/${vehicle.id}/anomalies`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('flags a possible AC refrigerant leak after 3 AC gas refills within 18 months', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      for (const date of ['2026-01-01', '2026-04-01', '2026-07-01']) {
        await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
          .send({ date, description: 'AC Gas Refill' }).expect(201)
      }
      const res = await request(app).get(`/vehicles/${vehicle.id}/anomalies`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body.some((a: any) => a.id === 'ac_leak')).toBe(true)
    })

    it('a different owner cannot view someone else\'s anomalies', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get(`/vehicles/${vehicle.id}/anomalies`).set('Authorization', `Bearer ${attacker.token}`)
      expect(res.status).toBe(404)
    })
  })
})
