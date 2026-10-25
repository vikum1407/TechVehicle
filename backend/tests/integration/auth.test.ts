import request from 'supertest'
import { app, nextTestPhone, loginAsNewUser } from '../helpers'

describe('Auth flow (OTP -> JWT -> protected routes)', () => {
  it('rejects a request to a protected route with no token', async () => {
    const res = await request(app).get('/vehicles')
    expect(res.status).toBe(401)
  })

  it('rejects a malformed/garbage token', async () => {
    const res = await request(app).get('/vehicles').set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
  })

  it('completes OTP signup and issues a working JWT', async () => {
    const { token } = await loginAsNewUser()
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([]) // brand new user, no vehicles yet
  })

  it('rejects verify-otp with the wrong code', async () => {
    const phoneNumber = nextTestPhone()
    await request(app).post('/auth/send-otp').send({ phoneNumber }).expect(200)
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ phoneNumber, otp: '000000' })
    expect(res.status).toBe(400)
  })

  it('logout-everywhere revokes the previously issued token (tokenVersion bump)', async () => {
    const { token } = await loginAsNewUser()

    // Token works before revocation
    await request(app).get('/vehicles').set('Authorization', `Bearer ${token}`).expect(200)

    await request(app).post('/auth/logout-everywhere').set('Authorization', `Bearer ${token}`).expect(200)

    // Same token now fails, even though it hasn't expired - this is the whole
    // point of tokenVersion-based revocation (a 30-day JWT otherwise can't be
    // invalidated short of rotating JWT_SECRET for everyone).
    const after = await request(app).get('/vehicles').set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)
  })
})
