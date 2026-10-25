import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app, loginAsNewUser, createTestVehicle, createTestGarage } from '../helpers'
import { checkRenewals } from '../../src/jobs/renewalReminders'
import { checkMileageReminders } from '../../src/jobs/mileageReminders'
import { checkSetupReminders, checkServicesDue } from '../../src/jobs/serviceNotifications'
import { checkBookingReminders } from '../../src/jobs/bookingReminders'

// The 4 cron jobs in src/jobs/*.ts are scheduled background work, not HTTP
// endpoints - there's no route to drive them through supertest. Their actual
// check*() functions are exported (additively, no behavior change) so tests
// can call them directly, the same logic startXJob() runs on a timer in
// production, without starting a real setInterval/setTimeout in the test
// process.
//
// A few of these jobs query users by `pushToken: { not: null }` - the only
// way to set a REAL pushToken through the public API is auth.ts's
// /push-token endpoint, which strictly requires the exact Expo format
// (ExponentPushToken[...]). Using one of those here would make the job's
// sendPush() call actually hit Expo's live push API during a test run - the
// same class of risk as the R2 upload incident elsewhere in this suite. A
// plain Prisma write (bypassing that endpoint entirely, same test DB these
// jobs already read from) sets a token that satisfies "not null" for the
// query while sendPush() safely no-ops on it (push.ts only calls out when
// the token starts with 'ExponentPushToken').
const prisma = new PrismaClient()
afterAll(async () => { await prisma.$disconnect() })

async function setFakePushToken(phoneNumber: string) {
  await prisma.user.update({ where: { phoneNumber }, data: { pushToken: 'fake-test-token-not-expo-format' } })
}

describe('Cron Jobs — renewal, mileage, service-due, setup, booking reminders', () => {
  it('checkRenewals sends an emission-test reminder and stamps lastEmissionReminderSent', async () => {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) // within the 30-day window
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${owner.token}`)
      .send({ emissionTestExpiry: soon }).expect(200)

    await checkRenewals()

    const vehicles = await request(app).get('/vehicles').set('Authorization', `Bearer ${owner.token}`)
    const updated = vehicles.body.find((v: any) => v.id === vehicle.id)
    expect(updated.lastEmissionReminderSent).not.toBeNull()

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(notifs.body.some((n: any) => n.type === 'emission_reminder')).toBe(true)
  })

  it('checkRenewals does not re-send within 3 days of the last reminder for the same vehicle', async () => {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    await request(app).patch(`/vehicles/${vehicle.id}/expiry`).set('Authorization', `Bearer ${owner.token}`)
      .send({ emissionTestExpiry: soon }).expect(200)

    await checkRenewals()
    const afterFirst = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    const firstCount = afterFirst.body.filter((n: any) => n.type === 'emission_reminder').length
    expect(firstCount).toBe(1)

    await checkRenewals() // runs again immediately - should be a no-op for this vehicle
    const afterSecond = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    const secondCount = afterSecond.body.filter((n: any) => n.type === 'emission_reminder').length
    expect(secondCount).toBe(1)
  })

  it('checkMileageReminders nudges a user with a vehicle and no recent fuel/service activity', async () => {
    const owner = await loginAsNewUser()
    await createTestVehicle(owner.token) // no fuel log, no service record logged
    await setFakePushToken(owner.phoneNumber)

    await checkMileageReminders()

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(notifs.body.some((n: any) => n.type === 'mileage_reminder')).toBe(true)
  })

  it('checkSetupReminders nudges a user whose vehicle has 3+ unconfigured predictions', async () => {
    const owner = await loginAsNewUser()
    await createTestVehicle(owner.token) // real curated make/model, zero service records -> several no_data predictions
    await setFakePushToken(owner.phoneNumber)

    await checkSetupReminders()

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(notifs.body.some((n: any) => n.type === 'setup_reminder')).toBe(true)
  })

  it('checkServicesDue notifies a user with an overdue service prediction', async () => {
    const owner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token, { mileage: 50000 })
    await request(app).post(`/service-records/${vehicle.id}`).set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2024-01-01', description: 'Engine Oil Change', mileage: 1000 }).expect(201)
    await setFakePushToken(owner.phoneNumber)

    await checkServicesDue()

    const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(notifs.body.some((n: any) => n.type === 'service_reminder')).toBe(true)
  })

  it('checkBookingReminders notifies both owner and garage for a confirmed booking ~1 day out, and marks it sent', async () => {
    const owner = await loginAsNewUser()
    const garageOwner = await loginAsNewUser()
    const vehicle = await createTestVehicle(owner.token)
    const garage = await createTestGarage(garageOwner.token)
    const bookingDate = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString() // 20h out - inside the 8-32h window
    const booking = await request(app).post('/bookings').set('Authorization', `Bearer ${owner.token}`)
      .send({ vehicleId: vehicle.id, garageId: garage.id, date: bookingDate }).expect(201)
    await request(app).post(`/bookings/${booking.body.id}/confirm`).set('Authorization', `Bearer ${garageOwner.token}`).expect(200)

    await checkBookingReminders()

    const ownerNotifs = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    expect(ownerNotifs.body.some((n: any) => n.type === 'booking_reminder')).toBe(true)
    const garageNotifs = await request(app).get('/notifications').set('Authorization', `Bearer ${garageOwner.token}`)
    expect(garageNotifs.body.some((n: any) => n.type === 'booking_reminder')).toBe(true)

    // Running it again should not double-send - reminderSent is now true for this booking
    await checkBookingReminders()
    const ownerNotifsAfter = await request(app).get('/notifications').set('Authorization', `Bearer ${owner.token}`)
    const count = ownerNotifsAfter.body.filter((n: any) => n.type === 'booking_reminder').length
    expect(count).toBe(1)
  })
})
