import request from 'supertest'
import { app, loginAsNewUser } from '../helpers'

// Full upload-success coverage needs real Cloudflare R2 credentials, which
// .env.test deliberately doesn't have (uploading real test files to a real
// bucket on every test run isn't appropriate without that being an explicit
// choice). What's testable without them: rejecting a missing file, and the
// "storage not configured" guard itself (which the test environment's
// placeholder/missing R2 env vars naturally exercise as a side effect).
describe('Photo Uploads — what\'s testable without real R2 credentials', () => {
  it('rejects a request with no file', async () => {
    const owner = await loginAsNewUser()
    const res = await request(app)
      .post('/uploads/photo')
      .set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(400)
  })

  it('returns 503 when R2 storage isn\'t configured (the test environment\'s actual state)', async () => {
    const owner = await loginAsNewUser()
    const res = await request(app)
      .post('/uploads/photo')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'test.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(503)
  })
})
