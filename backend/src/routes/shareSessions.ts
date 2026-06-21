import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// POST /share-sessions — owner creates a share
router.post('/', async (req: AuthRequest, res) => {
  const { vehicleId, garageId, recordIds } = req.body
  if (!vehicleId || !garageId || !Array.isArray(recordIds) || recordIds.length === 0) {
    res.status(400).json({ error: 'vehicleId, garageId and at least one recordId are required' })
    return
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const garage = await prisma.garage.findUnique({ where: { id: garageId } })
    if (!garage) { res.status(404).json({ error: 'Garage not found' }); return }

    const session = await prisma.shareSession.create({
      data: {
        vehicleId,
        garageId,
        ownerPhone: req.phoneNumber!,
        sharedRecordIds: JSON.stringify(recordIds),
        status: 'active',
      },
      include: { garage: true, vehicle: true },
    })
    res.status(201).json(session)
  } catch (error) {
    console.error('POST /share-sessions error:', error)
    res.status(500).json({ error: 'Failed to create share session' })
  }
})

// GET /share-sessions/vehicle/:vehicleId — owner sees active shares for a vehicle
router.get('/vehicle/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const sessions = await prisma.shareSession.findMany({
      where: { vehicleId },
      include: { garage: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(sessions)
  } catch (error) {
    console.error('GET /share-sessions/vehicle error:', error)
    res.status(500).json({ error: 'Failed to fetch share sessions' })
  }
})

// GET /share-sessions/incoming — garage sees shares sent to them
router.get('/incoming', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({
      where: { ownerPhone: req.phoneNumber! },
    })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }

    const sessions = await prisma.shareSession.findMany({
      where: { garageId: garage.id, status: 'active' },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    })

    // For each session, fetch the actual shared records
    const withRecords = await Promise.all(sessions.map(async session => {
      const recordIds: string[] = JSON.parse(session.sharedRecordIds)
      const records = await prisma.serviceRecord.findMany({
        where: { id: { in: recordIds } },
        orderBy: { date: 'desc' },
      })
      return { ...session, records }
    }))

    res.json(withRecords)
  } catch (error) {
    console.error('GET /share-sessions/incoming error:', error)
    res.status(500).json({ error: 'Failed to fetch incoming shares' })
  }
})

// DELETE /share-sessions/:id — owner revokes a share
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  try {
    const session = await prisma.shareSession.findFirst({
      where: { id, ownerPhone: req.phoneNumber! },
    })
    if (!session) { res.status(404).json({ error: 'Share session not found' }); return }

    await prisma.shareSession.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('DELETE /share-sessions error:', error)
    res.status(500).json({ error: 'Failed to revoke share' })
  }
})

export default router
