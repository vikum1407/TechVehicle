import express from 'express'
import meRoutes from './me'
import rulesRoutes from './rules'
import listingsRoutes from './listings'
import myAdsRoutes from './myAds'
import favoritesRoutes from './favorites'
import threadsRoutes from './threads'
import shopProfileRoutes from './shopProfile'
import sellersRoutes from './sellers'
import socialRoutes from './social'
import notificationsRoutes from './notifications'

// Mounted in src/index.ts as: app.use('/mart', authMiddleware, martGate, martRouter)
// — every /mart route already has req.phoneNumber set and has passed the beta gate
// by the time it reaches here. Area routers (listings, threads, sellers, social,
// safety, notifications, wanted) are added one per Milestone 1/2 step, per
// 03-api.md §0's file list.
const martRouter = express.Router()

martRouter.use('/me', meRoutes)
martRouter.use('/rules', rulesRoutes)
martRouter.use('/listings', listingsRoutes)
martRouter.use('/my-ads', myAdsRoutes)
martRouter.use('/favorites', favoritesRoutes)
martRouter.use('/threads', threadsRoutes)
martRouter.use('/shop-profile', shopProfileRoutes)
martRouter.use('/sellers', sellersRoutes)
martRouter.use('/follows', socialRoutes)
martRouter.use('/notifications', notificationsRoutes)

export default martRouter
