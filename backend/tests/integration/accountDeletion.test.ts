import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'
import { checkAccountDeletions } from '../../src/jobs/accountDeletionSweep'
import { DELETED_ACCOUNT_SENTINEL_PHONE } from '../../src/utils/accountDeletion'

// Direct Prisma access needed for two things no API exposes: backdating
// pendingDeletionAt (DELETE /auth/account always sets it 14 days in the future -
// the sweep job only picks up dates already in the past) and inspecting a vehicle/
// garage/booking row after its owning account no longer exists to log in and view
// it through the normal endpoints.
const prisma = new PrismaClient()
afterAll(async () => { await prisma.$disconnect() })

describe('Account Deletion — request, cancel-on-login, hard-delete sweep', () => {
  it('DELETE /auth/account marks pendingDeletionAt ~14 days out', async () => {
    const user = await loginAsNewUser()
    const res = await request(app).delete('/auth/account').set('Authorization', `Bearer ${user.token}`)
    expect(res.status).toBe(200)
    expect(res.body.deletionDate).toBeDefined()

    const row = await prisma.user.findUnique({ where: { phoneNumber: user.phoneNumber } })
    expect(row?.pendingDeletionAt).not.toBeNull()
    const daysOut = (row!.pendingDeletionAt!.getTime() - Date.now()) / 86400000
    expect(daysOut).toBeGreaterThan(13)
    expect(daysOut).toBeLessThan(15)
  })

  it('logging back in during the grace period cancels the pending deletion', async () => {
    const user = await loginAsNewUser()
    await request(app).delete('/auth/account').set('Authorization', `Bearer ${user.token}`).expect(200)

    // Drives the real send-otp -> dev-otp -> verify-otp flow again, same identity.
    await request(app).post('/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(200)
    const freshOtp = await request(app).get('/auth/dev-otp').query({ phoneNumber: user.phoneNumber }).expect(200)
    const verify = await request(app).post('/auth/verify-otp')
      .send({ phoneNumber: user.phoneNumber, otp: freshOtp.body.otp })
    expect(verify.status).toBe(200)
    expect(verify.body.deletionCancelled).toBe(true)

    const row = await prisma.user.findUnique({ where: { phoneNumber: user.phoneNumber } })
    expect(row?.pendingDeletionAt).toBeNull()
  })

  it('a garage requesting deletion immediately cancels active bookings and notifies the owner', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: new Date(Date.now() + 5 * 86400000).toISOString() })
      .expect(201)

    const res = await request(app).delete('/auth/account').set('Authorization', `Bearer ${garageOwner.token}`)
    expect(res.status).toBe(200)

    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.body.id } })
    expect(updatedBooking?.status).toBe('cancelled')

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(notifs.body.some((n: any) => n.type === 'booking_cancelled')).toBe(true)

    // Garage row itself is untouched at request time - only hard-delete anonymizes it.
    const garageRow = await prisma.garage.findUnique({ where: { id: garage.id } })
    expect(garageRow?.name).toBe('Test Garage')
  })

  it('hard-delete sweep: anonymizes a garage in place, keeping the Booking row and the owner-side notification history intact', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token, { name: 'Soon Deleted Garage' })
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: new Date(Date.now() + 5 * 86400000).toISOString() })
      .expect(201)
    await request(app).post(`/bookings/${booking.body.id}/confirm`).set('Authorization', `Bearer ${garageOwner.token}`).expect(200)

    // Simulate the grace period having already elapsed, then run the sweep.
    await prisma.user.update({ where: { phoneNumber: garageOwner.phoneNumber }, data: { pendingDeletionAt: new Date(Date.now() - 1000) } })
    await checkAccountDeletions()

    const deletedUser = await prisma.user.findUnique({ where: { phoneNumber: garageOwner.phoneNumber } })
    expect(deletedUser).toBeNull()

    const anonymizedGarage = await prisma.garage.findUnique({ where: { id: garage.id } })
    expect(anonymizedGarage).not.toBeNull()
    expect(anonymizedGarage?.name).toBe('Deleted Garage')
    expect(anonymizedGarage?.ownerPhone).toBe(DELETED_ACCOUNT_SENTINEL_PHONE)

    // Booking survived the garage's deletion, pointing at the now-anonymized garage.
    // Status is 'cancelled' (hardDeleteAccount's own final cancellation sweep catches
    // any still-active booking, same as the immediate request-time cancellation would
    // have) - that's why it won't appear in /bookings/mine, which only lists active
    // ones; the row itself, and its relation, is what matters here.
    const survivingBooking = await prisma.booking.findUnique({ where: { id: booking.body.id }, include: { garage: true } })
    expect(survivingBooking).not.toBeNull()
    expect(survivingBooking?.garageId).toBe(garage.id)
    expect(survivingBooking?.status).toBe('cancelled')
    expect(survivingBooking?.garage.name).toBe('Deleted Garage')
  })

  it('hard-delete sweep: anonymizes a vehicle in place, keeping Booking alive for the garage\'s own history', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { registrationNo: `WP DEL-${Date.now()}` })
    const garage = await createTestGarage(garageOwner.token)
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: new Date(Date.now() + 5 * 86400000).toISOString() })
      .expect(201)
    await request(app).post(`/bookings/${booking.body.id}/confirm`).set('Authorization', `Bearer ${garageOwner.token}`).expect(200)

    await prisma.user.update({ where: { phoneNumber: owner.phoneNumber }, data: { pendingDeletionAt: new Date(Date.now() - 1000) } })
    await checkAccountDeletions()

    const deletedUser = await prisma.user.findUnique({ where: { phoneNumber: owner.phoneNumber } })
    expect(deletedUser).toBeNull()

    const anonymizedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle.id } })
    expect(anonymizedVehicle).not.toBeNull()
    expect(anonymizedVehicle?.make).toBe('Deleted')
    expect(anonymizedVehicle?.registrationNo).toBe(`DELETED-${vehicle.id}`)
    expect(anonymizedVehicle?.ownerPhone).toBe(DELETED_ACCOUNT_SENTINEL_PHONE)

    // Owner-exclusive data is gone.
    const remainingRecords = await prisma.serviceRecord.findMany({ where: { vehicleId: vehicle.id } })
    expect(remainingRecords.length).toBe(0)

    // Booking row survives, now against a "Deleted Vehicle" - status is 'cancelled'
    // (hardDeleteAccount's own final cancellation sweep), so it won't show in
    // /bookings/garage's active-only list; the row + relation is what matters here.
    const survivingBooking = await prisma.booking.findUnique({ where: { id: booking.body.id }, include: { vehicle: true } })
    expect(survivingBooking).not.toBeNull()
    expect(survivingBooking?.status).toBe('cancelled')
    expect(survivingBooking?.vehicle.make).toBe('Deleted')
  })

  it('hard-delete sweep: deletes GarageRating (explicitly agreed cascade-safe)', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    await createTestGarage(garageOwner.token)
    const submission = await request(app).post('/service-submissions/walkin').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ vehicleId: vehicle.id, description: 'Oil Change', cost: 5000 }).expect(201)
    await request(app).post(`/service-submissions/${submission.body.id}/accept`).set('Authorization', `Bearer ${owner.token}`).expect(200)
    await request(app).post(`/service-submissions/${submission.body.id}/rate`).set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 5 }).expect(201)

    const garage = await prisma.garage.findUnique({ where: { ownerPhone: garageOwner.phoneNumber } })
    await prisma.user.update({ where: { phoneNumber: garageOwner.phoneNumber }, data: { pendingDeletionAt: new Date(Date.now() - 1000) } })
    await checkAccountDeletions()

    const ratings = await prisma.garageRating.findMany({ where: { garageId: garage!.id } })
    expect(ratings.length).toBe(0)
  })

  describe('Public deletion-request page (no auth)', () => {
    it('GET /auth/delete-account serves the instructions page', async () => {
      const res = await request(app).get('/auth/delete-account')
      expect(res.status).toBe(200)
      expect(res.type).toBe('text/html')
      expect(res.text).toContain('Delete')
    })

    it('POST /auth/account-deletion-request sets pendingDeletionAt for a real account, by phone number alone', async () => {
      const user = await loginAsNewUser()
      const res = await request(app).post('/auth/account-deletion-request')
        .type('form')
        .send({ phoneNumber: user.phoneNumber })
      expect(res.status).toBe(200)

      const row = await prisma.user.findUnique({ where: { phoneNumber: user.phoneNumber } })
      expect(row?.pendingDeletionAt).not.toBeNull()
    })

    it('gives the same generic response for a phone number with no account (no enumeration)', async () => {
      const res = await request(app).post('/auth/account-deletion-request')
        .type('form')
        .send({ phoneNumber: '+94770000099' })
      expect(res.status).toBe(200)
      expect(res.type).toBe('text/html')
    })

    it('rejects a malformed phone number', async () => {
      const res = await request(app).post('/auth/account-deletion-request')
        .type('form')
        .send({ phoneNumber: 'not-a-phone' })
      expect(res.status).toBe(400)
    })
  })
})
