// Shared by the CLI script (backend/src/scripts/deleteAccount.ts) and the in-app
// "Delete my account" flow (DELETE /auth/account, Step 3.4). Spec: 02-data-model.md §10.
import { PrismaClient } from '@prisma/client'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'

// Same client shape as routes/uploads.ts's makeR2Client() — duplicated rather than
// imported since uploads.ts doesn't export it and this is the only other place that
// needs an R2 client right now.
function makeR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ keepAlive: false }) }),
  })
}

// Best effort only (spec note, 02§10) — a failed or skipped R2 delete never blocks
// account deletion. Scope is deliberately narrow: the deleted ads' photos and the
// shop logo only, not the shared User.profilePhotoUrl (that field predates Mart and
// is also used by the non-Mart app).
async function deleteR2ObjectsBestEffort(urls: string[]): Promise<{ deleted: number; failed: number }> {
  const bucket = process.env.R2_BUCKET_NAME || ''
  const publicUrl = process.env.R2_PUBLIC_URL || ''
  const isPlaceholder = (v?: string) => !v || v.startsWith('your-') || v === ''
  if (isPlaceholder(process.env.R2_ACCOUNT_ID) || isPlaceholder(bucket) || isPlaceholder(publicUrl)) {
    return { deleted: 0, failed: 0 } // storage not configured — nothing to clean up
  }

  const prefix = `${publicUrl}/`
  const keys = Array.from(new Set(urls.filter(u => u.startsWith(prefix)).map(u => u.slice(prefix.length))))
  if (keys.length === 0) return { deleted: 0, failed: 0 }

  const r2 = makeR2Client()
  let deleted = 0
  let failed = 0
  for (const key of keys) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      deleted++
    } catch (error) {
      console.error('Account deletion: R2 photo delete failed (non-fatal):', key, error)
      failed++
    }
  }
  return { deleted, failed }
}

export type DeleteAccountSummary = {
  vehicles: number
  garage: boolean
  notifications: number
  martListings: number
  r2PhotosDeleted: number
  r2PhotosFailed: number
}

// Returns null if no account exists for this phone. Order: collect everything that
// needs an R2 cleanup BEFORE deleting the DB rows that reference it, delete Mart data
// (02§10), then run the existing non-Mart deletion (vehicles/garage cascade their own
// service records, fuel logs, expenses, bookings; AppNotification; the User row).
export async function deleteUserAccount(prisma: PrismaClient, phone: string): Promise<DeleteAccountSummary | null> {
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } })
  if (!user) return null

  // ── Vocksy Mart (02-data-model.md §10) ──────────────────────────────
  const [ownedListings, shopProfile] = await Promise.all([
    prisma.martListing.findMany({ where: { ownerPhone: phone }, select: { id: true, photoUrls: true } }),
    prisma.martShopProfile.findUnique({ where: { ownerPhone: phone } }),
  ])
  const listingIds = ownedListings.map(l => l.id)
  const photosToDelete = ownedListings.flatMap(l => l.photoUrls)
  if (shopProfile?.logoUrl) photosToDelete.push(shopProfile.logoUrl)

  await prisma.martFavorite.deleteMany({ where: { userPhone: phone } })
  await prisma.martFollow.deleteMany({ where: { OR: [{ followerPhone: phone }, { sellerPhone: phone }] } })
  await prisma.martBlock.deleteMany({ where: { OR: [{ blockerPhone: phone }, { blockedPhone: phone }] } })
  await prisma.martSearchHistory.deleteMany({ where: { userPhone: phone } })
  await prisma.martShopProfile.deleteMany({ where: { ownerPhone: phone } })
  await prisma.martWantedAlert.deleteMany({ where: { OR: [{ sellerPhone: phone }, { listingId: { in: listingIds } }] } })
  await prisma.martSellerRating.deleteMany({ where: { OR: [{ raterPhone: phone }, { sellerPhone: phone }] } })
  await prisma.martThread.deleteMany({ where: { otherPhone: phone } }) // cascades MartMessage
  await prisma.martListing.deleteMany({ where: { ownerPhone: phone } }) // cascades favorites/threads/messages/ratings for these ads
  // MartReport rows are deliberately kept — reporter/target phone strings and the
  // targetTitle/targetSnippet snapshots are retained for investigation (02§10).

  const { deleted: r2PhotosDeleted, failed: r2PhotosFailed } = await deleteR2ObjectsBestEffort(photosToDelete)

  // ── Core app (existing script behavior, unchanged) ──────────────────
  const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: phone } })
  const garage = await prisma.garage.findUnique({ where: { ownerPhone: phone } })
  const notifCount = await prisma.appNotification.count({ where: { userPhone: phone } })

  for (const v of vehicles) {
    await prisma.vehicle.delete({ where: { id: v.id } })
  }
  if (garage) {
    await prisma.garage.delete({ where: { id: garage.id } })
  }
  await prisma.appNotification.deleteMany({ where: { userPhone: phone } })
  await prisma.user.delete({ where: { phoneNumber: phone } })

  return {
    vehicles: vehicles.length,
    garage: !!garage,
    notifications: notifCount,
    martListings: listingIds.length,
    r2PhotosDeleted,
    r2PhotosFailed,
  }
}
