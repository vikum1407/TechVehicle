import express from 'express'
import multer, { FileFilterCallback } from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import crypto from 'crypto'

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

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

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
    res.status(500).json({ error: 'Storage not configured' })
    return
  }

  const ext = file.mimetype === 'image/png' ? 'png' : 'jpg'
  const key = `service-photos/${req.phoneNumber}/${crypto.randomUUID()}.${ext}`

  try {
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
