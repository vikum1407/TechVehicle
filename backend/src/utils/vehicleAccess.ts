import { PrismaClient } from '@prisma/client'

export async function canReadVehicle(prisma: PrismaClient, vehicleId: string, phoneNumber: string): Promise<boolean> {
  const owned = await prisma.vehicle.findFirst({ where: { id: vehicleId, ownerPhone: phoneNumber } })
  if (owned) return true
  const shared = await prisma.vehicleShare.findFirst({
    where: { vehicleId, sharedWithPhone: phoneNumber, status: 'active' },
  })
  return !!shared
}
