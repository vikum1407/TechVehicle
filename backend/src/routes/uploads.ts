import express from 'express'
import multer, { FileFilterCallback } from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import crypto from 'crypto'
import https from 'https'

const router = express.Router()
router.use(authMiddleware)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images are allowed'))
  },
})

// Create R2 client lazily so env vars are always fresh after .env reload
function makeR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    // Disable connection reuse to avoid TLS session issues in Codespaces
    requestHandler: new NodeHttpHandler({
      httpsAgent: new https.Agent({ keepAlive: false }),
    }),
  })
}

// POST /uploads/photo — upload a single photo, returns { url }
router.post('/photo', upload.single('photo'), async (req: AuthRequest, res) => {
  const file = (req as any).file as Express.Multer.File | undefined

  if (!file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  const bucket = process.env.R2_BUCKET_NAME || ''
  const publicUrl = process.env.R2_PUBLIC_URL || ''

  if (!bucket || !publicUrl || !process.env.R2_ACCOUNT_ID) {
    res.status(500).json({ error: 'Storage not configured — add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL to .env' })
    return
  }

  const ext = file.mimetype === 'image/png' ? 'png' : 'jpg'
  const key = `service-photos/${req.phoneNumber}/${crypto.randomUUID()}.${ext}`

  try {
    const r2 = makeR2Client()
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }))

    res.json({ url: `${publicUrl}/${key}` })
  } catch (error) {
    console.error('R2 upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

export default router
