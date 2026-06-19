import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import vehicleRoutes from './routes/vehicles'

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

app.listen(PORT, () => {
  console.log(`TechVehicle backend running on port ${PORT}`)
})
