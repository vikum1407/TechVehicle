import express from 'express'
import { AuthRequest } from '../../middleware/auth'

const router = express.Router()

// Placeholder for Step 0.9 — just proves auth + the beta gate work end to end
// (done-check: non-beta phone gets 404, beta phone gets 200). Full response shape
// (displayName, district, tag, counts, etc. — see 03-api.md §2) is built in
// Milestone 1 Step 1.1, which also adds PATCH /mart/me and POST /mart/rules/accept.
router.get('/', async (req: AuthRequest, res) => {
  res.json({ ok: true })
})

export default router
