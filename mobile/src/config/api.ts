const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

export const api = {
  sendOTP: async (phoneNumber: string) => {
    const res = await fetch(`${API_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP')
    return data
  },

  verifyOTP: async (phoneNumber: string, otp: string) => {
    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, otp }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to verify OTP')
    return data
  },

  setUserType: async (token: string, userType: 'owner' | 'garage') => {
    const res = await fetch(`${API_URL}/auth/user-type`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ userType }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to set user type')
    return data
  },

  getVehicles: async (token: string) => {
    const res = await fetch(`${API_URL}/vehicles`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch vehicles')
    return data
  },

  addVehicle: async (token: string, vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    fuelType: string
    mileage: number
  }) => {
    const res = await fetch(`${API_URL}/vehicles`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(vehicle),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add vehicle')
    return data
  },

  getServiceRecords: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/service-records/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch service records')
    return data
  },

  getGarage: async (token: string) => {
    const res = await fetch(`${API_URL}/garages/me`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch garage')
    return data
  },

  registerGarage: async (token: string, garage: { name: string; address?: string; brNumber?: string }) => {
    const res = await fetch(`${API_URL}/garages/register`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(garage),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to register garage')
    return data
  },

  updateGarage: async (token: string, garage: { name: string; address?: string; brNumber?: string }) => {
    const res = await fetch(`${API_URL}/garages/me`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(garage),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update garage')
    return data
  },

  searchGarages: async (token: string, name: string) => {
    const res = await fetch(`${API_URL}/garages/search?name=${encodeURIComponent(name)}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to search garages')
    return data
  },

  createShare: async (token: string, payload: { vehicleId: string; garageId: string; recordIds: string[] }) => {
    const res = await fetch(`${API_URL}/share-sessions`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create share')
    return data
  },

  getVehicleShares: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/share-sessions/vehicle/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch shares')
    return data
  },

  getIncomingShares: async (token: string) => {
    const res = await fetch(`${API_URL}/share-sessions/incoming`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch incoming shares')
    return data
  },

  revokeShare: async (token: string, sessionId: string) => {
    const res = await fetch(`${API_URL}/share-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to revoke share')
    return data
  },

  getAnalytics: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/analytics/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics')
    return data
  },

  getExpenses: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/expenses/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch expenses')
    return data
  },

  addExpense: async (token: string, vehicleId: string, expense: {
    date: string
    category: string
    amount: number
    description?: string
    mileage?: number
    notes?: string
  }) => {
    const res = await fetch(`${API_URL}/expenses/${vehicleId}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(expense),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add expense')
    return data
  },

  initiateTransfer: async (token: string, vehicleId: string, buyerPhone: string) => {
    const res = await fetch(`${API_URL}/transfers`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ vehicleId, buyerPhone }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to initiate transfer')
    return data
  },

  getIncomingTransfers: async (token: string) => {
    const res = await fetch(`${API_URL}/transfers/incoming`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch transfers')
    return data
  },

  getVehicleTransfer: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/transfers/vehicle/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch transfer')
    return data
  },

  acceptTransfer: async (token: string, transferId: string) => {
    const res = await fetch(`${API_URL}/transfers/${transferId}/accept`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to accept transfer')
    return data
  },

  getTransferRecords: async (token: string, transferId: string) => {
    const res = await fetch(`${API_URL}/transfers/${transferId}/records`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch records')
    return data
  },

  cancelTransfer: async (token: string, transferId: string) => {
    const res = await fetch(`${API_URL}/transfers/${transferId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to cancel transfer')
    return data
  },

  getFuelLogs: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/fuel-logs/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch fuel logs')
    return data
  },

  addFuelLog: async (token: string, vehicleId: string, log: {
    date: string
    mileage: number
    litres?: number
    cost?: number
    fullTank?: boolean
    station?: string
  }) => {
    const res = await fetch(`${API_URL}/fuel-logs/${vehicleId}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(log),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to log fuel')
    return data
  },

  submitService: async (token: string, payload: {
    shareSessionId?: string
    bookingId?: string
    vehicleId: string
    description: string
    parts?: string
    brand?: string
    cost?: number
    notes?: string
  }) => {
    const res = await fetch(`${API_URL}/service-submissions`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to submit service')
    return data
  },

  getVehicleSubmissions: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/service-submissions/vehicle/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch submissions')
    return data
  },

  acceptSubmission: async (token: string, submissionId: string) => {
    const res = await fetch(`${API_URL}/service-submissions/${submissionId}/accept`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to accept submission')
    return data
  },

  getAvailabilityDates: async (token: string, garageId: string, days?: number) => {
    const q = days ? `?days=${days}` : ''
    const res = await fetch(`${API_URL}/availability/${garageId}/dates${q}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch dates')
    return data
  },

  setAvailability: async (token: string, workDays: number[], maxPerDay: number, timeSlots: string[]) => {
    const res = await fetch(`${API_URL}/availability`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ workDays, maxPerDay, timeSlots }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to set availability')
    return data
  },

  getGarageAvailability: async (token: string, garageId: string) => {
    const res = await fetch(`${API_URL}/availability/${garageId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch availability')
    return data
  },

  getCalendarOverrides: async (token: string, garageId: string, month: string) => {
    const res = await fetch(`${API_URL}/availability/${garageId}/overrides?month=${month}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch overrides')
    return data
  },

  setCalendarOverride: async (token: string, override: {
    date: string
    status: string
    maxSlots?: number | null
    message?: string
    messageColor?: string
  }) => {
    const res = await fetch(`${API_URL}/availability/override`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(override),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to set override')
    return data
  },

  deleteCalendarOverride: async (token: string, date: string) => {
    const res = await fetch(`${API_URL}/availability/override`, {
      method: 'DELETE',
      headers: authHeaders(token),
      body: JSON.stringify({ date }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to remove override')
    return data
  },

  createBooking: async (token: string, payload: {
    vehicleId: string
    garageId: string
    date: string
    slotLabel?: string
    notes?: string
    noteType?: string
    shareSessionId?: string
  }) => {
    const res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create booking')
    return data
  },

  getMyBookings: async (token: string) => {
    const res = await fetch(`${API_URL}/bookings/mine`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings')
    return data
  },

  getGarageBookings: async (token: string) => {
    const res = await fetch(`${API_URL}/bookings/garage`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings')
    return data
  },

  confirmBooking: async (token: string, bookingId: string) => {
    const res = await fetch(`${API_URL}/bookings/${bookingId}/confirm`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to confirm booking')
    return data
  },

  cancelBooking: async (token: string, bookingId: string) => {
    const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to cancel booking')
    return data
  },

  getPredictions: async (token: string, vehicleId: string) => {
    const res = await fetch(`${API_URL}/predictions/${vehicleId}`, {
      headers: authHeaders(token),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch predictions')
    return data
  },

  savePushToken: async (token: string, pushToken: string) => {
    const res = await fetch(`${API_URL}/auth/push-token`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ pushToken }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save push token')
    return data
  },

  addServiceRecord: async (token: string, vehicleId: string, record: {
    date: string
    description: string
    mileage?: number
    parts?: string
    brand?: string
    cost?: number
    notes?: string
  }) => {
    const res = await fetch(`${API_URL}/service-records/${vehicleId}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(record),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add service record')
    return data
  },
}
