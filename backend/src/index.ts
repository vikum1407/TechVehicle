import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
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
import { startRenewalReminderJob } from './jobs/renewalReminders'
import { startServiceNotificationJob } from './jobs/serviceNotifications'
import { startBookingReminderJob } from './jobs/bookingReminders'
import { startMileageReminderJob } from './jobs/mileageReminders'
import { getJwtSecret } from './utils/jwtSecret'
import { globalRateLimit } from './middleware/globalRateLimit'

dotenv.config()

// Fail fast and loud at boot if JWT_SECRET is missing/weak, rather than only
// discovering it the first time someone logs in.
getJwtSecret()

const app = express()
const PORT = process.env.PORT || 3001

// Render (and most PaaS hosts) sit behind a reverse proxy — without this, req.ip
// resolves to the proxy's address for every request, so any IP-based rate limit
// (this file's global one, and the OTP send limiter in routes/auth.ts) would key
// off one shared address instead of the real caller and could lock out everyone
// at once. Trusting one hop tells Express to read the real client IP from
// X-Forwarded-For as set by Render's proxy.
app.set('trust proxy', 1)

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(globalRateLimit)

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

app.listen(PORT, () => {
  console.log(`Vocksy backend running on port ${PORT}`)
  startRenewalReminderJob()
  startServiceNotificationJob()
  startBookingReminderJob()
  startMileageReminderJob()
})
