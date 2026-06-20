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
