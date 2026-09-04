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

// The client-supplied mimetype/field above is just a request header the caller can set
// to anything — it does not reflect what's actually in the file bytes. Before trusting a
// file as "an image" (and picking its stored extension/content-type from that), sniff the
// real file signature so someone can't upload arbitrary content labelled as an image.
type DetectedImage = { ext: 'jpg' | 'png' | 'webp' | 'gif'; contentType: string }

function detectImageType(buf: Buffer): DetectedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' }
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  if (buf.length >= 6 && buf.toString('ascii', 0, 3) === 'GIF' && (buf.toString('ascii', 3, 6) === '87a' || buf.toString('ascii', 3, 6) === '89a')) {
    return { ext: 'gif', contentType: 'image/gif' }
  }
  return null
}

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

  const isPlaceholder = (v?: string) => !v || v.startsWith('your-') || v === ''
  if (isPlaceholder(process.env.R2_ACCOUNT_ID) || isPlaceholder(bucket) || isPlaceholder(publicUrl) || isPlaceholder(process.env.R2_ACCESS_KEY_ID) || isPlaceholder(process.env.R2_SECRET_ACCESS_KEY)) {
    res.status(503).json({ error: 'Photo storage not configured — set real Cloudflare R2 credentials in .env to enable photo upload.' })
    return
  }

  const detected = detectImageType(file.buffer)
  if (!detected) {
    res.status(400).json({ error: 'File content does not match a supported image format (JPEG, PNG, WebP, GIF).' })
    return
  }

  // Hash the phone number so the owner's PII is not embedded in the public URL path.
  const phoneHash = crypto.createHash('sha256').update(req.phoneNumber!).digest('hex').slice(0, 16)
  const key = `service-photos/${phoneHash}/${crypto.randomUUID()}.${detected.ext}`

  try {
    const r2 = makeR2Client()
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: detected.contentType,
    }))

    res.json({ url: `${publicUrl}/${key}` })
  } catch (error) {
    console.error('R2 upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

export default router
