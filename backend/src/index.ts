import dotenv from 'dotenv'
import { createApp } from './app'
import { startRenewalReminderJob } from './jobs/renewalReminders'
import { startServiceNotificationJob } from './jobs/serviceNotifications'
import { startBookingReminderJob } from './jobs/bookingReminders'
import { startMileageReminderJob } from './jobs/mileageReminders'
import { getJwtSecret } from './utils/jwtSecret'

dotenv.config()

// Fail fast and loud at boot if JWT_SECRET is missing/weak, rather than only
// discovering it the first time someone logs in.
getJwtSecret()

const app = createApp()
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Vocksy backend running on port ${PORT}`)
  startRenewalReminderJob()
  startServiceNotificationJob()
  startBookingReminderJob()
  startMileageReminderJob()
})
