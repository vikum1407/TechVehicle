// Daily production backup: pg_dump -> upload to a private R2 bucket -> keep the last 14.
// Run from backend/: npx ts-node src/scripts/dbBackupToR2.ts
// Requires env vars: NEON_DIRECT_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET_NAME
// Requires the `pg_dump` binary on PATH, matching (or newer than) the database's major version.
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

const KEEP_LAST_N = 14
const PREFIX = 'db-backups/'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const dbUrl = requireEnv('NEON_DIRECT_URL')
  const bucket = requireEnv('R2_BACKUP_BUCKET_NAME')
  const accountId = requireEnv('R2_ACCOUNT_ID')
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')

  const dateStamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const fileName = `vocksy_backup_${dateStamp}.dump`
  const localPath = path.join(os.tmpdir(), fileName)
  const key = PREFIX + fileName

  console.log(`[1/4] Running pg_dump -> ${localPath}`)
  execFileSync('pg_dump', [dbUrl, '-Fc', '-f', localPath], { stdio: 'inherit' })

  const stat = fs.statSync(localPath)
  if (stat.size === 0) {
    console.error('Backup file is empty — aborting without uploading.')
    process.exit(1)
  }
  console.log(`      Dump file size: ${(stat.size / 1024).toFixed(1)} KB`)

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  console.log(`[2/4] Uploading to r2://${bucket}/${key}`)
  const body = fs.readFileSync(localPath)
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }))

  console.log(`[3/4] Cleaning up local temp file`)
  fs.unlinkSync(localPath)

  console.log(`[4/4] Pruning old backups (keeping last ${KEEP_LAST_N})`)
  const list = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }))
  const objects = (list.Contents || [])
    .filter(o => o.Key && o.LastModified)
    .sort((a, b) => (b.LastModified as Date).getTime() - (a.LastModified as Date).getTime())

  const toDelete = objects.slice(KEEP_LAST_N)
  for (const obj of toDelete) {
    console.log(`      Deleting old backup: ${obj.Key}`)
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! }))
  }

  console.log(`Done. ${objects.length - toDelete.length} backup(s) kept, ${toDelete.length} deleted.`)
}

main().catch(err => {
  console.error('Backup failed:', err)
  process.exit(1)
})
