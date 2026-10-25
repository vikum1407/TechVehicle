// One-off script: immediately hard-deletes a single account by phone number,
// bypassing the normal 14-day grace period (use for a manual/urgent request).
// Run from backend/: npx ts-node src/scripts/deleteAccount.ts +94773574826
import { PrismaClient } from '@prisma/client'
import { hardDeleteAccount } from '../utils/accountDeletion'

const prisma = new PrismaClient()

async function main() {
  const phone = process.argv[2]
  if (!phone) {
    console.error('Usage: npx ts-node src/scripts/deleteAccount.ts <phoneNumber>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } })
  if (!user) {
    console.log(`No user found with phone number ${phone}. Nothing to do.`)
    return
  }

  const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: phone } })
  const garage = await prisma.garage.findUnique({ where: { ownerPhone: phone } })
  const notifCount = await prisma.appNotification.count({ where: { userPhone: phone } })

  console.log(`Found account for ${phone}:`)
  console.log(`  Vehicles: ${vehicles.length} (${vehicles.map(v => v.registrationNo).join(', ') || 'none'})`)
  console.log(`  Garage: ${garage ? garage.name : 'none'}`)
  console.log(`  Notifications: ${notifCount}`)
  console.log('Deleting (own exclusive data removed; any Booking/BookingNote shared with another party is kept, anonymized)...')

  await hardDeleteAccount(prisma, phone)

  console.log(`Done. Account ${phone} fully removed.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
