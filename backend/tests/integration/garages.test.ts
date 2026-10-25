import request from 'supertest'
import { app, loginAsNewUser, createTestGarage } from '../helpers'

describe('Garages — registration, profile update, search by town/village', () => {
  it('registers a garage with just a name', async () => {
    const owner = await loginAsNewUser()
    const res = await request(app)
      .post('/garages/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Test Garage' })
    expect(res.status).toBe(201)
    expect(res.body.verified).toBe(false) // no BR number given
  })

  it('rejects registering a second garage for the same owner', async () => {
    const owner = await loginAsNewUser()
    await createTestGarage(owner.token)
    const res = await request(app)
      .post('/garages/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Second Garage' })
    expect(res.status).toBe(409)
  })

  it('requires village and town together if either is sent (structured address)', async () => {
    const owner = await loginAsNewUser()
    const res = await request(app)
      .post('/garages/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Test Garage', village: 'Kelaniya' }) // town missing
    expect(res.status).toBe(400)
  })

  it('updates a garage profile including the extra fields (About/Services/Phone/etc)', async () => {
    const owner = await loginAsNewUser()
    await createTestGarage(owner.token)
    const res = await request(app)
      .put('/garages/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Test Garage',
        aboutBio: 'Family-run garage since 2010',
        services: ['Oil Change', 'Brakes'],
        contactPhone: '0771234567',
      })
    expect(res.status).toBe(200)
    expect(res.body.aboutBio).toBe('Family-run garage since 2010')
    expect(res.body.services).toEqual(['Oil Change', 'Brakes'])
  })

  it('rejects an invalid contact phone format', async () => {
    const owner = await loginAsNewUser()
    await createTestGarage(owner.token)
    const res = await request(app)
      .put('/garages/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Test Garage', contactPhone: 'not-a-phone' })
    expect(res.status).toBe(400)
  })

  it('search matches by town/village, not just name', async () => {
    const owner = await loginAsNewUser()
    const townName = `UniqueTestTown${Math.floor(Math.random() * 1e6)}`
    await createTestGarage(owner.token, { village: 'Some Village', town: townName })

    const res = await request(app)
      .get('/garages/search')
      .query({ name: townName })
      .set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.some((g: any) => g.address?.includes(townName))).toBe(true)
  })
})
