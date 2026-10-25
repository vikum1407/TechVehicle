import request from 'supertest'
import { app } from '../helpers'

describe('Service Categories — public, vehicle-type-aware filtering', () => {
  it('requires no auth (static config data)', async () => {
    const res = await request(app).get('/service-categories')
    expect(res.status).toBe(200)
    expect(res.body.categories.length).toBeGreaterThan(0)
  })

  it('adds Chain & Sprocket items for a motorcycle', async () => {
    const res = await request(app).get('/service-categories').query({ vehicleType: 'motorcycle' })
    const transmission = res.body.categories.find((c: any) => c.title === 'Transmission & Drive')
    expect(transmission.items).toContain('Chain & Sprocket')
  })

  it('a car does not get motorcycle-only chain items', async () => {
    const res = await request(app).get('/service-categories').query({ vehicleType: 'car-petrol' })
    const transmission = res.body.categories.find((c: any) => c.title === 'Transmission & Drive')
    expect(transmission?.items ?? []).not.toContain('Chain & Sprocket')
  })

  it('adds EV-specific items for an electric vehicle', async () => {
    const res = await request(app).get('/service-categories').query({ vehicleType: 'electric' })
    const electrical = res.body.categories.find((c: any) => c.title === 'Electrical')
    expect(electrical.items).toContain('EV Battery Check')
  })
})
