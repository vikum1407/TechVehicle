import express from 'express'
import meRoutes from './me'

// Mounted in src/index.ts as: app.use('/mart', authMiddleware, martGate, martRouter)
// — every /mart route already has req.phoneNumber set and has passed the beta gate
// by the time it reaches here. Area routers (listings, threads, sellers, social,
// safety, notifications, wanted) are added one per Milestone 1/2 step, per
// 03-api.md §0's file list.
const martRouter = express.Router()

martRouter.use('/me', meRoutes)

export default martRouter
