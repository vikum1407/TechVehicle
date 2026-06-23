import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import * as SecureStore from 'expo-secure-store'
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
import ShareScreen from './src/screens/ShareScreen'
import SellScreen from './src/screens/SellScreen'
import BookingScreen from './src/screens/BookingScreen'
import RoleSelectScreen from './src/screens/RoleSelectScreen'
import FindGarageScreen from './src/screens/FindGarageScreen'

type Screen = 'loading' | 'login' | 'otp' | 'roleSelect' | 'vehicles' | 'addVehicle' | 'vehicleDashboard' | 'addServiceRecord' | 'logFuel' | 'addExpense' | 'analytics' | 'garage' | 'findGarage' | 'share' | 'sell' | 'booking'

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
  const [userType, setUserType] = useState<'owner' | 'garage' | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('token'),
      SecureStore.getItemAsync('phoneNumber'),
      SecureStore.getItemAsync('userType'),
    ]).then(([savedToken, savedPhone, savedUserType]) => {
      if (savedToken && savedPhone) {
        setToken(savedToken)
        setPhoneNumber(savedPhone)
        if (savedUserType) setUserType(savedUserType as 'owner' | 'garage')
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

  const handleVerified = async (authToken: string, phone: string, uType: string | null, isNewUser: boolean) => {
    await SecureStore.setItemAsync('token', authToken)
    await SecureStore.setItemAsync('phoneNumber', phone)
    if (uType) {
      await SecureStore.setItemAsync('userType', uType)
      setUserType(uType as 'owner' | 'garage')
    }
    setToken(authToken)
    setPhoneNumber(phone)
    setScreen(isNewUser ? 'roleSelect' : 'vehicles')
  }

  const handleRoleSelected = async (uType: 'owner' | 'garage') => {
    await SecureStore.setItemAsync('userType', uType)
    setUserType(uType)
    setScreen('vehicles')
  }

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token')
    await SecureStore.deleteItemAsync('phoneNumber')
    await SecureStore.deleteItemAsync('userType')
    setToken('')
    setPhoneNumber('')
    setUserType(null)
    setSelectedVehicle(null)
    setVehicles([])
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
      {screen === 'roleSelect' && (
        <RoleSelectScreen
          token={token}
          onSelected={handleRoleSelected}
        />
      )}
      {screen === 'vehicles' && (
        <MyVehiclesScreen
          token={token}
          phoneNumber={phoneNumber}
          userType={userType || 'owner'}
          onAddVehicle={() => setScreen('addVehicle')}
          onSelectVehicle={handleSelectVehicle}
          onVehiclesLoaded={setVehicles}
          onLogout={handleLogout}
          onGarage={() => setScreen(userType === 'garage' ? 'garage' : 'findGarage')}
        />
      )}
      {screen === 'findGarage' && (
        <FindGarageScreen
          token={token}
          vehicles={vehicles}
          onBack={() => setScreen('vehicles')}
          onBookGarage={(garage, vehicle) => {
            setSelectedVehicle(vehicle)
            setScreen('booking')
          }}
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
          onShare={() => setScreen('share')}
          onSell={() => setScreen('sell')}
          onBookService={() => setScreen('booking')}
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
      {screen === 'share' && selectedVehicle && (
        <ShareScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onBack={() => setScreen('vehicleDashboard')}
          onShared={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'garage' && (
        <GarageScreen
          token={token}
          onBack={() => setScreen('vehicles')}
        />
      )}
      {screen === 'sell' && selectedVehicle && (
        <SellScreen
          token={token}
          vehicle={selectedVehicle}
          onBack={() => setScreen('vehicleDashboard')}
          onTransferInitiated={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'booking' && selectedVehicle && (
        <BookingScreen
          token={token}
          vehicle={selectedVehicle}
          onBack={() => setScreen('vehicleDashboard')}
          onBooked={() => setScreen('vehicleDashboard')}
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
