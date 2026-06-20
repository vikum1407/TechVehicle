import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import LoginScreen from './src/screens/LoginScreen'
import OTPScreen from './src/screens/OTPScreen'
import MyVehiclesScreen from './src/screens/MyVehiclesScreen'
import AddVehicleScreen from './src/screens/AddVehicleScreen'

type Screen = 'loading' | 'login' | 'otp' | 'vehicles' | 'addVehicle'

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')

  useEffect(() => {
    AsyncStorage.multiGet(['token', 'phoneNumber']).then(([tokenEntry, phoneEntry]) => {
      const savedToken = tokenEntry[1]
      const savedPhone = phoneEntry[1]
      if (savedToken && savedPhone) {
        setToken(savedToken)
        setPhoneNumber(savedPhone)
        setScreen('vehicles')
      } else {
        setScreen('login')
      }
    })
  }, [])

  const handleOTPSent = (phone: string) => {
    setPhoneNumber(phone)
    setScreen('otp')
  }

  const handleVerified = async (authToken: string, phone: string) => {
    await AsyncStorage.multiSet([['token', authToken], ['phoneNumber', phone]])
    setToken(authToken)
    setPhoneNumber(phone)
    setScreen('vehicles')
  }

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'phoneNumber'])
    setToken('')
    setPhoneNumber('')
    setScreen('login')
  }

  if (screen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    )
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
      {screen === 'vehicles' && (
        <MyVehiclesScreen
          token={token}
          phoneNumber={phoneNumber}
          onAddVehicle={() => setScreen('addVehicle')}
          onLogout={handleLogout}
        />
      )}
      {screen === 'addVehicle' && (
        <AddVehicleScreen
          token={token}
          onVehicleAdded={() => setScreen('vehicles')}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
})
