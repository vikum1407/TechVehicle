import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Auth — push token, user type, notification prefs, stats, email/referral, profile photo', () => {
  it('POST /push-token accepts a valid Expo-format token and rejects a malformed one', async () => {
    const user = await loginAsNewUser()
    const ok = await request(app).post('/auth/push-token').set('Authorization', `Bearer ${user.token}`)
      .send({ pushToken: 'ExponentPushToken[fake-test-token-123]' })
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ ok: true })

    const bad = await request(app).post('/auth/push-token').set('Authorization', `Bearer ${user.token}`)
      .send({ pushToken: 'not-an-expo-token' })
    expect(bad.status).toBe(400)
  })

  it('PUT /user-type accepts owner/garage and rejects anything else', async () => {
    const user = await loginAsNewUser()
    const ok = await request(app).put('/auth/user-type').set('Authorization', `Bearer ${user.token}`)
      .send({ userType: 'garage' })
    expect(ok.status).toBe(200)
    expect(ok.body.userType).toBe('garage')

    const bad = await request(app).put('/auth/user-type').set('Authorization', `Bearer ${user.token}`)
      .send({ userType: 'admin' })
    expect(bad.status).toBe(400)
  })

  it('notification-prefs: defaults, then a partial update is merged and persists', async () => {
    const user = await loginAsNewUser()
    const defaults = await request(app).get('/auth/notification-prefs').set('Authorization', `Bearer ${user.token}`)
    expect(defaults.status).toBe(200)
    expect(defaults.body.mileage_reminder).toBe(true)

    await request(app).put('/auth/notification-prefs').set('Authorization', `Bearer ${user.token}`)
      .send({ mileage_reminder: false }).expect(200)

    const after = await request(app).get('/auth/notification-prefs').set('Authorization', `Bearer ${user.token}`)
    expect(after.body.mileage_reminder).toBe(false)
    expect(after.body.renewal).toBe(true) // untouched default still present
  })

  it('GET /stats reflects real counts and generates a stable promo code', async () => {
    const user = await loginAsNewUser()
    const vehicle = await createTestVehicle(user.token)
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-01-01', description: 'Oil Change' }).expect(201)
    await request(app).post(`/fuel-logs/${vehicle.id}`).set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-01-01', mileage: vehicle.mileage + 100, litres: 20, cost: 5000 }).expect(201)
    await request(app).post(`/expenses/${vehicle.id}`).set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: 200 }).expect(201)

    const res = await request(app).get('/auth/stats').set('Authorization', `Bearer ${user.token}`)
    expect(res.status).toBe(200)
    expect(res.body.vehicleCount).toBe(1)
    expect(res.body.serviceCount).toBe(1)
    expect(res.body.fuelCount).toBe(1)
    expect(res.body.expenseCount).toBe(1)
    expect(typeof res.body.promoCode).toBe('string')
    expect(res.body.promoCode.length).toBeGreaterThan(0)

    const again = await request(app).get('/auth/stats').set('Authorization', `Bearer ${user.token}`)
    expect(again.body.promoCode).toBe(res.body.promoCode) // stable, not regenerated each call
  })

  describe('PATCH /email', () => {
    it('sets a valid email and rejects an invalid one', async () => {
      const user = await loginAsNewUser()
      const ok = await request(app).patch('/auth/email').set('Authorization', `Bearer ${user.token}`)
        .send({ email: 'Test.User@Example.com' })
      expect(ok.status).toBe(200)
      expect(ok.body.email).toBe('test.user@example.com') // normalised to lowercase

      const bad = await request(app).patch('/auth/email').set('Authorization', `Bearer ${user.token}`)
        .send({ email: 'not-an-email' })
      expect(bad.status).toBe(400)
    })

    it('rejects an email already linked to another account', async () => {
      const first = await loginAsNewUser()
      const second = await loginAsNewUser()
      await request(app).patch('/auth/email').set('Authorization', `Bearer ${first.token}`)
        .send({ email: 'shared-email-test@example.com' }).expect(200)

      const res = await request(app).patch('/auth/email').set('Authorization', `Bearer ${second.token}`)
        .send({ email: 'shared-email-test@example.com' })
      expect(res.status).toBe(409)
    })

    it('can update city alone, without touching email', async () => {
      const user = await loginAsNewUser()
      const res = await request(app).patch('/auth/email').set('Authorization', `Bearer ${user.token}`)
        .send({ city: 'Colombo' })
      expect(res.status).toBe(200)
      expect(res.body.city).toBe('Colombo')
      expect(res.body.email).toBeNull()
    })

    it('requires at least one of email, city, or referredByCode', async () => {
      const user = await loginAsNewUser()
      const res = await request(app).patch('/auth/email').set('Authorization', `Bearer ${user.token}`).send({})
      expect(res.status).toBe(400)
    })

    it('accepts a valid promo/referral code from another user, but rejects a self-referral and an invalid code', async () => {
      const referrer = await loginAsNewUser()
      const referrerStats = await request(app).get('/auth/stats').set('Authorization', `Bearer ${referrer.token}`)
      const code = referrerStats.body.promoCode

      // Self-referral first, before the referrer has any referredByCode of their own set -
      // once a user HAS one set, the route treats it as "already decided" and skips
      // validation entirely (first submission wins, by design) rather than re-checking.
      const selfRes = await request(app).patch('/auth/email').set('Authorization', `Bearer ${referrer.token}`)
        .send({ referredByCode: code })
      expect(selfRes.status).toBe(400)

      // A different fresh user (also with no referredByCode set yet) submits an
      // invalid code - must be checked before any valid referral, for the same reason.
      const invalidAttempt = await loginAsNewUser()
      const invalidRes = await request(app).patch('/auth/email').set('Authorization', `Bearer ${invalidAttempt.token}`)
        .send({ referredByCode: 'NOTAREALCODE' })
      expect(invalidRes.status).toBe(400)

      const referred = await loginAsNewUser()
      const ok = await request(app).patch('/auth/email').set('Authorization', `Bearer ${referred.token}`)
        .send({ referredByCode: code })
      expect(ok.status).toBe(200)
    })
  })

  describe('PATCH /profile-photo', () => {
    it('sets a valid https photo URL and rejects a non-https one', async () => {
      const user = await loginAsNewUser()
      const ok = await request(app).patch('/auth/profile-photo').set('Authorization', `Bearer ${user.token}`)
        .send({ photoUrl: 'https://example.com/me.jpg' })
      expect(ok.status).toBe(200)
      expect(ok.body.profilePhotoUrl).toBe('https://example.com/me.jpg')

      const bad = await request(app).patch('/auth/profile-photo').set('Authorization', `Bearer ${user.token}`)
        .send({ photoUrl: 'http://example.com/me.jpg' })
      expect(bad.status).toBe(400)
    })
  })
})
