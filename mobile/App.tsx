import React, { useState, useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet, BackHandler, AppState, useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { storage } from './src/utils/storage'
import { registerForPushNotifications, Notifications } from './src/utils/notifications'
import { api } from './src/config/api'
import { ThemeProvider } from './src/theme/ThemeContext'
import { LanguageProvider } from './src/i18n/LanguageContext'
import LoginScreen from './src/screens/LoginScreen'
import OTPScreen from './src/screens/OTPScreen'
import MyVehiclesScreen from './src/screens/MyVehiclesScreen'
import AddVehicleScreen from './src/screens/AddVehicleScreen'
import VehicleDashboardScreen from './src/screens/VehicleDashboardScreen'
import AddServiceRecordScreen from './src/screens/AddServiceRecordScreen'
import LogFuelScreen from './src/screens/LogFuelScreen'
import TripLogScreen from './src/screens/TripLogScreen'
import AddExpenseScreen from './src/screens/AddExpenseScreen'
import VehicleTestsScreen from './src/screens/VehicleTestsScreen'
import VehicleHistoryScreen from './src/screens/VehicleHistoryScreen'
import AnalyticsScreen from './src/screens/AnalyticsScreen'
import GarageScreen from './src/screens/GarageScreen'
import GarageLedgerScreen from './src/screens/GarageLedgerScreen'
import ShareScreen from './src/screens/ShareScreen'
import SellScreen from './src/screens/SellScreen'
import BookingScreen from './src/screens/BookingScreen'
import RoleSelectScreen from './src/screens/RoleSelectScreen'
import EmailSetupScreen from './src/screens/EmailSetupScreen'
import PredictionsScreen from './src/screens/PredictionsScreen'
import NotificationPrefsScreen from './src/screens/NotificationPrefsScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import OnboardingWizardScreen from './src/screens/OnboardingWizardScreen'
import KnowledgeHubScreen from './src/screens/KnowledgeHubScreen'
import CostForecastScreen from './src/screens/CostForecastScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import BottomTabBar from './src/components/BottomTabBar'
import FloatingHomeButton from './src/components/FloatingHomeButton'

type Screen =
  | 'loading' | 'login' | 'otp' | 'roleSelect' | 'emailSetup'
  | 'vehicles' | 'garage' | 'garageLedger'
  | 'addVehicle' | 'onboardingWizard' | 'vehicleDashboard' | 'addServiceRecord'
  | 'logFuel' | 'tripLog' | 'addExpense' | 'vehicleTests' | 'vehicleHistory' | 'analytics' | 'predictions' | 'share' | 'sell' | 'booking' | 'knowledgeHub' | 'costForecast'
  | 'profile' | 'settings' | 'notificationPrefs' | 'notifications'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  vehicleType?: string | null
  mileage: number
  photoUrl?: string | null
  emissionTestExpiry?: string | null
  revenueLicenceExpiry?: string | null
  insuranceExpiry?: string | null
  insuranceCompany?: string | null
  insurancePolicyNo?: string | null
  purchaseDate?: string | null
  ownerCount?: number | null
  vehicleNotes?: string | null
  isShared?: boolean
  sharedByPhone?: string
}

// Screens that show the bottom tab bar
const TAB_SCREENS: Screen[] = ['vehicles', 'garage']

