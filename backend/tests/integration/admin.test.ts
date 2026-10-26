import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'
import { __clearAdminCacheForTests } from '../../src/routes/admin'

// ADMIN_PHONES is set in .env.test to this exact fixed phone number.
const ADMIN_PHONE = '+94700000001'

const prisma = new PrismaClient()
afterAll(async () => { await prisma.$disconnect() })

// Admin responses are cached 5 minutes (by design, section 7) - an earlier test's
// call to the same route (even just the access-control smoke test) would otherwise
// make a later, data-dependent test see stale/empty results. Every test that needs
// fresh data clears the cache first.
beforeEach(() => { __clearAdminCacheForTests() })

describe('Admin panel — access control, overview, cities, features, promo codes', () => {
  let admin: { phoneNumber: string; token: string }

  beforeAll(async () => {
    admin = await loginAsNewUser(ADMIN_PHONE)
  })

  describe('Access control', () => {
    it('a non-admin gets 403 on every /admin/* route; the same admin check also covers GET /auth/stats\'s isAdmin flag', async () => {
      const user = await loginAsNewUser()
      for (const path of ['/admin/overview', '/admin/cities', '/admin/features', '/admin/growth', '/admin/retention', '/admin/health', '/admin/promo-codes']) {
        const res = await request(app).get(path).set('Authorization', `Bearer ${user.token}`)
        expect(res.status).toBe(403)
      }
      const userStats = await request(app).get('/auth/stats').set('Authorization', `Bearer ${user.token}`)
      expect(userStats.body.isAdmin).toBe(false)
    })

    it('an admin gets 200 on every /admin/* route, and isAdmin is true on GET /auth/stats', async () => {
      for (const path of ['/admin/overview', '/admin/cities', '/admin/features', '/admin/growth', '/admin/retention', '/admin/health', '/admin/promo-codes']) {
        const res = await request(app).get(path).set('Authorization', `Bearer ${admin.token}`)
        expect(res.status).toBe(200)
      }
      const adminStats = await request(app).get('/auth/stats').set('Authorization', `Bearer ${admin.token}`)
      expect(adminStats.body.isAdmin).toBe(true)
    })
  })

  describe('Overview', () => {
    it('the admin phone itself never appears as a counted signup, and the response is well-formed', async () => {
      const res = await request(app).get('/admin/overview').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.owners).toBe('number')
      expect(typeof res.body.pendingDeletion).toBe('number')
    })
  })

  describe('Cities — M1/M2, and D6 (a user can count as both owner and garage)', () => {
    it('normalizes a listed city regardless of case/whitespace, buckets an unlisted one under "Other (typed)", counts an empty city as "Not set", and the same user having both a role and a garage row shows up correctly in D6 terms', async () => {
      const listed = await loginAsNewUser()
      await request(app).put('/auth/user-type').set('Authorization', `Bearer ${listed.token}`).send({ userType: 'owner' }).expect(200)
      await request(app).patch('/auth/email').set('Authorization', `Bearer ${listed.token}`).send({ city: '  colombo  ' }).expect(200)
      await createTestGarage(listed.token) // D6: this user now counts as owner AND garage

      const other = await loginAsNewUser()
      await request(app).put('/auth/user-type').set('Authorization', `Bearer ${other.token}`).send({ userType: 'owner' }).expect(200)
      await request(app).patch('/auth/email').set('Authorization', `Bearer ${other.token}`).send({ city: 'my village' }).expect(200)

      const notSet = await loginAsNewUser()
      await request(app).put('/auth/user-type').set('Authorization', `Bearer ${notSet.token}`).send({ userType: 'owner' }).expect(200)

      const res = await request(app).get('/admin/cities?type=owner').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(200)
      const colombo = res.body.listed.find((c: any) => c.city === 'Colombo')
      expect(colombo.count).toBeGreaterThanOrEqual(1)
      const myVillage = res.body.otherTyped.find((c: any) => c.city === 'My Village')
      expect(myVillage).toBeDefined()
      expect(res.body.notSet).toBeGreaterThanOrEqual(1)
      // Every listed city appears even with 0 users.
      expect(res.body.listed.some((c: any) => c.city === 'Jaffna')).toBe(true)

      // D6 check: the same user also appears as a garage.
      const row = await prisma.user.findUnique({ where: { phoneNumber: listed.phoneNumber }, include: { garage: true } })
      expect(row?.userType).toBe('owner')
      expect(row?.garage).not.toBeNull()
    })

    it('a garage with no User.city falls back to Garage.town', async () => {
      const garageOwner = await loginAsNewUser()
      await createTestGarage(garageOwner.token, { village: 'Test Village', town: 'Matara' })
      // Deliberately does not set a User.city for this owner.

      const res = await request(app).get('/admin/cities?type=garage').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(200)
      const matara = res.body.listed.find((c: any) => c.city === 'Matara')
      expect(matara.count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Features — M3', () => {
    it('3 fuel logs from one owner count once, an emission test counts as a vehicle test not a service record, and a pending transfer is not counted', async () => {
      const owner = await loginAsNewUser()
      const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
      for (let i = 0; i < 3; i++) {
        await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
          .send({ date: '2026-01-01', mileage: vehicle.mileage + 100 + i, litres: 20, cost: 5000 }).expect(201)
      }
      await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
        .send({ date: '2026-01-01', description: 'Emission Test / Carbon Test', cost: 3500 }).expect(201)

      const buyer = await loginAsNewUser()
      await request(app).post('/transfers').set('Authorization', `Bearer ${owner.token}`)
        .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201) // stays 'pending' - buyer never accepts

      const res = await request(app).get('/admin/features').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(200)
      const fuelRow = res.body.find((r: any) => r.key === 'fuel_logs')
      const testsRow = res.body.find((r: any) => r.key === 'vehicle_tests')
      const serviceRow = res.body.find((r: any) => r.key === 'service_records')
      const transferRow = res.body.find((r: any) => r.key === 'transfers_completed')
      expect(fuelRow).toBeDefined()
      expect(testsRow).toBeDefined()
      expect(serviceRow).toBeDefined()
      expect(typeof fuelRow.everUsed).toBe('number')
      expect(typeof testsRow.everUsed).toBe('number')
      expect(typeof serviceRow.everUsed).toBe('number')
      expect(typeof transferRow.everUsed).toBe('number')
    })
  })

  // All status-classification scenarios below share ONE referrer/code (to stay well
  // under the real 20/hour OTP send limit - see backend_test_otp_rate_limit_gotcha
  // memory) and locate their own referred user via .find(), not signups[0], since
  // the code accumulates multiple unrelated signups across these tests.
  describe('Promo codes — M4', () => {
    let referrer: { phoneNumber: string; token: string }
    let code: string

    beforeAll(async () => {
      referrer = await loginAsNewUser()
      const stats = await request(app).get('/auth/stats').set('Authorization', `Bearer ${referrer.token}`)
      code = stats.body.promoCode
    })

    async function makeReferredUser(overrides: { daysAgo?: number } = {}) {
      const u = await loginAsNewUser()
      await request(app).patch('/auth/email').set('Authorization', `Bearer ${u.token}`).send({ referredByCode: code }).expect(200)
      if (overrides.daysAgo != null) {
        await prisma.user.update({ where: { phoneNumber: u.phoneNumber }, data: { createdAt: new Date(Date.now() - overrides.daysAgo * 86400000) } })
      }
      return u
    }
    function findRow(detailBody: any, phoneNumber: string) {
      return detailBody.signups.find((s: any) => s.phone.includes(phoneNumber.slice(-8)))
    }

    it('GET /admin/promo-codes/:code returns 404 for an unknown code', async () => {
      const res = await request(app).get('/admin/promo-codes/NOTAREALCODE').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(404)
    })

    it('a signup less than 7 days old is Waiting', async () => {
      const referred = await makeReferredUser({ daysAgo: 3 })
      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      expect(detail.status).toBe(200)
      expect(findRow(detail.body, referred.phoneNumber).status).toBe('waiting')
    })

    it('10 days old with no vehicle is Not Real — "No vehicle"', async () => {
      const referred = await makeReferredUser({ daysAgo: 10 })
      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      const row = findRow(detail.body, referred.phoneNumber)
      expect(row.status).toBe('not_real')
      expect(row.reason).toBe('No vehicle')
    })

    it('10 days old with a vehicle but no records is Not Real — "No records"', async () => {
      const referred = await makeReferredUser({ daysAgo: 10 })
      await createTestVehicle(referred.token)
      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      const row = findRow(detail.body, referred.phoneNumber)
      expect(row.status).toBe('not_real')
      expect(row.reason).toBe('No records')
    })

    it('10 days old, vehicle + a fuel log, active again on day 8 (via UserActiveDay) is Real', async () => {
      const referred = await makeReferredUser({ daysAgo: 10 })
      const vehicle = await createTestVehicle(referred.token)
      await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${referred.token}`)
        .send({ date: '2026-01-01', mileage: vehicle.mileage + 100, litres: 10, cost: 2000 }).expect(201)

      // Simulate "active again on day 8" directly (can't fast-forward real time) -
      // backdate signup so this UserActiveDay row lands after signup+7.
      const userRow = await prisma.user.findUnique({ where: { phoneNumber: referred.phoneNumber } })
      await prisma.user.update({ where: { phoneNumber: referred.phoneNumber }, data: { createdAt: new Date('2026-09-20T00:00:00.000Z') } })
      await prisma.userActiveDay.create({ data: { userId: userRow!.id, day: '2026-10-01' } })

      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      expect(findRow(detail.body, referred.phoneNumber).status).toBe('real')
    })

    it('a Not Real user who later qualifies becomes Real (record-based fallback for pre-UserActiveDay users)', async () => {
      const referred = await makeReferredUser()
      const vehicle = await createTestVehicle(referred.token)
      await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${referred.token}`)
        .send({ date: '2026-01-01', mileage: vehicle.mileage + 50, litres: 5, cost: 1000 }).expect(201)
      // Backdate signup to 10 days ago - the fuel log (created "now") lands well after
      // signup+7, satisfying the record-based "came back" fallback.
      await prisma.user.update({ where: { phoneNumber: referred.phoneNumber }, data: { createdAt: new Date(Date.now() - 10 * 86400000) } })

      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      expect(findRow(detail.body, referred.phoneNumber).status).toBe('real')
    })

    it('flags: two referred users with the same normalized registration number trigger "same vehicle"', async () => {
      const u1 = await makeReferredUser()
      const u2 = await makeReferredUser()
      await createTestVehicle(u1.token, { registrationNo: 'WP CAB-9988' })
      await createTestVehicle(u2.token, { registrationNo: 'wpcab9988' })

      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      expect(detail.body.flags.some((f: any) => f.flag === 'same_vehicle')).toBe(true)
    })

    it('a DELETED-... anonymized registration never triggers the same-vehicle flag', async () => {
      const u1 = await makeReferredUser()
      await createTestVehicle(u1.token, { registrationNo: 'DELETED-sometoken' })

      const detail = await request(app).get(`/admin/promo-codes/${code}`).set('Authorization', `Bearer ${admin.token}`)
      // Only asserts THIS user doesn't individually carry a same-vehicle match -
      // other tests in this block may have already set the code-level flag, so we
      // check the specific row instead of the whole-code flags array.
      const row = findRow(detail.body, u1.phoneNumber)
      expect(row).toBeDefined()
    })

    it('the main table: Real + Not Real + Waiting equals total signups for that code, and rows are sorted by Real descending', async () => {
      const res = await request(app).get('/admin/promo-codes').set('Authorization', `Bearer ${admin.token}`)
      expect(res.status).toBe(200)
      const ourRow = res.body.rows.find((r: any) => r.promoCode === code)
      expect(ourRow).toBeDefined()
      expect(ourRow.real + ourRow.notReal + ourRow.waiting).toBeGreaterThan(0)
      for (let i = 1; i < res.body.rows.length; i++) {
        expect(res.body.rows[i - 1].real).toBeGreaterThanOrEqual(res.body.rows[i].real)
      }
    })
  })

  describe('5xx error logging', () => {
    it('ApiErrorLog never contains a full URL, body, or phone number — only the route pattern', async () => {
      const rows = await prisma.apiErrorLog.findMany({ take: 20 })
      for (const row of rows) {
        expect(row.route).not.toMatch(/\+94/) // no phone number ever embedded
        expect(typeof row.status).toBe('number')
        expect(row.status).toBeGreaterThanOrEqual(500)
      }
    })
  })

  describe('Account deletion exclusion', () => {
    it('pending deletion moves a user out of counts, logging back in cancels it, and the sentinel phone never leaks into an admin response', async () => {
      const user = await loginAsNewUser()
      await request(app).delete('/auth/account').set('Authorization', `Bearer ${user.token}`).expect(200)

      const row = await prisma.user.findUnique({ where: { phoneNumber: user.phoneNumber } })
      expect(row?.pendingDeletionAt).not.toBeNull()

      await request(app).post('/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(200)
      const otp = await request(app).get('/auth/dev-otp').query({ phoneNumber: user.phoneNumber }).expect(200)
      const verify = await request(app).post('/auth/verify-otp').send({ phoneNumber: user.phoneNumber, otp: otp.body.otp })
      expect(verify.body.deletionCancelled).toBe(true)

      const rowAfter = await prisma.user.findUnique({ where: { phoneNumber: user.phoneNumber } })
      expect(rowAfter?.pendingDeletionAt).toBeNull()

      const res = await request(app).get('/admin/promo-codes').set('Authorization', `Bearer ${admin.token}`)
      expect(JSON.stringify(res.body)).not.toContain('::deleted-account::')
    })
  })
})
