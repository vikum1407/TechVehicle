import request from 'supertest'
import { app } from '../helpers'

describe('Vehicle Knowledge — public spec lookup (no auth needed)', () => {
  it('returns the full spec list', async () => {
    const res = await request(app).get('/vehicle-knowledge')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(100) // 137+ entries as of the 2026-10-24 expansion
  })

  it('matches a known make/model', async () => {
    const res = await request(app).get('/vehicle-knowledge/match').query({ make: 'Toyota', model: 'Prius' })
    expect(res.status).toBe(200)
    expect(res.body.make).toBe('Toyota')
  })

  it('narrows to the right generation when a year is given', async () => {
    const res = await request(app).get('/vehicle-knowledge/match').query({ make: 'Toyota', model: 'Prius', year: '2005' })
    expect(res.status).toBe(200)
    expect(res.body.yearFrom).toBeLessThanOrEqual(2005)
    expect(res.body.yearTo === null || res.body.yearTo >= 2005).toBe(true)
  })

  it('requires both make and model', async () => {
    const res = await request(app).get('/vehicle-knowledge/match').query({ make: 'Toyota' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for a vehicle not in the catalog', async () => {
    const res = await request(app).get('/vehicle-knowledge/match').query({ make: 'NotARealBrand', model: 'NotARealModel' })
    expect(res.status).toBe(404)
  })
})