// Screens where a floating Home shortcut doesn't make sense (auth flow, or already home)
const NO_HOME_SCREENS: Screen[] = ['loading', 'login', 'otp', 'roleSelect', 'emailSetup', 'vehicles', 'garage']

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
  const [ledgerFocusVehicleId, setLedgerFocusVehicleId] = useState<string | null>(null)
  const [garageReturnTab, setGarageReturnTab] = useState<'profile' | 'customers' | 'history'>('profile')
  const [focusVehicleBookingId, setFocusVehicleBookingId] = useState<string | null>(null)
  const [bookingSeenCounts, setBookingSeenCounts] = useState<Record<string, number>>({})
  const [notifUnreadCount, setNotifUnreadCount] = useState(0)
  const [notifPrefsReturnTo, setNotifPrefsReturnTo] = useState<'notifications' | 'settings'>('notifications')
  const [hasGarage, setHasGarage] = useState(false)
  const [postEmailScreen, setPostEmailScreen] = useState<'vehicles' | 'garage'>('vehicles')
  const [addServiceReturnTo, setAddServiceReturnTo] = useState<'vehicleDashboard' | 'predictions' | 'costForecast'>('vehicleDashboard')
  const [historyEditRecordId, setHistoryEditRecordId] = useState('')
  const [historyReturnTo, setHistoryReturnTo] = useState<'vehicleDashboard' | 'predictions'>('vehicleDashboard')
  const [knowledgeHubReturnTo, setKnowledgeHubReturnTo] = useState<'vehicleDashboard' | 'analytics'>('vehicleDashboard')
  const [garageEntryFrom, setGarageEntryFrom] = useState<'tab' | 'profile'>('tab')
  const [predictionsInitialTab, setPredictionsInitialTab] = useState<'services' | 'setup'>('services')
  const [testsInitialTab, setTestsInitialTab] = useState<'emission' | 'alignment' | 'chain' | 'insurance' | 'licence'>('emission')
  const scheme = useColorScheme()

  // Load persisted seen counts on startup
  useEffect(() => {
    storage.getItemAsync('bookingSeenCounts').then(raw => {
      if (raw) {
        try { setBookingSeenCounts(JSON.parse(raw)) } catch {}
      }
    }).catch(() => {})
  }, [])

  // Persist to SecureStore whenever seen counts change
  useEffect(() => {
    if (Object.keys(bookingSeenCounts).length > 0) {
      storage.setItemAsync('bookingSeenCounts', JSON.stringify(bookingSeenCounts)).catch(() => {})
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
      } else if (targetScreen === 'vehicleDashboard') {
        if (vehicleId) {
          const vehicle = vehicles.find(v => v.id === vehicleId)
          if (vehicle) {
            setSelectedVehicle(vehicle)
            if (bookingId) setFocusVehicleBookingId(bookingId)
            setScreen('vehicleDashboard')
          } else {
            setScreen('vehicles')
          }
        } else {
          setScreen('vehicles')
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
      storage.getItemAsync('token'),
      storage.getItemAsync('phoneNumber'),
      storage.getItemAsync('userType'),
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
    if (!token) return
    api.getGarage(token).then(() => setHasGarage(true)).catch(() => setHasGarage(false))
  }, [token])

  useEffect(() => {
    const backMap: Partial<Record<Screen, Screen>> = {
      otp: 'login',
      addVehicle: 'vehicles',
      vehicleDashboard: 'vehicles',
      addServiceRecord: addServiceReturnTo,
      logFuel: 'vehicleDashboard',
      tripLog: 'vehicleDashboard',
      addExpense: 'vehicleDashboard',
      vehicleTests: 'vehicleDashboard',
      vehicleHistory: historyReturnTo,
      analytics: 'vehicleDashboard',
      predictions: 'vehicleDashboard',
      knowledgeHub: knowledgeHubReturnTo,
      share: 'vehicleDashboard',
      sell: 'vehicleDashboard',
      booking: 'vehicleDashboard',
      onboardingWizard: 'vehicles',
      costForecast: 'vehicleDashboard',
      profile: 'vehicles',
      settings: 'profile',
      notificationPrefs: notifPrefsReturnTo,
      notifications: 'vehicles',
      garageLedger: 'garage',
      ...(garageEntryFrom === 'profile' && !hasGarage ? { garage: 'profile' as Screen } : {}),
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
  }, [screen, notifPrefsReturnTo, garageEntryFrom, hasGarage, addServiceReturnTo, historyReturnTo, knowledgeHubReturnTo])

  const handleOTPSent = (phone: string) => {
    setPhoneNumber(phone)
    setScreen('otp')
  }

  const handleVerified = async (authToken: string, phone: string, uType: string | null, isNewUser: boolean) => {
    await storage.setItemAsync('token', authToken)
    await storage.setItemAsync('phoneNumber', phone)
    if (uType) {
      await storage.setItemAsync('userType', uType)
      setUserType(uType as 'owner' | 'garage')
    }
    setToken(authToken)
    setPhoneNumber(phone)
    setScreen(isNewUser ? 'roleSelect' : 'vehicles')
    registerPush(authToken)
    loadNotifCount(authToken)
  }

  const handleRoleSelected = async (uType: 'owner' | 'garage') => {
    await storage.setItemAsync('userType', uType)
    setUserType(uType)
    const dest = uType === 'garage' ? 'garage' : 'vehicles'
    setPostEmailScreen(dest)
    setScreen('emailSetup')
    registerPush(token)
    loadNotifCount(token)
  }

  const handleEmailDone = () => {
    setScreen(postEmailScreen)
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
    await storage.deleteItemAsync('token')
    await storage.deleteItemAsync('phoneNumber')
    await storage.deleteItemAsync('userType')
    await storage.deleteItemAsync('bookingSeenCounts')
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
        <ActivityIndicator size="large" color="#1d3a5f" />
      </View>
    )
  }

  const showTabBar = TAB_SCREENS.includes(screen)

  return (
    <SafeAreaProvider>
    <ThemeProvider>
    <LanguageProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

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
          onCancel={handleLogout}
        />
      )}
      {screen === 'emailSetup' && (
        <EmailSetupScreen
          token={token}
          onDone={handleEmailDone}
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
                onSettings={() => setScreen('profile')}
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
                onRegistered={() => setHasGarage(true)}
                onBack={garageEntryFrom === 'profile' ? () => setScreen('profile') : undefined}
                initialTab={garageReturnTab}
                onOpenLedger={(vehicleId) => {
                  setLedgerFocusVehicleId(vehicleId ?? null)
                  setGarageReturnTab(vehicleId ? 'customers' : 'profile')
                  setScreen('garageLedger')
                }}
              />
            )}
          </View>
          <BottomTabBar
            activeTab={screen === 'garage' ? 'garage' : 'vehicles'}
            onTabPress={(tab) => { setGarageEntryFrom('tab'); setGarageReturnTab('profile'); setScreen(tab); loadNotifCount(token) }}
            vehiclesBadge={vehiclesBadge}
            garageBadge={garageBadge}
            showGarageTab={hasGarage || screen === 'garage'}
          />
        </View>
      )}

      {/* ── Deep screens (no tab bar) ─────────────────────────────────── */}
      {screen === 'garageLedger' && (
        <GarageLedgerScreen
          token={token}
          focusVehicleId={ledgerFocusVehicleId}
          onBack={() => { setLedgerFocusVehicleId(null); setScreen('garage') }}
        />
      )}
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
          onAddRecord={() => { setAddServiceReturnTo('vehicleDashboard'); setScreen('addServiceRecord') }}
          onLogFuel={() => setScreen('logFuel')}
          onAddExpense={() => setScreen('addExpense')}
          onAnalytics={() => setScreen('analytics')}
          onVehicleTests={() => { setTestsInitialTab('emission'); setScreen('vehicleTests') }}
          onChainService={() => { setTestsInitialTab('chain'); setScreen('vehicleTests') }}
          onTripLog={() => setScreen('tripLog')}
          onViewHistory={() => { setHistoryReturnTo('vehicleDashboard'); setScreen('vehicleHistory') }}
          onPredictions={() => setScreen('predictions')}
          onKnowledgeHub={() => { setKnowledgeHubReturnTo('vehicleDashboard'); setScreen('knowledgeHub') }}
          onMileageUpdated={(newMileage) => setSelectedVehicle(prev => prev ? { ...prev, mileage: newMileage } : prev)}
          onVehicleUpdated={(updated) => {
            setSelectedVehicle(prev => prev ? { ...prev, ...updated } : prev)
            setVehicles(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v))
          }}
          onShare={() => setScreen('share')}
          onSell={() => setScreen('sell')}
          onBookService={() => setScreen('booking')}
          onCostForecast={() => setScreen('costForecast')}
        />
      )}
      {screen === 'addServiceRecord' && selectedVehicle && (
        <AddServiceRecordScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleType={selectedVehicle.vehicleType}
          currentMileage={selectedVehicle.mileage}
          onRecordAdded={() => setScreen(addServiceReturnTo)}
          onBack={() => setScreen(addServiceReturnTo)}
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
      {screen === 'tripLog' && selectedVehicle && (
        <TripLogScreen
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
          vehicleType={selectedVehicle.vehicleType}
          initialTab={testsInitialTab}
          isShared={selectedVehicle.isShared}
          insuranceExpiry={selectedVehicle.insuranceExpiry}
          insuranceCompany={selectedVehicle.insuranceCompany}
          insurancePolicyNo={selectedVehicle.insurancePolicyNo}
          revenueLicenceExpiry={selectedVehicle.revenueLicenceExpiry}
          onBack={() => { setTestsInitialTab('emission'); setScreen('vehicleDashboard') }}
        />
      )}
      {screen === 'vehicleHistory' && selectedVehicle && (
        <VehicleHistoryScreen
          token={token}
          vehicle={selectedVehicle}
          initialEditRecordId={historyEditRecordId}
          onBack={() => { setHistoryEditRecordId(''); setScreen(historyReturnTo) }}
        />
      )}
      {screen === 'analytics' && selectedVehicle && (
        <AnalyticsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          onBack={() => setScreen('vehicleDashboard')}
          onKnowledgeHub={() => { setKnowledgeHubReturnTo('analytics'); setScreen('knowledgeHub') }}
        />
      )}
      {screen === 'predictions' && selectedVehicle && (
        <PredictionsScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
          currentMileage={selectedVehicle.mileage}
          initialTab={predictionsInitialTab}
          readOnly={selectedVehicle.isShared}
          onBack={() => { setPredictionsInitialTab('services'); setScreen('vehicleDashboard') }}
          onLogNow={() => { setPredictionsInitialTab('services'); setAddServiceReturnTo('predictions'); setScreen('addServiceRecord') }}
          onEditRecord={(id) => { setHistoryEditRecordId(id); setHistoryReturnTo('predictions'); setScreen('vehicleHistory') }}
        />
      )}
      {screen === 'knowledgeHub' && selectedVehicle && (
        <KnowledgeHubScreen
          token={token}
          vehicle={selectedVehicle}
          onBack={() => setScreen(knowledgeHubReturnTo)}
        />
      )}
      {screen === 'costForecast' && selectedVehicle && (
        <CostForecastScreen
          token={token}
          vehicleId={selectedVehicle.id}
          vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
          onBack={() => setScreen('vehicleDashboard')}
          onAddService={() => { setAddServiceReturnTo('costForecast'); setScreen('addServiceRecord') }}
        />
      )}
      {screen === 'addExpense' && selectedVehicle && (
        <AddExpenseScreen
          token={token}
          vehicleId={selectedVehicle.id}
          currentMileage={selectedVehicle.mileage}
          onExpenseAdded={() => setScreen('vehicleDashboard')}
          onBack={() => setScreen('vehicleDashboard')}
        />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          token={token}
          phoneNumber={phoneNumber}
          userType={userType || 'owner'}
          onBack={() => setScreen('vehicles')}
          onSettings={() => setScreen('settings')}
          onOpenGarage={() => { setGarageEntryFrom('profile'); setScreen('garage') }}
          onLogout={handleLogout}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('profile')}
          onNotificationPrefs={() => { setNotifPrefsReturnTo('settings'); setScreen('notificationPrefs') }}
        />
      )}
      {screen === 'notificationPrefs' && (
        <NotificationPrefsScreen
          token={token}
          onBack={() => setScreen(notifPrefsReturnTo)}
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
              if (target === 'predictions_setup' && vehicleId) {
                const v = vehicles.find(v => v.id === vehicleId)
                if (v) {
                  setSelectedVehicle(v)
                  setPredictionsInitialTab('setup')
                  setScreen('predictions'); return
                }
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
          onSettings={() => { setNotifPrefsReturnTo('notifications'); setScreen('notificationPrefs') }}
        />
      )}

      {!NO_HOME_SCREENS.includes(screen) && (
        <FloatingHomeButton onPress={() => setScreen('vehicles')} />
      )}
    </LanguageProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  tabContainer: { flex: 1 },
  tabContent: { flex: 1 },
})
