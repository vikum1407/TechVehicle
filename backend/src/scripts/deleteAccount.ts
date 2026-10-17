// One-off script: fully wipes a single account by phone number.
// Run from backend/: npx ts-node src/scripts/deleteAccount.ts +94773574826
// Step 3.4: the actual deletion logic now lives in utils/accountDeletion.ts, shared
// with the in-app "Delete my account" flow (DELETE /auth/account) — this script is
// just its CLI wrapper (kept for the rare manual/support use case 02-data-model.md §10
// still calls out, e.g. a deletion request made outside the app).
import { PrismaClient } from '@prisma/client'
import { deleteUserAccount } from '../utils/accountDeletion'

const prisma = new PrismaClient()

async function main() {
  const phone = process.argv[2]
  if (!phone) {
    console.error('Usage: npx ts-node src/scripts/deleteAccount.ts <phoneNumber>')
    process.exit(1)
  }

  const summary = await deleteUserAccount(prisma, phone)
  if (!summary) {
    console.log(`No user found with phone number ${phone}. Nothing to do.`)
    return
  }

  console.log(`Deleted account ${phone}:`)
  console.log(`  Vehicles: ${summary.vehicles}`)
  console.log(`  Garage: ${summary.garage ? 'yes' : 'none'}`)
  console.log(`  Notifications: ${summary.notifications}`)
  console.log(`  Mart listings: ${summary.martListings}`)
  console.log(`  R2 photos deleted: ${summary.r2PhotosDeleted}${summary.r2PhotosFailed ? ` (${summary.r2PhotosFailed} failed, non-fatal)` : ''}`)
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
