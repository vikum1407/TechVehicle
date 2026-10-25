import crypto from 'crypto'
import request from 'supertest'
import { createApp } from '../src/app'

export const app = createApp()

// Random, not sequential - a per-file counter looked unique within one test
// file but Jest gives each test FILE its own fresh module instance, so every
// file's counter restarted at 1, generating the same phone number across
// files. Since all files share one physical test database (only reset once,
// at suite start), that collided real data between unrelated tests. Random
// 7-digit suffix makes cross-file collisions astronomically unlikely instead.
export function nextTestPhone(): string {
  const suffix = crypto.randomInt(1000000, 10000000)
  return `+9477${suffix}`
}

// Drives the real OTP flow end-to-end (send -> dev-otp -> verify) to get a
// genuine JWT, the same way a real client would - not a shortcut that bypasses
// auth logic. Relies on GET /auth/dev-otp, which only exists when
// NODE_ENV !== 'production' (true for tests) - see routes/auth.ts.
export async function loginAsNewUser(phoneNumber = nextTestPhone()): Promise<{ phoneNumber: string; token: string }> {
  await request(app).post('/auth/send-otp').send({ phoneNumber }).expect(200)
  const otpRes = await request(app).get('/auth/dev-otp').query({ phoneNumber }).expect(200)
  const verifyRes = await request(app)
    .post('/auth/verify-otp')
    .send({ phoneNumber, otp: otpRes.body.otp })
    .expect(200)
  return { phoneNumber, token: verifyRes.body.token as string }
}

// registrationNo has a unique constraint. A 6-digit random suffix (0-999999)
// had a non-negligible birthday-paradox collision chance once the suite grew
// past ~150 createTestVehicle calls across all files combined (observed as a
// real, intermittent "already registered" 400 in an unrelated file on
// 2026-10-25) - crypto.randomInt over a much larger range, same approach as
// nextTestPhone, makes a collision practically impossible at any realistic
// suite size.
export async function createTestVehicle(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const res = await request(app)
    .post('/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send({
      registrationNo: `WP TEST-${crypto.randomInt(1_000_000, 999_999_999)}`,
      make: 'Toyota',
      model: 'Corolla',
      year: 2015,
      fuelType: 'Petrol 92',
      vehicleType: 'car-petrol',
      mileage: 50000,
      ...overrides,
    })
    .expect(201)
  return res.body
}

export async function createTestGarage(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const res = await request(app)
    .post('/garages/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Garage', ...overrides })
    .expect(201)
  return res.body
}
