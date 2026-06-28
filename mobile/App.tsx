import React, { useState, useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet, BackHandler, AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { registerForPushNotifications, Notifications } from './src/utils/notifications'
import { api } from './src/config/api'
import LoginScreen from './src/screens/LoginScreen'
import OTPScreen from './src/screens/OTPScreen'
import MyVehiclesScreen from './src/screens/MyVehiclesScreen'
import AddVehicleScreen from './src/screens/AddVehicleScreen'
import VehicleDashboardScreen from './src/screens/VehicleDashboardScreen'
import AddServiceRecordScreen from './src/screens/AddServiceRecordScreen'
import LogFuelScreen from './src/screens/LogFuelScreen'
import AddExpenseScreen from './src/screens/AddExpenseScreen'
import VehicleTestsScreen from './src/screens/VehicleTestsScreen'
import VehicleHistoryScreen from './src/screens/VehicleHistoryScreen'
import AnalyticsScreen from './src/screens/AnalyticsScreen'
import GarageScreen from './src/screens/GarageScreen'
import ShareScreen from './src/screens/ShareScreen'
import SellScreen from './src/screens/SellScreen'
import BookingScreen from './src/screens/BookingScreen'
import RoleSelectScreen from './src/screens/RoleSelectScreen'
import PredictionsScreen from './src/screens/PredictionsScreen'
import NotificationPrefsScreen from './src/screens/NotificationPrefsScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import OnboardingWizardScreen from './src/screens/OnboardingWizardScreen'
import KnowledgeHubScreen from './src/screens/KnowledgeHubScreen'
import BottomTabBar from './src/components/BottomTabBar'

type Screen =
  | 'loading' | 'login' | 'otp' | 'roleSelect'
  | 'vehicles' | 'garage'
  | 'addVehicle' | 'onboardingWizard' | 'vehicleDashboard' | 'addServiceRecord'
  | 'logFuel' | 'addExpense' | 'vehicleTests' | 'vehicleHistory' | 'analytics' | 'predictions' | 'share' | 'sell' | 'booking' | 'knowledgeHub'
  | 'notificationPrefs' | 'notifications'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  vehicleType?: string | null
  mileage: number
  emissionTestExpiry?: string | null
  revenueLicenceExpiry?: string | null
}

