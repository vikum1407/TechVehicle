import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/auth'
import vehicleRoutes from './routes/vehicles'
import serviceRecordRoutes from './routes/serviceRecords'
import fuelLogRoutes from './routes/fuelLogs'
import expenseRoutes from './routes/expenses'
import analyticsRoutes from './routes/analytics'
import garageRoutes from './routes/garages'
import shareSessionRoutes from './routes/shareSessions'
import serviceSubmissionRoutes from './routes/serviceSubmissions'
import transferRoutes from './routes/transfers'
import availabilityRoutes from './routes/availability'
import bookingRoutes from './routes/bookings'
import predictionRoutes from './routes/predictions'
import notificationRoutes from './routes/notifications'
import uploadRoutes from './routes/uploads'
import vehicleKnowledgeRoutes from './routes/vehicleKnowledge'
import serviceCategoryRoutes from './routes/serviceCategories'
import vehicleShareRoutes from './routes/vehicleShares'
import adminRoutes from './routes/admin'
import { globalRateLimit } from './middleware/globalRateLimit'
import { PrismaClient } from '@prisma/client'

const errorLogPrisma = new PrismaClient()

// Pure app construction - no .listen(), no cron jobs. Split out of index.ts so
// tests can import this app and drive it with supertest without starting a real
// server/port or the background jobs. index.ts remains the actual production
// entrypoint (app.listen() + cron jobs) and is unchanged in behavior.
export function createApp() {
  const app = express()

  // Render (and most PaaS hosts) sit behind a reverse proxy — without this, req.ip
  // resolves to the proxy's address for every request, so any IP-based rate limit
  // (globalRateLimit here, and the OTP send limiter in routes/auth.ts) would key
  // off one shared address instead of the real caller and could lock out everyone
  // at once. Trusting one hop tells Express to read the real client IP from
  // X-Forwarded-For as set by Render's proxy.
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors())
  app.use(express.json())
  app.use(globalRateLimit)

  // Admin panel (2026-10-26): fire-and-forget 5xx logging for M9 (app health). Route
  // is always the matched PATTERN (e.g. "/vehicles/:id"), captured on 'finish' once
  // Express has resolved req.route - never the real URL, and never any request body,
  // query string, phone number, or token.
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 500) return
      const route = `${req.baseUrl || ''}${req.route?.path || ''}` || 'unknown'
      errorLogPrisma.apiErrorLog.create({
        data: { method: req.method, route, status: res.statusCode },
      }).catch(e => console.error('ApiErrorLog write failed (non-fatal):', e))
    })
    next()
  })

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Vocksy API is running',
      timestamp: new Date().toISOString()
    })
  })

  app.use('/auth', authRoutes)
  app.use('/vehicles', vehicleRoutes)
  app.use('/service-records', serviceRecordRoutes)
  app.use('/fuel-logs', fuelLogRoutes)
  app.use('/expenses', expenseRoutes)
  app.use('/analytics', analyticsRoutes)
  app.use('/garages', garageRoutes)
  app.use('/share-sessions', shareSessionRoutes)
  app.use('/service-submissions', serviceSubmissionRoutes)
  app.use('/transfers', transferRoutes)
  app.use('/availability', availabilityRoutes)
  app.use('/bookings', bookingRoutes)
  app.use('/predictions', predictionRoutes)
  app.use('/notifications', notificationRoutes)
  app.use('/uploads', uploadRoutes)
  app.use('/vehicle-knowledge', vehicleKnowledgeRoutes)
  app.use('/service-categories', serviceCategoryRoutes)
  app.use('/vehicle-shares', vehicleShareRoutes)
  app.use('/admin', adminRoutes)

  // Admin panel (2026-10-26): catches anything that escapes a route's own try/catch
  // (every route already has one - see CLAUDE.md's error-handling practice note).
  // This is a last resort, not a replacement for those - routes that already handle
  // their own errors are unaffected and keep returning exactly what they did before.
  // Must be registered last and take 4 args for Express to treat it as an error handler.
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err)
    if (res.headersSent) { next(err); return }
    res.status(500).json({ error: 'Something went wrong' })
  })

  return app
}
