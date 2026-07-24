// One-off script: fully wipes a single account by phone number.
// Run from backend/: npx ts-node src/scripts/deleteAccount.ts +94773574826
import { PrismaClient } from '@prisma/client'

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
  console.log('Deleting (vehicles/garage cascade their service records, fuel logs, expenses, bookings, etc.)...')

  for (const v of vehicles) {
    await prisma.vehicle.delete({ where: { id: v.id } })
  }
  if (garage) {
    await prisma.garage.delete({ where: { id: garage.id } })
  }
  await prisma.appNotification.deleteMany({ where: { userPhone: phone } })
  await prisma.user.delete({ where: { phoneNumber: phone } })

  console.log(`Done. Account ${phone} fully removed.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
