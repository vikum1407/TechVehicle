import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /garages/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({
      where: { ownerPhone: req.phoneNumber! },
    })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }
    res.json(garage)
  } catch (error) {
    console.error('GET /garages/me error:', error)
    res.status(500).json({ error: 'Failed to fetch garage' })
  }
})

// POST /garages/register
router.post('/register', async (req: AuthRequest, res) => {
  const { name, address, brNumber } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Garage name is required' }); return
  }
  try {
    const existing = await prisma.garage.findUnique({
      where: { ownerPhone: req.phoneNumber! },
    })
    if (existing) { res.status(409).json({ error: 'You already have a registered garage' }); return }

    const garage = await prisma.garage.create({
      data: {
        ownerPhone: req.phoneNumber!,
        name: name.trim(),
        address: address?.trim() || null,
        brNumber: brNumber?.trim() || null,
        verified: false,
      },
    })
    res.status(201).json(garage)
  } catch (error) {
    console.error('POST /garages/register error:', error)
    res.status(500).json({ error: 'Failed to register garage' })
  }
})

// PUT /garages/me
router.put('/me', async (req: AuthRequest, res) => {
  const { name, address, brNumber } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Garage name is required' }); return
  }
  try {
    const garage = await prisma.garage.update({
      where: { ownerPhone: req.phoneNumber! },
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        brNumber: brNumber?.trim() || null,
      },
    })
    res.json(garage)
  } catch (error) {
    console.error('PUT /garages/me error:', error)
    res.status(500).json({ error: 'Failed to update garage' })
  }
})

export default router
