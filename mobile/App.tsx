import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import LoginScreen from './src/screens/LoginScreen'
import OTPScreen from './src/screens/OTPScreen'
import HomeScreen from './src/screens/HomeScreen'

type Screen = 'login' | 'otp' | 'home'

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')

  const handleOTPSent = (phone: string) => {
    setPhoneNumber(phone)
    setScreen('otp')
  }

  const handleVerified = (authToken: string, phone: string) => {
    setToken(authToken)
    setPhoneNumber(phone)
    setScreen('home')
  }

  const handleLogout = () => {
    setToken('')
    setPhoneNumber('')
    setScreen('login')
  }

  return (
    <>
      <StatusBar style="auto" />
      {screen === 'login' && (
        <LoginScreen onOTPSent={handleOTPSent} />
      )}
      {screen === 'otp' && (
        <OTPScreen
          phoneNumber={phoneNumber}
          onVerified={handleVerified}
          onBack={() => setScreen('login')}
        />
      )}
      {screen === 'home' && (
        <HomeScreen phoneNumber={phoneNumber} onLogout={handleLogout} />
      )}
    </>
  )
}
