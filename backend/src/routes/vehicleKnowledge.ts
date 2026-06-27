import express from 'express'
import { VEHICLE_KNOWLEDGE, findBestMatch } from '../data/vehicleKnowledge'

const router = express.Router()

// GET /vehicle-knowledge — all specs (for search)
router.get('/', (_req, res) => {
  res.json(VEHICLE_KNOWLEDGE)
})

// GET /vehicle-knowledge/match?make=Toyota&model=Prius&year=2012
router.get('/match', (req, res) => {
  const { make, model, year } = req.query as Record<string, string>
  if (!make || !model) {
    res.status(400).json({ error: 'make and model are required' })
    return
  }
  const spec = findBestMatch(make, model, year ? parseInt(year) : undefined)
  if (!spec) {
    res.status(404).json({ error: 'No spec found for this vehicle' })
    return
  }
  res.json(spec)
})

export default router
