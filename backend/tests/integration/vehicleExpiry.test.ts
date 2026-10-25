import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

// Round-robin across a small pool of owners - vehicles.ts rate-limits vehicle
// CREATION at 10/hour per phone number (separate from the OTP send limit), and
// this file creates a fresh vehicle per test. See
// backend_test_suite_status_2026_10_25 memory note for this gotcha.
describe('Vehicles — PATCH /:id/expiry (renewal lock, history archiving)', () => {
  let owners: { phoneNumber: string; token: string }[]
  let attacker: { phoneNumber: string; token: string }
  let ownerIdx = 0
  function owner() { return owners[ownerIdx++ % owners.length] }

  beforeAll(async () => {
    owners = [await loginAsNewUser(), await loginAsNewUser()]
    attacker = await loginAsNewUser()
  })

  it('sets emission test expiry for the first time with no lock check (nothing to renew yet)', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ emissionTestExpiry: '2027-06-01' })
    expect(res.status).toBe(200)
    expect(new Date(res.body.emissionTestExpiry).toISOString().slice(0, 10)).toBe('2027-06-01')
  })

  it('rejects an invalid emission test expiry date', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ emissionTestExpiry: 'not-a-date' })
    expect(res.status).toBe(400)
  })

  it('rejects a renewal more than 90 days before the current expiry, without skipHistory', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    // Far-future expiry (well over 90 days out) so a second "renewal" attempt should be locked
    const farFuture = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10)
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: farFuture }).expect(200)

    const anotherFuture = new Date(Date.now() + 230 * 86400000).toISOString().slice(0, 10)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: anotherFuture })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/still valid/i)
  })

  it('skipHistory bypasses the renewal lock and does not archive the old value', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const farFuture = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10)
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: farFuture }).expect(200)

    // A typo-correction to the SAME still-valid entry, explicitly marked skipHistory
    const corrected = new Date(Date.now() + 201 * 86400000).toISOString().slice(0, 10)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: corrected, skipHistory: true })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.revenueLicenceHistory) ? res.body.revenueLicenceHistory.length : 0).toBe(0)
  })

  it('a genuine renewal within the lock window archives the old revenue licence expiry into history', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    // Expiring soon (inside the 90-day lock window) so the next renewal is allowed
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: soon, skipHistory: true }).expect(200) // seed without triggering the lock check on an empty vehicle

    const renewed = new Date(Date.now() + 375 * 86400000).toISOString().slice(0, 10)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ revenueLicenceExpiry: renewed })
    expect(res.status).toBe(200)
    expect(res.body.revenueLicenceHistory.length).toBe(1)
    expect(res.body.revenueLicenceHistory[0].expiry.slice(0, 10)).toBe(soon)
  })

  it('archives the old insurance company/policy/expiry together when any of them changes', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ insuranceExpiry: soon, insuranceCompany: 'Old Insurer', insurancePolicyNo: 'OLD-123', skipHistory: true }).expect(200)

    const renewed = new Date(Date.now() + 375 * 86400000).toISOString().slice(0, 10)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ insuranceExpiry: renewed, insuranceCompany: 'New Insurer', insurancePolicyNo: 'NEW-456' })
    expect(res.status).toBe(200)
    expect(res.body.insuranceCompany).toBe('New Insurer')
    expect(res.body.insurancePolicyHistory.length).toBe(1)
    expect(res.body.insurancePolicyHistory[0].company).toBe('Old Insurer')
    expect(res.body.insurancePolicyHistory[0].policyNo).toBe('OLD-123')
  })

  it('rejects a malformed insurancePolicyHistory payload', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ insurancePolicyHistory: 'not-an-array' })
    expect(res.status).toBe(400)
  })

  it('accepts a direct history array replacement (used to delete a single past entry)', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const replacement = [{ company: 'Kept Insurer', policyNo: 'KEEP-1', expiry: null, replacedAt: new Date().toISOString() }]
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${o.token}`)
      .send({ insurancePolicyHistory: replacement })
    expect(res.status).toBe(200)
    expect(res.body.insurancePolicyHistory).toEqual(replacement)
  })

  it('a different owner cannot touch someone else\'s expiry dates', async () => {
    const o = owner()
    const vehicle = await createTestVehicle(o.token)
    const res = await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${attacker.token}`)
      .send({ emissionTestExpiry: '2027-06-01' })
    expect(res.status).toBe(404)
  })
})
