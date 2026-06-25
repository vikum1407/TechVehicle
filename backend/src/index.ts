import express from 'express'
import cors from 'cors'
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

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TechVehicle API is running',
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

app.listen(PORT, () => {
  console.log(`TechVehicle backend running on port ${PORT}`)
})
