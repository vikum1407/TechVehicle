import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import LoginScreen from './src/screens/LoginScreen'
import OTPScreen from './src/screens/OTPScreen'
import MyVehiclesScreen from './src/screens/MyVehiclesScreen'
import AddVehicleScreen from './src/screens/AddVehicleScreen'
import VehicleDashboardScreen from './src/screens/VehicleDashboardScreen'
import AddServiceRecordScreen from './src/screens/AddServiceRecordScreen'
import LogFuelScreen from './src/screens/LogFuelScreen'
import AddExpenseScreen from './src/screens/AddExpenseScreen'
import AnalyticsScreen from './src/screens/AnalyticsScreen'
import GarageScreen from './src/screens/GarageScreen'

type Screen = 'loading' | 'login' | 'otp' | 'vehicles' | 'addVehicle' | 'vehicleDashboard' | 'addServiceRecord' | 'logFuel' | 'addExpense' | 'analytics' | 'garage'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  mileage: number
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

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
    setSelectedVehicle(null)
    setScreen('login')
  }

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setScreen('vehicleDashboard')
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
          onSelectVehicle={handleSelectVehicle}
          onLogout={handleLogout}
          onGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'addVehicle' && (
        <AddVehicleScreen
          token={token}
          onVehicleAdded={() => setScreen('vehicles')}
        />
      )}
      {screen === 'vehicleDashboard' && selectedVehicle && (
        <VehicleDashboardScreen
          token={token}
          vehicle={selectedVehicle}
          onBack={() => setScreen('vehicles')}
          onAddRecord={() => setScreen('addServiceRecord')}
          onLogFuel={() => setScreen('logFuel')}
          onAddExpense={() => setScreen('addExpense')}
          onAnalytics={() => setScreen('analytics')}
        />
      )}
      {screen === 'addServiceRecord' && selectedVehicle && (
        <AddServiceRecordScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onRecordAdded={() => setScreen('vehicleDashboard')}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'logFuel' && selectedVehicle && (
        <LogFuelScreen
          token={token}
          vehicleId={selectedVehicle.id}
          currentMileage={selectedVehicle.mileage}
          onLogged={() => setScreen('vehicleDashboard')}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'garage' && (
        <GarageScreen
          token={token}
          onBack={() => setScreen('vehicles')}
        />
      )}
      {screen === 'analytics' && selectedVehicle && (
        <AnalyticsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'addExpense' && selectedVehicle && (
        <AddExpenseScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onExpenseAdded={() => setScreen('vehicleDashboard')}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
})
