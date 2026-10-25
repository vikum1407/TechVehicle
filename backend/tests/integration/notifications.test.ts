import request from 'supertest'
import { app, loginAsNewUser, createTestVehicle } from '../helpers'

describe('Notifications — list, unread count, mark as read', () => {
  // Uses a real transfer to generate a genuine notification (createNotification
  // is exercised indirectly through an actual feature, not faked directly).
  async function setupWithNotification() {
    const seller = await loginAsNewUser()
    const buyer = await loginAsNewUser()
    const vehicle = await createTestVehicle(seller.token)
    await request(app).post('/transfers').set('Authorization', `Bearer ${seller.token}`)
      .send({ vehicleId: vehicle.id, buyerPhone: buyer.phoneNumber }).expect(201)
    return { seller, buyer }
  }

  it('the recipient sees the notification, unread', async () => {
    const { buyer } = await setupWithNotification()
    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${buyer.token}`)
    expect(list.status).toBe(200)
    expect(list.body.length).toBeGreaterThan(0)
    expect(list.body[0].read).toBe(false)

    const count = await request(app).get('/notifications/unread-count').set('Authorization', `Bearer ${buyer.token}`)
    expect(count.body.count).toBeGreaterThan(0)
  })

  it('read-all marks everything as read and zeroes the unread count', async () => {
    const { buyer } = await setupWithNotification()
    await request(app).post('/notifications/read-all').set('Authorization', `Bearer ${buyer.token}`).expect(200)

    const count = await request(app).get('/notifications/unread-count').set('Authorization', `Bearer ${buyer.token}`)
    expect(count.body.count).toBe(0)

    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${buyer.token}`)
    expect(list.body.every((n: any) => n.read === true)).toBe(true)
  })

  it('notifications are scoped to the recipient - the seller doesn\'t see the buyer\'s notification', async () => {
    const { seller } = await setupWithNotification()
    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${seller.token}`)
    expect(list.body.find((n: any) => n.type === 'transfer')).toBeUndefined()
  })
})
