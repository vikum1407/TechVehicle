import request from 'supertest'
import { app, loginAsNewUser, createTestGarage } from '../helpers'

describe('Garage Availability — schedule settings, calendar overrides, bookable dates', () => {
  async function setup() {
    const garageOwner = await loginAsNewUser()
    const garage = await createTestGarage(garageOwner.token)
    return { garageOwner, garage }
  }

  it('sets schedule settings with the new {label, capacity} slot shape', async () => {
    const { garageOwner } = await setup()
    const res = await request(app)
      .put('/availability')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ workDays: [1, 2, 3, 4, 5], timeSlots: [{ label: 'Morning', capacity: 3 }, { label: 'Afternoon', capacity: 2 }] })
    expect(res.status).toBe(200)
    expect(res.body.maxPerDay).toBe(5)
  })

  it('still accepts the old plain-string timeSlots shape for backward compatibility', async () => {
    const { garageOwner } = await setup()
    const res = await request(app)
      .put('/availability')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ workDays: [1, 2, 3, 4, 5], timeSlots: ['Morning', 'Afternoon'], maxPerDay: 6 })
    expect(res.status).toBe(200)
  })

  it('rejects an out-of-range workDays value', async () => {
    const { garageOwner } = await setup()
    const res = await request(app)
      .put('/availability')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ workDays: [9], timeSlots: [{ label: 'Morning', capacity: 3 }] })
    expect(res.status).toBe(400)
  })

  it('a different user cannot view another garage\'s availability settings', async () => {
    const { garage } = await setup()
    const stranger = await loginAsNewUser()
    const res = await request(app)
      .get(`/availability/${garage.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
    expect(res.status).toBe(403)
  })

  it('sets, lists, and removes a calendar override', async () => {
    const { garageOwner, garage } = await setup()
    const date = '2027-01-15'
    const set = await request(app)
      .post('/availability/override')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ date, status: 'closed', message: 'Holiday' })
    expect(set.status).toBe(200)

    const list = await request(app)
      .get(`/availability/${garage.id}/overrides`)
      .query({ month: '2027-01' })
      .set('Authorization', `Bearer ${garageOwner.token}`)
    expect(list.body.some((o: any) => o.date === date && o.status === 'closed')).toBe(true)

    const remove = await request(app)
      .delete('/availability/override')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ date })
    expect(remove.status).toBe(200)

    const afterList = await request(app)
      .get(`/availability/${garage.id}/overrides`)
      .query({ month: '2027-01' })
      .set('Authorization', `Bearer ${garageOwner.token}`)
    expect(afterList.body.some((o: any) => o.date === date)).toBe(false)
  })

  it('rejects an invalid override status', async () => {
    const { garageOwner } = await setup()
    const res = await request(app)
      .post('/availability/override')
      .set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ date: '2027-01-15', status: 'not-a-real-status' })
    expect(res.status).toBe(400)
  })

  // The owner-facing GET /:garageId/dates endpoint is what BookingScreen's
  // date picker actually reads - a 'closed' override must make that date
  // genuinely unavailable, not just stored.
  it('a closed override makes that date unavailable in the bookable-dates list', async () => {
    const { garageOwner, garage } = await setup()
    await request(app).put('/availability').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ workDays: [0, 1, 2, 3, 4, 5, 6], timeSlots: [{ label: 'Morning', capacity: 3 }] }).expect(200)

    const future = new Date(Date.now() + 5 * 86400000)
    const dateStr = future.toISOString().split('T')[0]
    await request(app).post('/availability/override').set('Authorization', `Bearer ${garageOwner.token}`)
      .send({ date: dateStr, status: 'closed' }).expect(200)

    const owner = await loginAsNewUser()
    const dates = await request(app)
      .get(`/availability/${garage.id}/dates`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200)

    const found = dates.body.dates.find((d: any) => d.date === dateStr)
    expect(found).toBeDefined()
    expect(found.status).toBe('closed')
    expect(found.available).toBe(false)
  })
})
