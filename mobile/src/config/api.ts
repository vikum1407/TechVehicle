const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

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
}