// Screens that show the bottom tab bar
const TAB_SCREENS: Screen[] = ['vehicles', 'garage']

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')
  const [userType, setUserType] = useState<'owner' | 'garage' | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesBadge, setVehiclesBadge] = useState(0)
  const [garageBadge, setGarageBadge] = useState(0)
  const [newVehicle, setNewVehicle] = useState<Vehicle | null>(null)
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null)
  const [focusVehicleBookingId, setFocusVehicleBookingId] = useState<string | null>(null)
  const [bookingSeenCounts, setBookingSeenCounts] = useState<Record<string, number>>({})
  const [notifUnreadCount, setNotifUnreadCount] = useState(0)
  const [predictionsInitialTab, setPredictionsInitialTab] = useState<'services' | 'setup'>('services')

  // Load persisted seen counts on startup
  useEffect(() => {
    SecureStore.getItemAsync('bookingSeenCounts').then(raw => {
      if (raw) {
        try { setBookingSeenCounts(JSON.parse(raw)) } catch {}
      }
    }).catch(() => {})
  }, [])

  // Persist to SecureStore whenever seen counts change
  useEffect(() => {
    if (Object.keys(bookingSeenCounts).length > 0) {
      SecureStore.setItemAsync('bookingSeenCounts', JSON.stringify(bookingSeenCounts)).catch(() => {})
    }
  }, [bookingSeenCounts])

  const handleBookingSeen = (bookingId: string, count: number) => {
    setBookingSeenCounts(prev => ({ ...prev, [bookingId]: count }))
  }

  const loadNotifCount = (authToken: string) => {
    api.getNotifUnreadCount(authToken)
      .then(({ count }) => setNotifUnreadCount(count))
      .catch(() => {})
  }

  // Refresh unread count when app comes back to foreground
  useEffect(() => {
    if (!token) return
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') loadNotifCount(token)
    })
    return () => sub.remove()
  }, [token])

  const notifListenerRef = useRef<any>(null)
  const responseListenerRef = useRef<any>(null)

  useEffect(() => {
    notifListenerRef.current = Notifications.addNotificationReceivedListener(() => {
      // foreground notifications are shown automatically via setNotificationHandler
    })
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any> | undefined
      const targetScreen = data?.screen as string | undefined
      const bookingId = data?.bookingId as string | undefined
      const vehicleId = data?.vehicleId as string | undefined

      if (targetScreen === 'garage') {
        if (bookingId) setFocusBookingId(bookingId)
        setScreen('garage')
      } else if (targetScreen === 'vehicles') {
        if (vehicleId) {
          const vehicle = vehicles.find(v => v.id === vehicleId)
          if (vehicle) {
            setSelectedVehicle(vehicle)
            setScreen('vehicleDashboard')
          } else {
            setScreen('vehicles')
          }
        } else {
          setScreen('vehicles')
        }
      } else if (targetScreen === 'predictions_setup') {
        if (vehicleId) {
          const vehicle = vehicles.find(v => v.id === vehicleId)
          if (vehicle) {
            setSelectedVehicle(vehicle)
            setPredictionsInitialTab('setup')
            setScreen('predictions')
          } else {
            setScreen('vehicles')
          }
        }
      }
    })
    return () => {
      notifListenerRef.current?.remove()
      responseListenerRef.current?.remove()
    }
  }, [])

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('token'),
      SecureStore.getItemAsync('phoneNumber'),
      SecureStore.getItemAsync('userType'),
    ]).then(([savedToken, savedPhone, savedUserType]) => {
      if (savedToken && savedPhone) {
        setToken(savedToken)
        setPhoneNumber(savedPhone)
        if (savedUserType) {
          setUserType(savedUserType as 'owner' | 'garage')
          setScreen('vehicles')
        } else {
          setScreen('roleSelect')
        }
      } else {
        setScreen('login')
      }
    })
  }, [])

  useEffect(() => {
    const backMap: Partial<Record<Screen, Screen>> = {
      otp: 'login',
      addVehicle: 'vehicles',
      vehicleDashboard: 'vehicles',
      addServiceRecord: 'vehicleDashboard',
      logFuel: 'vehicleDashboard',
      addExpense: 'vehicleDashboard',
      vehicleTests: 'vehicleDashboard',
      vehicleHistory: 'vehicleDashboard',
      analytics: 'vehicleDashboard',
      predictions: 'vehicleDashboard',
      knowledgeHub: 'vehicleDashboard',
      share: 'vehicleDashboard',
      sell: 'vehicleDashboard',
      booking: 'vehicleDashboard',
      onboardingWizard: 'vehicles',
      notificationPrefs: 'vehicles',
      notifications: 'vehicles',
    }
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const parent = backMap[screen]
      if (parent) {
        setScreen(parent)
        return true
      }
      return false
    })
    return () => handler.remove()
  }, [screen])

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
    registerPush(authToken)
    loadNotifCount(authToken)
  }

  const handleRoleSelected = async (uType: 'owner' | 'garage') => {
    await SecureStore.setItemAsync('userType', uType)
    setUserType(uType)
    setScreen('vehicles')
    registerPush(token)
    loadNotifCount(token)
  }

  const registerPush = async (authToken: string) => {
    try {
      const pushToken = await registerForPushNotifications()
      if (pushToken) {
        await api.savePushToken(authToken, pushToken)
        // Check service-due alerts now that we have a push token
        await api.triggerServiceNotifications(authToken).catch(() => {})
      }
    } catch (e) {
      // non-fatal
    }
  }

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token')
    await SecureStore.deleteItemAsync('phoneNumber')
    await SecureStore.deleteItemAsync('userType')
    await SecureStore.deleteItemAsync('bookingSeenCounts')
    setToken('')
    setPhoneNumber('')
    setUserType(null)
    setSelectedVehicle(null)
    setVehicles([])
    setBookingSeenCounts({})
    setNotifUnreadCount(0)
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

  const showTabBar = TAB_SCREENS.includes(screen)

  return (
    <>
      <StatusBar style="auto" />

      {/* ── Auth screens ─────────────────────────────────────────────── */}
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

      {/* ── Tab root screens ─────────────────────────────────────────── */}
      {showTabBar && (
        <View style={styles.tabContainer}>
          <View style={styles.tabContent}>
            {screen === 'vehicles' && (
              <MyVehiclesScreen
                token={token}
                phoneNumber={phoneNumber}
                userType={userType || 'owner'}
                onAddVehicle={() => setScreen('addVehicle')}
                onSelectVehicle={handleSelectVehicle}
                onVehiclesLoaded={setVehicles}
                onLogout={handleLogout}
                onSettings={() => setScreen('notificationPrefs')}
                notifUnread={notifUnreadCount > 0}
                onNotifPress={() => setScreen('notifications')}
              />
            )}
            {screen === 'garage' && (
              <GarageScreen
                token={token}
                focusBookingId={focusBookingId}
                onMessageCountChange={setGarageBadge}
                onFocusHandled={() => setFocusBookingId(null)}
                bookingSeenCounts={bookingSeenCounts}
                onBookingSeen={handleBookingSeen}
                notifUnread={notifUnreadCount > 0}
                onNotifPress={() => setScreen('notifications')}
                onNotifSeen={setNotifUnreadCount}
              />
            )}
          </View>
          <BottomTabBar
            activeTab={screen === 'garage' ? 'garage' : 'vehicles'}
            onTabPress={(tab) => setScreen(tab)}
            vehiclesBadge={vehiclesBadge}
            garageBadge={garageBadge}
          />
        </View>
      )}

      {/* ── Deep screens (no tab bar) ─────────────────────────────────── */}
      {screen === 'addVehicle' && (
        <AddVehicleScreen
          token={token}
          onVehicleAdded={(vehicle) => {
            setNewVehicle(vehicle)
            setScreen('onboardingWizard')
          }}
          onBack={() => setScreen('vehicles')}
        />
      )}
      {screen === 'onboardingWizard' && newVehicle && (
        <OnboardingWizardScreen
          token={token}
          vehicle={newVehicle}
          onDone={() => {
            setSelectedVehicle(newVehicle)
            setNewVehicle(null)
            setScreen('vehicleDashboard')
          }}
        />
      )}
      {screen === 'vehicleDashboard' && selectedVehicle && (
        <VehicleDashboardScreen
          token={token}
          phoneNumber={phoneNumber}
          vehicle={selectedVehicle}
          onMessageCountChange={setVehiclesBadge}
          bookingSeenCounts={bookingSeenCounts}
          onBookingSeen={handleBookingSeen}
          focusBookingId={focusVehicleBookingId}
          onFocusHandled={() => setFocusVehicleBookingId(null)}
          onNotifSeen={setNotifUnreadCount}
          notifUnread={notifUnreadCount > 0}
          onNotifications={() => setScreen('notifications')}
          onBack={() => setScreen('vehicles')}
          onAddRecord={() => setScreen('addServiceRecord')}
          onLogFuel={() => setScreen('logFuel')}
          onAddExpense={() => setScreen('addExpense')}
          onAnalytics={() => setScreen('analytics')}
          onVehicleTests={() => setScreen('vehicleTests')}
          onViewHistory={() => setScreen('vehicleHistory')}
          onPredictions={() => setScreen('predictions')}
          onKnowledgeHub={() => setScreen('knowledgeHub')}
          onMileageUpdated={(newMileage) => setSelectedVehicle(prev => prev ? { ...prev, mileage: newMileage } : prev)}
          onShare={() => setScreen('share')}
          onSell={() => setScreen('sell')}
          onBookService={() => setScreen('booking')}
        />
      )}
      {screen === 'addServiceRecord' && selectedVehicle && (
        <AddServiceRecordScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleType={selectedVehicle.vehicleType}
          currentMileage={selectedVehicle.mileage}
          onRecordAdded={() => setScreen('vehicleDashboard')}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'logFuel' && selectedVehicle && (
        <LogFuelScreen
          token={token}
          vehicleId={selectedVehicle.id}
          currentMileage={selectedVehicle.mileage}
          onLogged={(newMileage) => {
              if (newMileage > (selectedVehicle?.mileage ?? 0)) {
                setSelectedVehicle(prev => prev ? { ...prev, mileage: newMileage } : prev)
              }
              setScreen('vehicleDashboard')
            }}
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
      {screen === 'vehicleTests' && selectedVehicle && (
        <VehicleTestsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
          currentMileage={selectedVehicle.mileage}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'vehicleHistory' && selectedVehicle && (
        <VehicleHistoryScreen
          token={token}
          vehicle={selectedVehicle}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'analytics' && selectedVehicle && (
        <AnalyticsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'predictions' && selectedVehicle && (
        <PredictionsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
          currentMileage={selectedVehicle.mileage}
          initialTab={predictionsInitialTab}
          onBack={() => { setPredictionsInitialTab('services'); setScreen('vehicleDashboard') }}
        />
      )}
      {screen === 'knowledgeHub' && selectedVehicle && (
        <KnowledgeHubScreen
          token={token}
          vehicle={selectedVehicle}
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
      {screen === 'notificationPrefs' && (
        <NotificationPrefsScreen
          token={token}
          onBack={() => setScreen('vehicles')}
        />
      )}
      {screen === 'notifications' && (
        <NotificationsScreen
          token={token}
          onBack={() => setScreen('vehicles')}
          onNavigate={(linkTo) => {
            if (!linkTo) { setScreen('vehicles'); return }
            try {
              const { screen: target, vehicleId, bookingId } = JSON.parse(linkTo)
              if (target === 'garage') {
                if (bookingId) setFocusBookingId(bookingId)
                setScreen('garage'); return
              }
              if ((target === 'vehicleDashboard' || target === 'vehicles') && vehicleId) {
                const v = vehicles.find(v => v.id === vehicleId)
                if (v) {
                  setSelectedVehicle(v)
                  if (bookingId) setFocusVehicleBookingId(bookingId)
                  setScreen('vehicleDashboard'); return
                }
              }
            } catch {}
            setScreen('vehicles')
          }}
          onMarkAllRead={(seenBookingIds) => {
            setNotifUnreadCount(0)
            if (seenBookingIds.length > 0) {
              setBookingSeenCounts(prev => {
                const next = { ...prev }
                seenBookingIds.forEach(id => { next[id] = 99999 })
                return next
              })
            }
          }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  tabContainer: { flex: 1 },
  tabContent: { flex: 1 },
})
