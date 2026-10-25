import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

// Round-robin across a small pool of owners - avoids the 10/hour per-phone
// vehicle-creation rate limit once a file creates more than ~8 vehicles. See
// backend_test_suite_status_2026_10_25 memory note.
describe('Predictions — service-due predictions, cost forecast, IDOR', () => {
  let owners: { phoneNumber: string; token: string }[]
  let attacker: { phoneNumber: string; token: string }
  let family: { phoneNumber: string; token: string }
  let ownerIdx = 0
  function owner() { return owners[ownerIdx++ % owners.length] }

  beforeAll(async () => {
    owners = [await loginAsNewUser(), await loginAsNewUser()]
    attacker = await loginAsNewUser()
    family = await loginAsNewUser()
  })

  describe('GET /:vehicleId', () => {
    it('includes a row for a logged service matching a known interval', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token, { mileage: 50000 })
      // Logged far enough in the past (by mileage) that it's overdue under any
      // realistic real-world interval (typically 5,000-10,000 km) - avoids
      // depending on the exact curated kmInterval for this make/model.
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2024-01-01', description: 'Engine Oil Change', mileage: 1000, cost: 9000 }).expect(201)

      const res = await request(app).get(`/predictions/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      const oilRow = res.body.find((p: any) => p.group === 'oil_change')
      expect(oilRow).toBeDefined()
      expect(oilRow.status).toBe('overdue')
      expect(oilRow.lastDoneKm).toBe(1000)
    })

    it('a shared (family) recipient can read predictions for the vehicle', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const share = await request(app).post('/vehicle-shares').set('Authorization', `Bearer ${o.token}`)
        .send({ vehicleId: vehicle.id, sharedWithPhone: family.phoneNumber }).expect(201)
      await request(app).patch(`/vehicle-shares/${share.body.id}/accept`).set('Authorization', `Bearer ${family.token}`).expect(200)

      const res = await request(app).get(`/predictions/${vehicle.id}`).set('Authorization', `Bearer ${family.token}`)
      expect(res.status).toBe(200)
    })

    it('a non-owner, non-shared user cannot read predictions', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get(`/predictions/${vehicle.id}`).set('Authorization', `Bearer ${attacker.token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /:vehicleId/cost-forecast', () => {
    it('includes an overdue service item with cost estimated from past matching records', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token, { mileage: 50000 })
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2024-01-01', description: 'Engine Oil Change', mileage: 1000, cost: 9000 }).expect(201)

      const res = await request(app).get(`/predictions/${vehicle.id}/cost-forecast`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body.periodDays).toBe(90)
      const oilItem = res.body.items.find((i: any) => i.name === 'Engine Oil Change')
      expect(oilItem).toBeDefined()
      expect(oilItem.status).toBe('overdue')
      expect(oilItem.estimatedCost).toBe(9000)
      expect(oilItem.basedOn).toBe(1)
      expect(res.body.totalEstimated).toBeGreaterThanOrEqual(9000)
    })

    it('includes an Emission Test renewal item once emissionTestExpiry is within the forecast window, costed from matching service records', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2024-01-01', description: 'Emission Test', mileage: vehicle.mileage, cost: 3500 }).expect(201)
      await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
        .send({ emissionTestExpiry: '2025-01-01' }).expect(200) // already expired -> overdue, well within the 90-day window

      const res = await request(app).get(`/predictions/${vehicle.id}/cost-forecast`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      const emissionItem = res.body.items.find((i: any) => i.name === 'Emission Test')
      expect(emissionItem).toBeDefined()
      expect(emissionItem.status).toBe('overdue')
      expect(emissionItem.estimatedCost).toBe(3500)
    })

    it('includes an Insurance renewal item costed from matching Expense rows, not ServiceRecords', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      await request(app).post(`/expenses/${vehicle.id}`).set('Authorization', `Bearer ${o.token}`)
        .send({ date: '2024-01-01', category: 'Insurance', amount: 45000 }).expect(201)
      await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
        .send({ insuranceExpiry: '2025-01-01' }).expect(200)

      const res = await request(app).get(`/predictions/${vehicle.id}/cost-forecast`).set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      const insuranceItem = res.body.items.find((i: any) => i.name === 'Insurance')
      expect(insuranceItem).toBeDefined()
      expect(insuranceItem.estimatedCost).toBe(45000)
    })

    it('a non-owner, non-shared user cannot read the cost forecast', async () => {
      const o = owner()
      const vehicle = await createTestVehicle(o.token)
      const res = await request(app).get(`/predictions/${vehicle.id}/cost-forecast`).set('Authorization', `Bearer ${attacker.token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /notify', () => {
    // Deliberately not exercising the "has a push token" branch here - the
    // only way to set a real pushToken through the API is the Expo-format
    // regex in auth.ts's /push-token endpoint, and a token in that exact
    // format would make sendPush() actually call Expo's live push API (same
    // "don't let a test touch a real third-party service" caution as the R2
    // upload incident). The no-push-token branch below is the safe, fully
    // self-contained part of this route to test.
    it('reports nothing sent when the user has no push token registered', async () => {
      const o = owner()
      const res = await request(app).post('/predictions/notify').set('Authorization', `Bearer ${o.token}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ sent: 0, reason: 'no push token' })
    })
  })
})
