import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

// Shared across the file (not per-test) - logging in fresh users for every
// single test exhausts the real per-IP OTP send rate limit (20/hour, a
// deliberate anti-abuse feature in otpRateLimit.ts) once a file has more than
// a handful of tests. Each test still gets its own fresh VEHICLE (no OTP
// cost) for isolation; only the handful of tests that genuinely need a THIRD
// distinct identity (an attacker) log in separately.
describe('Vehicle Transfers — the Sell/Transfer Engine', () => {
  let seller: { phoneNumber: string; token: string }
  let buyer: { phoneNumber: string; token: string }

  beforeAll(async () => {
    seller = await loginAsNewUser()
    buyer = await loginAsNewUser()
  })

  it('initiates a transfer to a valid buyer phone number', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const res = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
  })

  it('rejects transferring a vehicle to yourself', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const res = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: seller.phoneNumber })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid buyer phone number', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const res = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: 'not-a-phone' })
    expect(res.status).toBe(400)
  })

  it('refuses a second pending transfer for the same vehicle', async () => {
    const vehicle = await createTestVehicle(seller.token)
    await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const res = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }) // a second attempt, same buyer is enough to prove the guard - no need for a fresh one
    expect(res.status).toBe(400)
  })

  it('a non-owner cannot initiate a transfer for someone else\'s vehicle', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const attacker = await loginAsNewUser()
    const res = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber })
    expect(res.status).toBe(404)
  })

  it('the buyer sees the transfer in their incoming list', async () => {
    const vehicle = await createTestVehicle(seller.token)
    await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const res = await request(app).get('/transfers/incoming').set('Authorization', `Bearer ${buyer.token}`)
    expect(res.status).toBe(200)
    expect(res.body.some((t: any) => t.vehicleId === vehicle.id)).toBe(true)
  })

  it('only the named buyer can accept the transfer', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const transfer = await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const attacker = await loginAsNewUser()
    const blocked = await request(app)
      .post(`/transfers/${transfer.body.id}/accept`)
      .set('Authorization', `Bearer ${attacker.token}`)
    expect(blocked.status).toBe(404)
  })

  // The core of the Sell/Transfer Engine: ownership genuinely moves, and the
  // vehicle leaves the seller's own account the moment it's accepted.
  it('accepting a transfer moves ownership from seller to buyer', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const transfer = await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const accept = await request(app)
      .post(`/transfers/${transfer.body.id}/accept`)
      .set('Authorization', `Bearer ${buyer.token}`)
    expect(accept.status).toBe(200)

    const sellerVehicles = await request(app).get('/vehicles').set('Authorization', `Bearer ${seller.token}`)
    expect(sellerVehicles.body.find((v: any) => v.id === vehicle.id)).toBeUndefined()

    const buyerVehicles = await request(app).get('/vehicles').set('Authorization', `Bearer ${buyer.token}`)
    expect(buyerVehicles.body.find((v: any) => v.id === vehicle.id)).toBeDefined()
  })

  it('only the seller can cancel a pending transfer', async () => {
    const vehicle = await createTestVehicle(seller.token)
    const transfer = await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const blocked = await request(app)
      .delete(`/transfers/${transfer.body.id}`)
      .set('Authorization', `Bearer ${buyer.token}`)
    expect(blocked.status).toBe(404)

    const cancelled = await request(app)
      .delete(`/transfers/${transfer.body.id}`)
      .set('Authorization', `Bearer ${seller.token}`)
    expect(cancelled.status).toBe(200)
  })

  // Privacy rule from vehicleHealthSummary.ts: a buyer who hasn't accepted yet
  // only sees Legal & Compliance expense categories, not personal/behavioral
  // ones (Parking, Toll, Fine/Penalty, Accessories, Washing).
  it('pre-accept preview withholds personal expense categories from the buyer', async () => {
    const vehicle = await createTestVehicle(seller.token)
    await request(app).post('/expenses/' + vehicle.id).set('Authorization', `Bearer ${seller.token}`)
      .send({ date: '2026-01-01', category: 'Parking', amount: 200 }).expect(201)
    await request(app).post('/expenses/' + vehicle.id).set('Authorization', `Bearer ${seller.token}`)
      .send({ date: '2026-01-01', category: 'Insurance', amount: 45000 }).expect(201)

    const transfer = await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)

    const preview = await request(app)
      .get(`/transfers/${transfer.body.id}/records`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200)

    const categories = preview.body.expenses.map((e: any) => e.category)
    expect(categories).toContain('Insurance')
    expect(categories).not.toContain('Parking')
  })
})
