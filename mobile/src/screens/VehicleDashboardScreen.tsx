import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput,
  Image, ImageBackground, Modal, FlatList, Dimensions, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import { VEHICLE_TYPE_OPTIONS } from '../constants/serviceData'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../components/ScreenHeader'

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

const CHAIN_VEHICLE_TYPES = new Set(['motorcycle', 'electric-cycle', 'three-wheeler'])


type TopPrediction = {
  id: string
  name: string
  status: 'overdue' | 'due_soon'
  remainingKm: number | null
  remainingDays: number | null
}

type Props = {
  token: string
  phoneNumber: string
  vehicle: Vehicle
  onBack: () => void
  onVehicleUpdated?: (vehicle: Vehicle) => void
  onAddRecord: () => void
  onLogFuel: () => void
  onAddExpense: () => void
  onAnalytics: () => void
  onVehicleTests: () => void
  onChainService?: () => void
  onTripLog?: () => void
  onPredictions: () => void
  onKnowledgeHub: () => void
  onMileageUpdated: (newMileage: number) => void
  onShare: () => void
  onSell: () => void
  onBookService: () => void
  onViewHistory: () => void
  onCostForecast?: () => void
  onMessageCountChange?: (count: number) => void
  bookingSeenCounts?: Record<string, number>
  onBookingSeen?: (bookingId: string, count: number) => void
  focusBookingId?: string | null
  onFocusHandled?: () => void
  onNotifSeen?: (newCount: number) => void
  notifUnread?: boolean
  onNotifications?: () => void
}

type OwnerBooking = {
  id: string
  date: string
  status: string
  slotLabel: string | null
  notes: string | null
  noteType: string | null
  serviceType: string | null
  counterDate: string | null
  counterSlot: string | null
  garage: { id: string; name: string; verified: boolean }
  _count?: { bookingNotes: number }
}

type PendingTransfer = {
  id: string
  buyerPhone: string
  createdAt: string
}

type Submission = {
  id: string
  description: string
  parts: string | null
  brand: string | null
  mileage: number | null
  cost: number | null
  notes: string | null
  photos: string[]
  createdAt: string
  bookingId: string | null
  garage: { name: string; verified: boolean } | null
  submittedByPhone: string | null
}

type BookingNote = {
  id: string
  senderPhone: string
  message: string
  createdAt: string
}

type MiniAnalytics = {
  mileageTrend: { mileage: number; label: string }[]
  fuelEfficiencyTrend: { kmPerL: number; label: string }[]
  avgFuelEfficiency: number | null
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ data, color, gradId }: {
  data: number[]
  color: string
  gradId: string
}) {
  if (data.length < 2) return <View style={{ height: 52 }} />

  const W = 140, H = 52
  const pL = 2, pR = 2, pT = 4, pB = 4
  const plotW = W - pL - pR, plotH = H - pT - pB

  const minV = Math.min(...data), maxV = Math.max(...data)
  const range = maxV - minV || 1

  const px = (i: number) => pL + (i / (data.length - 1)) * plotW
  const py = (v: number) => pT + plotH - ((v - minV) / range) * plotH
  const pts = data.map((v, i) => ({ x: px(i), y: py(v) }))

  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    linePath += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  const fillPath = linePath + ` L ${pts[pts.length - 1].x} ${pT + plotH} L ${pts[0].x} ${pT + plotH} Z`

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function getTrend(data: number[], higherIsBetter: boolean) {
  if (data.length < 2) return { arrow: '→', label: 'Not enough data', color: '#aaa' }
  const first = data[0], last = data[data.length - 1]
  const pct = ((last - first) / (Math.abs(first) || 1)) * 100
  if (pct > 3) return { arrow: '↑', label: 'Increasing', color: higherIsBetter ? '#34a853' : '#e65100' }
  if (pct < -3) return { arrow: '↓', label: 'Declining', color: higherIsBetter ? '#e65100' : '#34a853' }
  return { arrow: '→', label: 'Stable', color: '#888' }
}

function getExpiryAlert(dateStr: string | null | undefined): { daysLeft: number; urgency: 'expired' | 'critical' | 'warning' } | null {
  if (!dateStr) return null
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (days < -60) return null // expired too long ago — already past caring
  if (days < 0)  return { daysLeft: days, urgency: 'expired' }
  if (days <= 7)  return { daysLeft: days, urgency: 'critical' }
  if (days <= 30) return { daysLeft: days, urgency: 'warning' }
  return null
}

function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
  if (days === 0) return 'Expires today!'
  return `Expires in ${days} day${days !== 1 ? 's' : ''}`
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VehicleDashboardScreen({ token, phoneNumber, vehicle, onBack, onVehicleUpdated, onAddRecord, onLogFuel, onAddExpense, onAnalytics, onVehicleTests, onChainService, onTripLog, onPredictions, onKnowledgeHub, onMileageUpdated, onShare, onSell, onBookService, onViewHistory, onCostForecast, onMessageCountChange, bookingSeenCounts = {}, onBookingSeen, focusBookingId, onFocusHandled, onNotifSeen, notifUnread, onNotifications }: Props) {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [ratingPrompt, setRatingPrompt] = useState<{ submissionId: string; garageName: string } | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null)
  const [cancellingTransfer, setCancellingTransfer] = useState(false)
  const [miniAnalytics, setMiniAnalytics] = useState<MiniAnalytics | null>(null)
  const [topPredictions, setTopPredictions] = useState<TopPrediction[]>([])
  const [editingMileage, setEditingMileage] = useState(false)
  const [mileageInput, setMileageInput] = useState('')
  const [savingMileage, setSavingMileage] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [bookingNotes, setBookingNotes] = useState<Record<string, BookingNote[]>>({})
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({})
  const [sendingMessage, setSendingMessage] = useState<string | null>(null)
  const [loadingNotes, setLoadingNotes] = useState<Set<string>>(new Set())
  const [myBookings, setMyBookings] = useState<OwnerBooking[]>([])
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(vehicle.photoUrl ?? null)
  const [uploadingVehiclePhoto, setUploadingVehiclePhoto] = useState(false)
  const [vehicleProgress, setVehicleProgress] = useState<{ score: number; items: { id: string; label: string; done: boolean; hint: string }[] } | null>(null)
  const [editVehicleModal, setEditVehicleModal] = useState(false)
  const [moreActionsSheet, setMoreActionsSheet] = useState(false)
  const [familyShareModal, setFamilyShareModal] = useState(false)
  const updatePulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(updatePulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(updatePulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const mileageUpdateBorderColor = updatePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(227,160,8,0.25)', 'rgba(227,160,8,1)'],
  })
  const [draftVehicle, setDraftVehicle] = useState({ make: vehicle.make, model: vehicle.model, year: vehicle.year.toString(), fuelType: vehicle.fuelType, vehicleType: vehicle.vehicleType ?? '', purchaseDate: vehicle.purchaseDate ? new Date(vehicle.purchaseDate).toLocaleDateString('en-GB').split('/').reverse().join('-') : '', ownerCount: vehicle.ownerCount?.toString() ?? '', vehicleNotes: vehicle.vehicleNotes ?? '', insuranceCompany: vehicle.insuranceCompany ?? '', insurancePolicyNo: vehicle.insurancePolicyNo ?? '', insuranceExpiry: vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toISOString().split('T')[0] : '', emissionTestExpiry: vehicle.emissionTestExpiry ? new Date(vehicle.emissionTestExpiry).toISOString().split('T')[0] : '', revenueLicenceExpiry: vehicle.revenueLicenceExpiry ? new Date(vehicle.revenueLicenceExpiry).toISOString().split('T')[0] : '' })
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number; label: string } | null>(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const photoViewerRef = useRef<FlatList<string>>(null)
  const [vehicleShares, setVehicleShares] = useState<{ id: string; sharedWithPhone: string; status: string }[]>([])
  const [shareInput, setShareInput] = useState('')
  const [sharingAccess, setSharingAccess] = useState(false)
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null)
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const openPhotos = (photos: string[], idx: number, label: string) => { setPhotoViewer({ photos, index: idx, label }); setPhotoViewerIndex(idx) }

  const handleSaveVehicle = async () => {
    if (!draftVehicle.make.trim() || !draftVehicle.model.trim() || !draftVehicle.year || !draftVehicle.fuelType) {
      Alert.alert('Required', 'Make, model, year, and fuel type are required.')
      return
    }
    setSavingVehicle(true)
    try {
      const updated = await api.updateVehicle(token, vehicle.id, {
        make: draftVehicle.make.trim(),
        model: draftVehicle.model.trim(),
        year: Number(draftVehicle.year),
        fuelType: draftVehicle.fuelType,
        vehicleType: draftVehicle.vehicleType || undefined,
        vehicleNotes: draftVehicle.vehicleNotes.trim() || null,
        purchaseDate: draftVehicle.purchaseDate.trim() || null,
        ownerCount: draftVehicle.ownerCount.trim() ? Number(draftVehicle.ownerCount) : null,
      })
      await api.updateVehicleExpiry(token, vehicle.id, {
        insuranceExpiry: draftVehicle.insuranceExpiry.trim() || null,
        insuranceCompany: draftVehicle.insuranceCompany.trim() || null,
        insurancePolicyNo: draftVehicle.insurancePolicyNo.trim() || null,
        emissionTestExpiry: draftVehicle.emissionTestExpiry.trim() || null,
        revenueLicenceExpiry: draftVehicle.revenueLicenceExpiry.trim() || null,
      })
      setEditVehicleModal(false)
      onVehicleUpdated?.({ ...updated, insuranceExpiry: draftVehicle.insuranceExpiry.trim() || null, insuranceCompany: draftVehicle.insuranceCompany.trim() || null, insurancePolicyNo: draftVehicle.insurancePolicyNo.trim() || null, emissionTestExpiry: draftVehicle.emissionTestExpiry.trim() || null, revenueLicenceExpiry: draftVehicle.revenueLicenceExpiry.trim() || null })
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save vehicle details')
    } finally {
      setSavingVehicle(false)
    }
  }

  const handleShareAccess = async () => {
    const phone = shareInput.trim()
    if (!phone) return
    setSharingAccess(true)
    try {
      await api.shareVehicleAccess(token, vehicle.id, phone)
      setShareInput('')
      await loadRecords()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSharingAccess(false)
    }
  }

  const handleRevokeShare = (shareId: string, phone: string) => {
    Alert.alert(
      'Revoke Access',
      `Remove ${phone}'s access to this vehicle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevokingShareId(shareId)
            try {
              await api.revokeVehicleShare(token, shareId)
              await loadRecords()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setRevokingShareId(null)
            }
          },
        },
      ]
    )
  }

  const pickVehiclePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access in your device settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    setUploadingVehiclePhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const url = await api.uploadPhoto(token, compressed.uri)
      await api.updateVehiclePhoto(token, vehicle.id, url)
      setVehiclePhotoUrl(url)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload photo.')
    } finally {
      setUploadingVehiclePhoto(false)
    }
  }

  const loadRecords = async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const isShared = vehicle.isShared ?? false
      const [subs, transfer, analytics, preds, allBookings, progress, sentShares] = await Promise.all([
        isShared ? Promise.resolve([]) : api.getVehicleSubmissions(token, vehicle.id).catch(() => []),
        isShared ? Promise.resolve(null) : api.getVehicleTransfer(token, vehicle.id).catch(() => null),
        api.getAnalytics(token, vehicle.id).catch(() => null),
        api.getPredictions(token, vehicle.id).catch(() => []),
        isShared ? Promise.resolve([]) : api.getMyBookings(token).catch(() => []),
        api.getVehicleProgress(token, vehicle.id).catch(() => null),
        isShared ? Promise.resolve([]) : api.getSentVehicleShares(token).catch(() => []),
      ])
      setVehicleProgress(progress)
      setSubmissions(subs as any[])
      setPendingTransfer(transfer)
      const vehicleBookings = (allBookings as any[]).filter((b: any) => b.vehicleId === vehicle.id)
      setMyBookings(vehicleBookings)
      const thisVehicleShares = (sentShares as any[]).filter((s: any) => s.vehicleId === vehicle.id)
      setVehicleShares(thisVehicleShares)
      const urgent = (preds as any[]).filter((p: any) => p.status === 'overdue' || p.status === 'due_soon').slice(0, 3)
      setTopPredictions(urgent)
      if (analytics) {
        setMiniAnalytics({
          mileageTrend: analytics.mileageTrend ?? [],
          fuelEfficiencyTrend: analytics.fuelEfficiencyTrend ?? [],
          avgFuelEfficiency: analytics.avgFuelEfficiency ?? null,
        })
      }
    } catch (error: any) {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (sub: Submission) => {
    setAccepting(sub.id)
    try {
      await api.acceptSubmission(token, sub.id)
      await loadRecords()
      if (sub.garage) {
        setRatingPrompt({ submissionId: sub.id, garageName: sub.garage.name })
        setRatingValue(0)
        setRatingComment('')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setAccepting(null)
    }
  }

  const handleSubmitRating = async () => {
    if (!ratingPrompt || ratingValue === 0) return
    setSubmittingRating(true)
    try {
      await api.rateGarage(token, ratingPrompt.submissionId, ratingValue, ratingComment.trim() || undefined)
      setRatingPrompt(null)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingRating(false)
    }
  }

  const handleReject = (submissionId: string) => {
    Alert.alert(
      'Reject Submission',
      'This submission will be removed and the submitter will be notified. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(submissionId)
            try {
              await api.rejectSubmission(token, submissionId)
              await loadRecords()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setRejecting(null)
            }
          },
        },
      ]
    )
  }

  const handleCancelTransfer = () => {
    if (!pendingTransfer) return
    Alert.alert(
      'Cancel Transfer',
      'Cancel the pending transfer request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          onPress: async () => {
            setCancellingTransfer(true)
            try {
              await api.cancelTransfer(token, pendingTransfer.id)
              setPendingTransfer(null)
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setCancellingTransfer(false)
            }
          },
        },
      ]
    )
  }

  const handleUpdateMileage = async () => {
    const newMileage = parseInt(mileageInput)
    if (!mileageInput || isNaN(newMileage) || newMileage <= vehicle.mileage) {
      Alert.alert('Invalid mileage', `Please enter a value higher than the current odometer (${vehicle.mileage.toLocaleString()} km).`)
      return
    }
    setSavingMileage(true)
    try {
      await api.updateMileage(token, vehicle.id, newMileage)
      onMileageUpdated(newMileage)
      setEditingMileage(false)
      setMileageInput('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSavingMileage(false)
    }
  }

  const toggleMessages = async (sub: Submission) => {
    if (!sub.bookingId) return
    const key = sub.id
    if (expandedMessages.has(key)) {
      setExpandedMessages(prev => { const s = new Set(prev); s.delete(key); return s })
      return
    }
    setExpandedMessages(prev => new Set(prev).add(key))
    setLoadingNotes(prev => new Set(prev).add(key))
    try {
      const notes = await api.getBookingNotes(token, sub.bookingId!)
      setBookingNotes(prev => ({ ...prev, [sub.bookingId!]: notes }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoadingNotes(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const handleSendMessage = async (sub: Submission) => {
    if (!sub.bookingId) return
    const msg = (messageInputs[sub.id] || '').trim()
    if (!msg) return
    setSendingMessage(sub.id)
    try {
      const note = await api.addBookingNote(token, sub.bookingId, msg)
      setBookingNotes(prev => ({
        ...prev,
        [sub.bookingId!]: [...(prev[sub.bookingId!] || []), note],
      }))
      setMessageInputs(prev => ({ ...prev, [sub.id]: '' }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSendingMessage(null)
    }
  }

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Cancel this service appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingBooking(bookingId)
            try {
              await api.cancelBooking(token, bookingId)
              setMyBookings(prev => prev.filter(b => b.id !== bookingId))
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setCancellingBooking(null)
            }
          },
        },
      ]
    )
  }

  const [respondingCounter, setRespondingCounter] = useState<string | null>(null)

  const handleAcceptCounter = async (bookingId: string) => {
    setRespondingCounter(bookingId)
    try {
      const updated = await api.acceptCounter(token, bookingId)
      setMyBookings(prev => prev.map(b => b.id === bookingId
        ? { ...b, status: 'confirmed', date: updated.date, slotLabel: updated.slotLabel, counterDate: null, counterSlot: null }
        : b
      ))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setRespondingCounter(null)
    }
  }

  const handleDeclineCounter = async (bookingId: string) => {
    Alert.alert('Decline Suggestion', 'Decline this slot suggestion? The booking will be cancelled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive',
        onPress: async () => {
          setRespondingCounter(bookingId)
          try {
            await api.declineCounter(token, bookingId)
            setMyBookings(prev => prev.filter(b => b.id !== bookingId))
          } catch (e: any) {
            Alert.alert('Error', e.message)
          } finally {
            setRespondingCounter(null)
          }
        },
      },
    ])
  }

  const toggleBookingMessages = async (bookingId: string) => {
    if (expandedMessages.has(bookingId)) {
      setExpandedMessages(prev => { const s = new Set(prev); s.delete(bookingId); return s })
      return
    }
    setExpandedMessages(prev => new Set(prev).add(bookingId))
    setLoadingNotes(prev => new Set(prev).add(bookingId))
    try {
      const notes = await api.getBookingNotes(token, bookingId)
      setBookingNotes(prev => ({ ...prev, [bookingId]: notes }))
      setMyBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, _count: { bookingNotes: notes.length } } : b
      ))
      onBookingSeen?.(bookingId, notes.length)
      // Sync bell dot: mark any DB notification for this booking as read
      api.markBookingNotifsRead(token, bookingId)
        .then(({ count }) => onNotifSeen?.(count))
        .catch(() => {})
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoadingNotes(prev => { const s = new Set(prev); s.delete(bookingId); return s })
    }
  }

  const handleSendBookingMessage = async (bookingId: string) => {
    const msg = (messageInputs[bookingId] || '').trim()
    if (!msg) return
    setSendingMessage(bookingId)
    try {
      const note = await api.addBookingNote(token, bookingId, msg)
      const currentNotes = bookingNotes[bookingId] || []
      const updated = [...currentNotes, note]
      setBookingNotes(prev => ({ ...prev, [bookingId]: updated }))
      setMyBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, _count: { bookingNotes: updated.length } } : b
      ))
      onBookingSeen?.(bookingId, updated.length)
      setMessageInputs(prev => ({ ...prev, [bookingId]: '' }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSendingMessage(null)
    }
  }

  useEffect(() => { loadRecords() }, [])

  useEffect(() => {
    const total = myBookings.reduce((sum, b) => {
      const unread = Math.max(0, (b._count?.bookingNotes ?? 0) - (bookingSeenCounts[b.id] ?? 0))
      return sum + unread
    }, 0)
    onMessageCountChange?.(total)
  }, [bookingSeenCounts, myBookings])

  // Auto-expand booking messages when navigated from a notification
  useEffect(() => {
    if (!focusBookingId || myBookings.length === 0) return
    const focusAndLoad = async () => {
      setExpandedMessages(prev => new Set(prev).add(focusBookingId))
      setLoadingNotes(prev => new Set(prev).add(focusBookingId))
      try {
        const notes = await api.getBookingNotes(token, focusBookingId)
        setBookingNotes(prev => ({ ...prev, [focusBookingId]: notes }))
        setMyBookings(prev => prev.map(b =>
          b.id === focusBookingId ? { ...b, _count: { bookingNotes: notes.length } } : b
        ))
        onBookingSeen?.(focusBookingId, notes.length)
      } catch {}
      finally {
        setLoadingNotes(prev => { const s = new Set(prev); s.delete(focusBookingId); return s })
      }
      onFocusHandled?.()
    }
    focusAndLoad()
  }, [focusBookingId, myBookings.length])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Sparkline data
  const mileageValues = miniAnalytics?.mileageTrend.map(d => d.mileage) ?? []
  const effValues = miniAnalytics?.fuelEfficiencyTrend.map(d => d.kmPerL) ?? []
  const mileageTrend = getTrend(mileageValues, true)
  const effTrend = getTrend(effValues, true)

  const showSparklines = mileageValues.length >= 2 || effValues.length >= 2

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader
        title={vehicle.registrationNo}
        onBack={onBack}
        rightElement={
          <View style={styles.headerRightIcons}>
            {onNotifications && (
              <TouchableOpacity onPress={onNotifications} style={styles.bellBtn}>
                <Text style={styles.bellIcon}>🔔</Text>
                {notifUnread && <View style={styles.bellDot} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMoreActionsSheet(true)} style={styles.moreBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.moreIcon}>•••</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRecords} />}
        contentContainerStyle={styles.scrollContent}
      >
        {loadFailed && (
          <TouchableOpacity style={styles.errorBanner} onPress={loadRecords} activeOpacity={0.8}>
            <Text style={styles.errorBannerText}>⚠️  Could not load data — tap to retry</Text>
          </TouchableOpacity>
        )}
        <View style={styles.vehicleCard}>
          {vehiclePhotoUrl ? (
            <TouchableOpacity onPress={pickVehiclePhoto} activeOpacity={0.9} disabled={uploadingVehiclePhoto}>
              <Image source={{ uri: vehiclePhotoUrl }} style={styles.vehicleCardPhoto} resizeMode="cover" />
              <View style={styles.vehiclePhotoOverlay}>
                {uploadingVehiclePhoto
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.vehiclePhotoOverlayText}>📷 Change</Text>}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.vehiclePhotoAdd} onPress={pickVehiclePhoto} disabled={uploadingVehiclePhoto} activeOpacity={0.8}>
              {uploadingVehiclePhoto
                ? <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
                : <Text style={styles.vehiclePhotoAddText}>📷  Add vehicle photo</Text>}
            </TouchableOpacity>
          )}
          <View style={styles.vehicleNameRow}>
            <Text style={styles.vehicleName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            {vehicle.isShared ? (
              <View style={[styles.editVehicleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.editVehicleBtnText}>👁 View only</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setDraftVehicle({ make: vehicle.make, model: vehicle.model, year: vehicle.year.toString(), fuelType: vehicle.fuelType, vehicleType: vehicle.vehicleType ?? '', purchaseDate: vehicle.purchaseDate ? new Date(vehicle.purchaseDate).toLocaleDateString('en-GB').split('/').reverse().join('-') : '', ownerCount: vehicle.ownerCount?.toString() ?? '', vehicleNotes: vehicle.vehicleNotes ?? '', insuranceCompany: vehicle.insuranceCompany ?? '', insurancePolicyNo: vehicle.insurancePolicyNo ?? '', insuranceExpiry: vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toISOString().split('T')[0] : '', emissionTestExpiry: vehicle.emissionTestExpiry ? new Date(vehicle.emissionTestExpiry).toISOString().split('T')[0] : '', revenueLicenceExpiry: vehicle.revenueLicenceExpiry ? new Date(vehicle.revenueLicenceExpiry).toISOString().split('T')[0] : '' }); setEditVehicleModal(true) }} style={styles.editVehicleBtn}>
                <Text style={styles.editVehicleBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleDetail}>{vehicle.fuelType}</Text>
            {vehicle.isShared ? (
              <Text style={styles.vehicleDetail}>{vehicle.mileage.toLocaleString()} km</Text>
            ) : !editingMileage ? (
              <TouchableOpacity style={styles.mileageRow} onPress={() => { setMileageInput(''); setEditingMileage(true) }}>
                <Text style={styles.vehicleDetail}>{vehicle.mileage.toLocaleString()} km</Text>
                <Animated.View style={[styles.mileageUpdatePill, { borderColor: mileageUpdateBorderColor }]}>
                  <Text style={styles.mileageEditHint}>✏️ Update</Text>
                </Animated.View>
              </TouchableOpacity>
            ) : (
              <View style={styles.mileageEditRow}>
                <TextInput
                  style={styles.mileageInput}
                  value={mileageInput}
                  onChangeText={setMileageInput}
                  keyboardType="number-pad"
                  placeholder={vehicle.mileage.toLocaleString()}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  autoFocus
                />
                <TouchableOpacity style={styles.mileageSaveBtn} onPress={handleUpdateMileage} disabled={savingMileage}>
                  {savingMileage ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mileageSaveBtnText}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.mileageCancelBtn} onPress={() => setEditingMileage(false)}>
                  <Text style={styles.mileageCancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {vehicle.isShared ? (
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickBtn} onPress={onAnalytics}>
                <Text style={styles.quickBtnText}>📊 Insights</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={onPredictions}>
                <Text style={styles.quickBtnText}>💡 Predictions</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.quickActions}>
              <TouchableOpacity style={[styles.quickBtn, styles.quickBtnEmphasis]} onPress={onLogFuel}>
                <Text style={[styles.quickBtnText, styles.quickBtnTextEmphasis]}>⛽ Log Fuel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={onAddRecord}>
                <Text style={styles.quickBtnText}>🔧 Add Service</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={onAddExpense}>
                <Text style={styles.quickBtnText}>💰 Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={onAnalytics}>
                <Text style={styles.quickBtnText}>📊 Insights</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sparkline mini-charts */}
        {showSparklines && (
          <View style={styles.sparkRow}>
            <TouchableOpacity style={styles.sparkCard} onPress={onAnalytics}>
              <Text style={styles.sparkTitle}>Mileage</Text>
              <Sparkline data={mileageValues} color={colors.primary} gradId="dashMileage" />
              <Text style={styles.sparkValue}>
                {vehicle.mileage.toLocaleString()}
                <Text style={styles.sparkUnit}> km</Text>
              </Text>
              <Text style={[styles.sparkTrend, { color: mileageTrend.color }]}>
                {mileageTrend.arrow} {mileageTrend.label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sparkCard} onPress={onAnalytics}>
              <Text style={styles.sparkTitle}>Fuel Economy</Text>
              <Sparkline data={effValues.length >= 2 ? effValues : mileageValues} color="#34a853" gradId="dashEff" />
              <Text style={styles.sparkValue}>
                {miniAnalytics?.avgFuelEfficiency != null
                  ? miniAnalytics.avgFuelEfficiency.toFixed(1)
                  : '—'}
                <Text style={styles.sparkUnit}> km/L</Text>
              </Text>
              <Text style={[styles.sparkTrend, { color: effTrend.color }]}>
                {effValues.length >= 2 ? `${effTrend.arrow} ${effTrend.label}` : 'Log more fill-ups'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Vehicle profile card (progress + stats merged) ── */}
        {((vehicleProgress && vehicleProgress.score < 100) || vehicle.purchaseDate || vehicle.ownerCount != null || vehicle.vehicleNotes) && (
          <View style={styles.profileCard}>
            {vehicleProgress && vehicleProgress.score < 100 && (
              <>
                <View style={styles.progressCardHeader}>
                  <Text style={styles.progressCardTitle}>Vehicle Profile</Text>
                  <Text style={styles.progressCardPct}>{vehicleProgress.score}% complete</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${vehicleProgress.score}%` as any }]} />
                </View>
                {vehicleProgress.items.filter(i => !i.done).slice(0, 2).map(item => (
                  <Text key={item.id} style={styles.progressHint}>· {item.hint}</Text>
                ))}
              </>
            )}
            {vehicleProgress && vehicleProgress.score < 100 && (vehicle.purchaseDate || vehicle.ownerCount != null) && (
              <View style={styles.profileDivider} />
            )}
            {(vehicle.purchaseDate || vehicle.ownerCount != null || vehicle.registrationNo) && (
              <View style={styles.profileCardRow}>
                {vehicle.purchaseDate && (
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatLabel}>Purchased</Text>
                    <Text style={styles.profileStatValue}>
                      {new Date(vehicle.purchaseDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                )}
                {vehicle.ownerCount != null && (
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatLabel}>Owners</Text>
                    <Text style={styles.profileStatValue}>{vehicle.ownerCount}</Text>
                  </View>
                )}
                {vehicle.registrationNo && (
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatLabel}>Reg No</Text>
                    <Text style={styles.profileStatValue} numberOfLines={1}>{vehicle.registrationNo}</Text>
                  </View>
                )}
              </View>
            )}
            {vehicle.vehicleNotes ? (
              <Text style={styles.profileNotes}>{vehicle.vehicleNotes}</Text>
            ) : null}
          </View>
        )}

        {/* Renewal expiry banners */}
        {(() => {
          const emission  = getExpiryAlert(vehicle.emissionTestExpiry)
          const licence   = getExpiryAlert(vehicle.revenueLicenceExpiry)
          const insurance = getExpiryAlert(vehicle.insuranceExpiry)
          if (!emission && !licence && !insurance) return null
          const urgencyColor = (u: string) => u === 'expired' || u === 'critical' ? '#c62828' : '#e65100'
          const urgencyBg    = (u: string) => u === 'expired' || u === 'critical' ? '#ffebee' : '#fff3e0'
          return (
            <View style={styles.renewalSection}>
              {emission && (
                <TouchableOpacity
                  style={[styles.renewalCard, { borderLeftColor: urgencyColor(emission.urgency), backgroundColor: urgencyBg(emission.urgency) }]}
                  onPress={onVehicleTests}
                  activeOpacity={0.8}
                >
                  <View style={styles.renewalLeft}>
                    <Text style={[styles.renewalTitle, { color: urgencyColor(emission.urgency) }]}>
                      {emission.urgency === 'expired' ? '🚨' : '⚠️'} Emission Test
                    </Text>
                    <Text style={[styles.renewalDays, { color: urgencyColor(emission.urgency) }]}>
                      {expiryLabel(emission.daysLeft)}
                    </Text>
                    <Text style={styles.renewalDate}>
                      {new Date(vehicle.emissionTestExpiry!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[styles.renewalArrow, { color: urgencyColor(emission.urgency) }]}>›</Text>
                </TouchableOpacity>
              )}
              {licence && (
                <TouchableOpacity
                  style={[styles.renewalCard, { borderLeftColor: urgencyColor(licence.urgency), backgroundColor: urgencyBg(licence.urgency) }]}
                  onPress={onAddExpense}
                  activeOpacity={0.8}
                >
                  <View style={styles.renewalLeft}>
                    <Text style={[styles.renewalTitle, { color: urgencyColor(licence.urgency) }]}>
                      {licence.urgency === 'expired' ? '🚨' : '⚠️'} Revenue Licence
                    </Text>
                    <Text style={[styles.renewalDays, { color: urgencyColor(licence.urgency) }]}>
                      {expiryLabel(licence.daysLeft)}
                    </Text>
                    <Text style={styles.renewalDate}>
                      {new Date(vehicle.revenueLicenceExpiry!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[styles.renewalArrow, { color: urgencyColor(licence.urgency) }]}>›</Text>
                </TouchableOpacity>
              )}
              {insurance && (
                <TouchableOpacity
                  style={[styles.renewalCard, { borderLeftColor: urgencyColor(insurance.urgency), backgroundColor: urgencyBg(insurance.urgency) }]}
                  onPress={onAddExpense}
                  activeOpacity={0.8}
                >
                  <View style={styles.renewalLeft}>
                    <Text style={[styles.renewalTitle, { color: urgencyColor(insurance.urgency) }]}>
                      {insurance.urgency === 'expired' ? '🚨' : '⚠️'} Insurance
                      {vehicle.insuranceCompany ? ` — ${vehicle.insuranceCompany}` : ''}
                    </Text>
                    <Text style={[styles.renewalDays, { color: urgencyColor(insurance.urgency) }]}>
                      {expiryLabel(insurance.daysLeft)}
                    </Text>
                    <Text style={styles.renewalDate}>
                      {new Date(vehicle.insuranceExpiry!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[styles.renewalArrow, { color: urgencyColor(insurance.urgency) }]}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })()}

        {/* My Appointments — owner's booked service slots */}
        {myBookings.length > 0 && (
          <View style={styles.appointmentsSection}>
            <Text style={styles.appointmentsSectionTitle}>📅 My Appointments ({myBookings.length})</Text>
            {myBookings.map(bk => {
              const isConfirmed = bk.status === 'confirmed'
              const isCounter   = bk.status === 'counter_suggested'
              const statusColor = isConfirmed ? '#2e7d32' : isCounter ? '#1565c0' : '#e65100'
              const statusLabel = isConfirmed ? '✓ Confirmed' : isCounter ? '🔄 Counter Suggested' : '⏳ Pending'
              const isExpanded = expandedMessages.has(bk.id)
              return (
                <View key={bk.id} style={[styles.appointmentCard, { borderLeftColor: statusColor }]}>
                  <View style={styles.appointmentHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appointmentGarage}>
                        {bk.garage.name}{bk.garage.verified ? ' ✅' : ''}
                      </Text>
                      <Text style={styles.appointmentDateTime}>
                        {new Date(bk.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        {bk.slotLabel ? `  •  ${bk.slotLabel}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isConfirmed ? '#e8f5e9' : '#fff3e0' }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {bk.serviceType && (
                    <View style={styles.serviceTypeChip}>
                      <Text style={styles.serviceTypeChipText}>
                        {bk.serviceType === 'full' ? '🔧 Full Service' : bk.serviceType === 'between' ? '⚡ Between Service' : '🏭 Third-Party'}
                      </Text>
                    </View>
                  )}

                  {bk.notes && (
                    <Text style={styles.appointmentNotes}>
                      {bk.noteType === 'urgent' ? '🚨 ' : ''}{bk.notes}
                    </Text>
                  )}

                  {isCounter && bk.counterDate && (
                    <View style={styles.counterOfferCard}>
                      <Text style={styles.counterOfferTitle}>🔄 Garage suggests a different slot:</Text>
                      <Text style={styles.counterOfferDate}>
                        {new Date(bk.counterDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {bk.counterSlot ? `  ·  ${bk.counterSlot}` : ''}
                      </Text>
                      <View style={styles.counterOfferActions}>
                        <TouchableOpacity
                          style={[styles.counterAcceptBtn, respondingCounter === bk.id && { opacity: 0.5 }]}
                          onPress={() => handleAcceptCounter(bk.id)}
                          disabled={respondingCounter === bk.id}
                        >
                          {respondingCounter === bk.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.counterAcceptBtnText}>✓ Accept</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.counterDeclineBtn, respondingCounter === bk.id && { opacity: 0.5 }]}
                          onPress={() => handleDeclineCounter(bk.id)}
                          disabled={respondingCounter === bk.id}
                        >
                          <Text style={styles.counterDeclineBtnText}>✕ Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={styles.appointmentActions}>
                    <TouchableOpacity
                      style={styles.messagesToggleSmall}
                      onPress={() => toggleBookingMessages(bk.id)}
                    >
                      <View style={styles.messagesToggleRow}>
                        <Text style={styles.messagesToggleSmallText}>
                          💬 Messages {isExpanded ? '▲' : '▼'}
                        </Text>
                        {(() => {
                          const unread = Math.max(0, (bk._count?.bookingNotes ?? 0) - (bookingSeenCounts[bk.id] ?? 0))
                          return unread > 0 ? <View style={styles.msgDot} /> : null
                        })()}
                      </View>
                    </TouchableOpacity>
                    {!isConfirmed && !isCounter && (
                      <TouchableOpacity
                        style={[styles.cancelBkBtn, cancellingBooking === bk.id && styles.cancelBkBtnDisabled]}
                        onPress={() => handleCancelBooking(bk.id)}
                        disabled={cancellingBooking === bk.id}
                      >
                        {cancellingBooking === bk.id
                          ? <ActivityIndicator size="small" color="#c62828" />
                          : <Text style={styles.cancelBkBtnText}>Cancel</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>

                  {isExpanded && (
                    <View style={styles.messagesSection}>
                      {loadingNotes.has(bk.id) ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
                      ) : (
                        <>
                          {(bookingNotes[bk.id] || []).length === 0 ? (
                            <Text style={styles.noMessages}>No messages yet</Text>
                          ) : (bookingNotes[bk.id] || []).map(note => (
                            <View
                              key={note.id}
                              style={[
                                styles.messageItem,
                                note.senderPhone !== phoneNumber ? styles.messageItemThem : undefined,
                              ]}
                            >
                              <Text style={styles.messageSender}>
                                {note.senderPhone !== phoneNumber ? 'Garage' : 'You'}
                              </Text>
                              <Text style={styles.messageText}>{note.message}</Text>
                              <Text style={styles.messageTime}>
                                {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.messageInputRow}>
                            <TextInput
                              style={styles.messageInput}
                              value={messageInputs[bk.id] || ''}
                              onChangeText={v => setMessageInputs(prev => ({ ...prev, [bk.id]: v }))}
                              placeholder="Type a message..."
                              multiline={false}
                            />
                            <TouchableOpacity
                              style={[styles.messageSendBtn, (!messageInputs[bk.id]?.trim() || sendingMessage === bk.id) && styles.messageSendBtnDisabled]}
                              onPress={() => handleSendBookingMessage(bk.id)}
                              disabled={!messageInputs[bk.id]?.trim() || sendingMessage === bk.id}
                            >
                              {sendingMessage === bk.id
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.messageSendBtnText}>→</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Upcoming Services prediction card */}
        <TouchableOpacity style={styles.predCard} onPress={onPredictions} activeOpacity={0.85}>
          <View style={styles.predCardHeader}>
            <Text style={styles.predCardTitle}>🔮 Upcoming Services</Text>
            <Text style={styles.predCardLink}>View all →</Text>
          </View>
          {topPredictions.length === 0 ? (
            <Text style={styles.predAllOk}>✓ All tracked services are on schedule</Text>
          ) : (
            topPredictions.map(p => {
              const isOverdue = p.status === 'overdue'
              const cardBg    = isOverdue ? '#ffebee' : '#fff8e1'
              const borderClr = isOverdue ? '#c62828' : '#f9a825'
              const textClr   = isOverdue ? '#c62828' : '#e65100'
              const badge     = isOverdue ? '🚨 Overdue' : '⚠ Due Soon'
              const detail    = isOverdue
                ? `Overdue${p.remainingKm != null ? ` by ${Math.abs(p.remainingKm).toLocaleString()} km` : ''}`
                : `Due in${p.remainingKm != null ? ` ${p.remainingKm.toLocaleString()} km` : p.remainingDays != null ? ` ${p.remainingDays} days` : ''}`
              return (
                <View key={p.id} style={[styles.predItem, { backgroundColor: cardBg, borderLeftColor: borderClr }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.predItemName, { color: textClr }]}>{p.name}</Text>
                    <Text style={styles.predItemDetail}>{detail}</Text>
                  </View>
                  <View style={[styles.predItemBadge, { backgroundColor: borderClr }]}>
                    <Text style={styles.predItemBadgeText}>{badge}</Text>
                  </View>
                </View>
              )
            })
          )}
        </TouchableOpacity>

        {/* Pending submissions — shown prominently right after vehicle card */}
        {submissions.length > 0 && (
          <View style={styles.submissionsSection}>
            <Text style={styles.submissionsSectionTitle}>
              ⚠️ Pending for Approval ({submissions.length})
            </Text>
            {submissions.map(sub => (
              <View key={sub.id} style={styles.submissionCard}>
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionGarage}>
                    {sub.garage ? `${sub.garage.name}${sub.garage.verified ? ' ✅' : ''}` : sub.submittedByPhone ?? 'Shared user'}
                  </Text>
                  <Text style={styles.submissionDate}>
                    {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.tagRow}>
                  {sub.description.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{s}</Text>
                    </View>
                  ))}
                </View>
                {sub.parts && <Text style={styles.submissionMeta}>Parts: {sub.parts}</Text>}
                {sub.brand && <Text style={styles.submissionMeta}>Brand: {sub.brand}</Text>}
                {sub.cost != null && (
                  <Text style={styles.submissionCost}>LKR {sub.cost.toLocaleString()}</Text>
                )}
                {sub.notes && <Text style={styles.submissionNotes}>{sub.notes}</Text>}
                {sub.photos && sub.photos.length > 0 && (
                  <View style={styles.photoStrip}>
                    {sub.photos.map((url, i) => (
                      <TouchableOpacity key={i} onPress={() => openPhotos(sub.photos, i, sub.description || 'Service submission')} activeOpacity={0.8}>
                        <Image source={{ uri: url }} style={styles.recordThumb} />
                        {sub.photos.length > 1 && i === 0 && (
                          <View style={styles.thumbCountBadge}>
                            <Text style={styles.thumbCountText}>{sub.photos.length}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {!sub.garage && (
                  <View style={styles.submissionActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, rejecting === sub.id && styles.acceptBtnDisabled]}
                      onPress={() => handleReject(sub.id)}
                      disabled={rejecting === sub.id || accepting === sub.id}
                    >
                      {rejecting === sub.id
                        ? <ActivityIndicator color="#c62828" size="small" />
                        : <Text style={styles.rejectBtnText}>✕ Reject</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.acceptBtn, styles.acceptBtnFlex, accepting === sub.id && styles.acceptBtnDisabled]}
                      onPress={() => handleAccept(sub)}
                      disabled={accepting === sub.id || rejecting === sub.id}
                    >
                      {accepting === sub.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.acceptBtnText}>✓ Accept</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
                {sub.garage && (
                  <TouchableOpacity
                    style={[styles.acceptBtn, accepting === sub.id && styles.acceptBtnDisabled]}
                    onPress={() => handleAccept(sub)}
                    disabled={accepting === sub.id}
                  >
                    {accepting === sub.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.acceptBtnText}>✓ Accept — Add to My History</Text>
                    }
                  </TouchableOpacity>
                )}

                {/* Booking notes thread (only if linked to a booking) */}
                {sub.bookingId && (
                  <TouchableOpacity
                    style={styles.messagesToggle}
                    onPress={() => toggleMessages(sub)}
                  >
                    <Text style={styles.messagesToggleText}>
                      💬 Messages {expandedMessages.has(sub.id) ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                )}

                {sub.bookingId && expandedMessages.has(sub.id) && (
                  <View style={styles.messagesSection}>
                    {loadingNotes.has(sub.id) ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {(bookingNotes[sub.bookingId] || []).length === 0 ? (
                          <Text style={styles.noMessages}>No messages yet</Text>
                        ) : (bookingNotes[sub.bookingId] || []).map(note => (
                          <View
                            key={note.id}
                            style={[
                              styles.messageItem,
                              note.senderPhone !== phoneNumber ? styles.messageItemThem : undefined,
                            ]}
                          >
                            <Text style={styles.messageSender}>
                              {note.senderPhone !== phoneNumber ? 'Garage' : 'You'}
                            </Text>
                            <Text style={styles.messageText}>{note.message}</Text>
                            <Text style={styles.messageTime}>
                              {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        ))}
                        <View style={styles.messageInputRow}>
                          <TextInput
                            style={styles.messageInput}
                            value={messageInputs[sub.id] || ''}
                            onChangeText={v => setMessageInputs(prev => ({ ...prev, [sub.id]: v }))}
                            placeholder="Type a message..."
                            multiline={false}
                          />
                          <TouchableOpacity
                            style={[styles.messageSendBtn, (!messageInputs[sub.id]?.trim() || sendingMessage === sub.id) && styles.messageSendBtnDisabled]}
                            onPress={() => handleSendMessage(sub)}
                            disabled={!messageInputs[sub.id]?.trim() || sendingMessage === sub.id}
                          >
                            {sendingMessage === sub.id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.messageSendBtnText}>→</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {pendingTransfer && (
          <View style={styles.transferBanner}>
            <View style={styles.transferBannerLeft}>
              <Text style={styles.transferBannerTitle}>Transfer Pending</Text>
              <Text style={styles.transferBannerSub}>Waiting for {pendingTransfer.buyerPhone} to accept</Text>
            </View>
            <TouchableOpacity
              style={[styles.cancelTransferBtn, cancellingTransfer && styles.cancelTransferBtnDisabled]}
              onPress={handleCancelTransfer}
              disabled={cancellingTransfer}
            >
              {cancellingTransfer
                ? <ActivityIndicator color="#c62828" size="small" />
                : <Text style={styles.cancelTransferBtnText}>Cancel</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.historyBtn} onPress={onViewHistory} activeOpacity={0.8}>
          <Text style={styles.historyBtnText}>📋 Full History & Expenses</Text>
          <Text style={styles.historyBtnArrow}>›</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Edit vehicle modal ─── */}
      <Modal visible={editVehicleModal} transparent animationType="slide" onRequestClose={() => setEditVehicleModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.editVehicleOverlay}>
          <View style={styles.editVehicleCard}>
            <View style={styles.editVehicleHeaderRow}>
              <Text style={styles.editVehicleTitle}>Edit Vehicle Details</Text>
              <TouchableOpacity onPress={() => setEditVehicleModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.editVehicleClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.editVehicleLabel}>Make</Text>
            <TextInput style={styles.editVehicleInput} value={draftVehicle.make} onChangeText={v => setDraftVehicle(p => ({ ...p, make: v }))} placeholder="e.g. Toyota" placeholderTextColor={colors.textFaint} />
            <Text style={styles.editVehicleLabel}>Model</Text>
            <TextInput style={styles.editVehicleInput} value={draftVehicle.model} onChangeText={v => setDraftVehicle(p => ({ ...p, model: v }))} placeholder="e.g. Prius" placeholderTextColor={colors.textFaint} />
            <Text style={styles.editVehicleLabel}>Year</Text>
            <TextInput style={styles.editVehicleInput} value={draftVehicle.year} onChangeText={v => setDraftVehicle(p => ({ ...p, year: v }))} keyboardType="number-pad" placeholder="e.g. 2018" placeholderTextColor={colors.textFaint} />
            <Text style={styles.editVehicleLabel}>Fuel Type</Text>
            <View style={styles.fuelTypeRow}>
              {['Petrol 92', 'Petrol 95', 'Diesel', 'Electric', 'Hybrid'].map(ft => (
                <TouchableOpacity key={ft} style={[styles.fuelTypeChip, draftVehicle.fuelType === ft && styles.fuelTypeChipActive]} onPress={() => setDraftVehicle(p => ({ ...p, fuelType: ft }))}>
                  <Text style={[styles.fuelTypeChipText, draftVehicle.fuelType === ft && styles.fuelTypeChipTextActive]}>{ft}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.editVehicleLabel}>Vehicle Type</Text>
            <View style={styles.vehicleTypeGrid}>
              {VEHICLE_TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.vehicleTypeChip, draftVehicle.vehicleType === opt.value && styles.vehicleTypeChipActive]}
                  onPress={() => setDraftVehicle(p => ({ ...p, vehicleType: opt.value }))}
                >
                  <Text style={styles.vehicleTypeChipIcon}>{opt.icon}</Text>
                  <Text style={[styles.vehicleTypeChipText, draftVehicle.vehicleType === opt.value && styles.vehicleTypeChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.editVehicleLabel}>Purchase Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.purchaseDate}
              onChangeText={v => setDraftVehicle(p => ({ ...p, purchaseDate: v }))}
              placeholder="e.g. 2021-06-15  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.editVehicleLabel}>Previous Owners</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.ownerCount}
              onChangeText={v => setDraftVehicle(p => ({ ...p, ownerCount: v }))}
              keyboardType="number-pad"
              placeholder="e.g. 2  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.editVehicleLabel}>Vehicle Notes</Text>
            <TextInput
              style={[styles.editVehicleInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={draftVehicle.vehicleNotes}
              onChangeText={v => setDraftVehicle(p => ({ ...p, vehicleNotes: v }))}
              multiline
              placeholder="e.g. imported from Japan 2021, AC recently serviced..."
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.editSectionDivider} />
            <Text style={styles.editSectionTitle}>📅 Renewal Dates</Text>
            <Text style={styles.editVehicleLabel}>Emission Test Expiry (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.emissionTestExpiry}
              onChangeText={v => setDraftVehicle(p => ({ ...p, emissionTestExpiry: v }))}
              placeholder="e.g. 2026-06-30  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.editVehicleLabel}>Revenue Licence Expiry (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.revenueLicenceExpiry}
              onChangeText={v => setDraftVehicle(p => ({ ...p, revenueLicenceExpiry: v }))}
              placeholder="e.g. 2026-12-31  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.editSectionDivider} />
            <Text style={styles.editSectionTitle}>🛡️ Insurance Details</Text>
            <Text style={styles.editVehicleLabel}>Insurance Company</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.insuranceCompany}
              onChangeText={v => setDraftVehicle(p => ({ ...p, insuranceCompany: v }))}
              placeholder="e.g. Ceylinco, Union, Allianz  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.editVehicleLabel}>Policy Number</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.insurancePolicyNo}
              onChangeText={v => setDraftVehicle(p => ({ ...p, insurancePolicyNo: v }))}
              placeholder="e.g. POL-2024-001234  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.editVehicleLabel}>Insurance Expiry (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.editVehicleInput}
              value={draftVehicle.insuranceExpiry}
              onChangeText={v => setDraftVehicle(p => ({ ...p, insuranceExpiry: v }))}
              placeholder="e.g. 2025-08-31  (optional)"
              placeholderTextColor={colors.textFaint}
            />
            <TouchableOpacity style={[styles.editVehicleSaveBtn, savingVehicle && styles.editVehicleSaveBtnDisabled]} onPress={handleSaveVehicle} disabled={savingVehicle}>
              {savingVehicle ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editVehicleSaveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={moreActionsSheet} transparent animationType="slide" onRequestClose={() => setMoreActionsSheet(false)}>
        <View style={styles.moreSheetOverlay}>
          <View style={styles.moreSheetCard}>
            <View style={styles.moreSheetHeaderRow}>
              <Text style={styles.moreSheetTitle}>More for this vehicle</Text>
              <TouchableOpacity onPress={() => setMoreActionsSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.moreSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onVehicleTests() }}>
              <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>🧪</Text></View>
              <Text style={styles.moreSheetItemText}>Vehicle Tests</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onKnowledgeHub() }}>
              <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>🧠</Text></View>
              <Text style={styles.moreSheetItemText}>Know Your Vehicle</Text>
            </TouchableOpacity>
            {!vehicle.isShared && onCostForecast && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onCostForecast() }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>💰</Text></View>
                <Text style={styles.moreSheetItemText}>Cost Forecast</Text>
              </TouchableOpacity>
            )}
            {!vehicle.isShared && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onBookService() }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>📅</Text></View>
                <Text style={styles.moreSheetItemText}>Book Service Appointment</Text>
              </TouchableOpacity>
            )}
            {!vehicle.isShared && CHAIN_VEHICLE_TYPES.has(vehicle.vehicleType ?? '') && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onChainService() }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>⛓</Text></View>
                <Text style={styles.moreSheetItemText}>Chain Service</Text>
              </TouchableOpacity>
            )}
            {!vehicle.isShared && vehicle.vehicleType === 'three-wheeler' && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onTripLog() }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>🛺</Text></View>
                <Text style={styles.moreSheetItemText}>Daily Trip Log</Text>
              </TouchableOpacity>
            )}
            {!vehicle.isShared && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); setFamilyShareModal(true) }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>👥</Text></View>
                <Text style={styles.moreSheetItemText}>Family / Shared Access</Text>
              </TouchableOpacity>
            )}
            {!vehicle.isShared && !pendingTransfer && (
              <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreActionsSheet(false); onSell() }}>
                <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>🔄</Text></View>
                <Text style={styles.moreSheetItemText}>Sell / Transfer Vehicle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={familyShareModal} transparent animationType="slide" onRequestClose={() => setFamilyShareModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.moreSheetOverlay}>
          <View style={styles.moreSheetCard}>
            <View style={styles.moreSheetHeaderRow}>
              <Text style={styles.moreSheetTitle}>Family / Shared Access</Text>
              <TouchableOpacity onPress={() => setFamilyShareModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.moreSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {vehicleShares.length > 0 && (
              <View style={styles.familyShareList}>
                {vehicleShares.map(share => (
                  <View key={share.id} style={styles.familyShareRow}>
                    <View>
                      <Text style={styles.familySharePhone}>{share.sharedWithPhone}</Text>
                      <Text style={[
                        styles.familyShareStatus,
                        share.status === 'active' ? { color: '#2e7d32' } : { color: '#e65100' }
                      ]}>
                        {share.status === 'active' ? 'Active' : 'Pending'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.revokeBtn, revokingShareId === share.id && { opacity: 0.5 }]}
                      onPress={() => handleRevokeShare(share.id, share.sharedWithPhone)}
                      disabled={revokingShareId === share.id}
                    >
                      {revokingShareId === share.id
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={styles.revokeBtnText}>Revoke</Text>
                      }
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.familyShareInputRow}>
              <TextInput
                style={styles.familyShareInput}
                value={shareInput}
                onChangeText={setShareInput}
                placeholder="With country code, e.g. +94771234567"
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.familyShareBtn, (!shareInput.trim() || sharingAccess) && { opacity: 0.5 }]}
                onPress={handleShareAccess}
                disabled={!shareInput.trim() || sharingAccess}
              >
                {sharingAccess
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.familyShareBtnText}>Share</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!ratingPrompt} transparent animationType="slide" onRequestClose={() => setRatingPrompt(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.moreSheetOverlay}>
          <View style={styles.moreSheetCard}>
            <View style={styles.moreSheetHeaderRow}>
              <Text style={styles.moreSheetTitle}>Rate {ratingPrompt?.garageName}</Text>
              <TouchableOpacity onPress={() => setRatingPrompt(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.moreSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.ratingSubtitle}>How was your experience with this service?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRatingValue(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={styles.starIcon}>{n <= ratingValue ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.ratingCommentInput}
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Add a comment (optional)"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <View style={styles.ratingBtnRow}>
              <TouchableOpacity style={styles.ratingSkipBtn} onPress={() => setRatingPrompt(null)}>
                <Text style={styles.ratingSkipBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ratingSubmitBtn, (ratingValue === 0 || submittingRating) && { opacity: 0.5 }]}
                onPress={handleSubmitRating}
                disabled={ratingValue === 0 || submittingRating}
              >
                {submittingRating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.ratingSubmitBtnText}>Submit Rating</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!photoViewer} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)} statusBarTranslucent>
        {photoViewer && (() => {
          const { photos, label } = photoViewer
          const W = Dimensions.get('window').width
          return (
            <View style={styles.photoModalBg}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalLabel} numberOfLines={1}>{label}</Text>
                <TouchableOpacity onPress={() => setPhotoViewer(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.photoModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                ref={photoViewerRef}
                data={photos}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                initialScrollIndex={photoViewer.index}
                getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
                onMomentumScrollEnd={e => setPhotoViewerIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
                renderItem={({ item: url }) => (
                  <View style={{ width: W, justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: W, height: '100%' }} resizeMode="contain" />
                  </View>
                )}
                style={{ flex: 1 }}
              />
              <View style={styles.photoModalFooter}>
                <TouchableOpacity disabled={photoViewerIndex === 0} onPress={() => { const i = photoViewerIndex - 1; photoViewerRef.current?.scrollToIndex({ index: i, animated: true }); setPhotoViewerIndex(i) }} style={[styles.photoNavBtn, photoViewerIndex === 0 && styles.photoNavBtnDisabled]}>
                  <Text style={styles.photoNavText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.photoCounter}>{photoViewerIndex + 1} / {photos.length}</Text>
                <TouchableOpacity disabled={photoViewerIndex === photos.length - 1} onPress={() => { const i = photoViewerIndex + 1; photoViewerRef.current?.scrollToIndex({ index: i, animated: true }); setPhotoViewerIndex(i) }} style={[styles.photoNavBtn, photoViewerIndex === photos.length - 1 && styles.photoNavBtnDisabled]}>
                  <Text style={styles.photoNavText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })()}
      </Modal>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { paddingBottom: 40 },
    headerRightIcons: { flexDirection: 'row', alignItems: 'center' },
    bellBtn: { marginLeft: 12, padding: 4, position: 'relative' },
    bellIcon: { fontSize: 22 },
    bellDot: { position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: '#e53935', borderWidth: 1.5, borderColor: c.surface },
    moreBtn: { marginLeft: 12, padding: 4 },
    moreIcon: { fontSize: 18, fontWeight: '800', color: c.primary, letterSpacing: 1 },
    errorBanner: {
      backgroundColor: '#fbe9e7', marginHorizontal: 16, marginBottom: 8,
      borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#e53935',
    },
    errorBannerText: { fontSize: 13, color: '#c62828', fontWeight: '600' },
    vehicleCard: {
      backgroundColor: c.primary, margin: 16, marginBottom: 10, borderRadius: 14,
      overflow: 'hidden', padding: 0,
    },
    vehicleCardPhoto: { width: '100%', height: 150 },
    vehiclePhotoOverlay: {
      position: 'absolute', bottom: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    vehiclePhotoOverlayText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    vehiclePhotoAdd: {
      paddingVertical: 10, alignItems: 'center',
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
    },
    vehiclePhotoAddText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    vehicleNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 20, paddingHorizontal: 20 },
    vehicleName: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
    editVehicleBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    editVehicleBtnText: { fontSize: 12, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
    vehicleRow: { flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'center', paddingHorizontal: 20 },
    vehicleDetail: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
    mileageRow: { flexDirection: 'row', alignItems: 'center' },
    mileageUpdatePill: {
      marginLeft: 8, paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 20, borderWidth: 1.5,
    },
    mileageEditHint: { fontSize: 12, color: '#fff', fontWeight: '600' },
    mileageEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    mileageInput: {
      flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5,
      fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    },
    mileageSaveBtn: {
      backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    mileageSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    mileageCancelBtn: {
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    mileageCancelBtnText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
    quickActions: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      paddingHorizontal: 20, paddingBottom: 20,
    },
    quickBtn: {
      flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    },
    quickBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    quickBtnEmphasis: { backgroundColor: c.accent },
    quickBtnTextEmphasis: { color: '#14293F', fontWeight: '700' },

    sparkRow: {
      flexDirection: 'row', gap: 10,
      marginHorizontal: 16, marginBottom: 10,
    },
    sparkCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 12,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    sparkTitle: { fontSize: 11, fontWeight: '700', color: c.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
    sparkValue: { fontSize: 16, fontWeight: '800', color: c.text, marginTop: 6 },
    sparkUnit: { fontSize: 11, fontWeight: '500', color: c.textMuted },
    sparkTrend: { fontSize: 11, fontWeight: '600', marginTop: 3 },

    historyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, marginHorizontal: 16, marginTop: 12, marginBottom: 8,
      borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
      borderWidth: 1.5, borderColor: c.border,
      elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    },
    historyBtnText: { fontSize: 15, fontWeight: '700', color: c.text },
    historyBtnArrow: { fontSize: 20, color: c.primary, fontWeight: '300' },
    loader: { marginTop: 40 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    tag: {
      backgroundColor: c.primaryTint, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200,
    },
    tagText: { fontSize: 13, color: c.text, fontWeight: '500' },
    tagMore: {
      backgroundColor: c.primaryTint, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    tagMoreText: { fontSize: 13, color: c.primary, fontWeight: '600' },

    renewalSection: { marginHorizontal: 16, marginBottom: 10 },
    renewalCard: {
      borderRadius: 10, padding: 14, flexDirection: 'row',
      alignItems: 'center', borderLeftWidth: 4, marginBottom: 10,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    renewalLeft: { flex: 1 },
    renewalTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    renewalDays: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
    renewalDate: { fontSize: 11, color: c.textMuted },
    renewalArrow: { fontSize: 22, fontWeight: '300', marginLeft: 8 },

    transferBanner: {
      backgroundColor: '#fff3e0', marginHorizontal: 16, marginBottom: 10,
      borderRadius: 10, padding: 14, flexDirection: 'row',
      alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#e65100',
    },
    transferBannerLeft: { flex: 1 },
    transferBannerTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 2 },
    transferBannerSub: { fontSize: 12, color: '#795548' },
    cancelTransferBtn: {
      borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10,
    },
    cancelTransferBtnDisabled: { opacity: 0.5 },
    cancelTransferBtnText: { fontSize: 12, color: '#c62828', fontWeight: '700' },
    predCard: {
      backgroundColor: c.surface, marginHorizontal: 16, marginBottom: 10,
      borderRadius: 12, padding: 14,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    predCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    predCardTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    predCardLink: { fontSize: 13, color: c.primary, fontWeight: '600' },
    predAllOk: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
    predItem: {
      flexDirection: 'row', alignItems: 'center',
      padding: 12, borderRadius: 10, borderLeftWidth: 4, marginTop: 8,
    },
    predItemName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    predItemDetail: { fontSize: 12, color: c.textMuted },
    predItemBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
    predItemBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

    submissionsSection: { marginHorizontal: 16, marginTop: 10, marginBottom: 8 },
    submissionsSectionTitle: {
      fontSize: 14, fontWeight: '800', color: '#c62828',
      marginBottom: 10, letterSpacing: 0.3,
    },
    submissionCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14,
      marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#c62828',
      borderWidth: 1, borderColor: c.borderMid,
    },
    submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
    submissionGarage: { fontSize: 14, fontWeight: '700', color: c.text, flex: 1 },
    submissionDate: { fontSize: 12, color: c.textMuted },
    submissionMeta: { fontSize: 12, color: c.textSub, marginTop: 4 },
    submissionCost: { fontSize: 14, fontWeight: '700', color: '#e65100', marginTop: 6 },
    submissionNotes: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 4 },
    submissionActions: {
      flexDirection: 'row', gap: 10, marginTop: 14,
    },
    acceptBtn: {
      backgroundColor: '#2e7d32', borderRadius: 10,
      paddingVertical: 14, alignItems: 'center', marginTop: 14,
    },
    acceptBtnFlex: { flex: 1, marginTop: 0 },
    acceptBtnDisabled: { opacity: 0.5 },
    acceptBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
    rejectBtn: {
      flex: 1, borderWidth: 1.5, borderColor: '#c62828', borderRadius: 10,
      paddingVertical: 14, alignItems: 'center',
    },
    rejectBtnText: { color: '#c62828', fontSize: 15, fontWeight: '700' },
    messagesToggle: {
      paddingVertical: 10, alignItems: 'center', marginTop: 6,
      borderTopWidth: 1, borderTopColor: '#ffcdd2',
    },
    messagesToggleText: { fontSize: 13, color: c.primary, fontWeight: '600' },
    messagesSection: {
      marginTop: 6, backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 10,
    },
    noMessages: { fontSize: 13, color: c.textFaint, textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },
    messageItem: {
      backgroundColor: c.primaryTint, borderRadius: 8, padding: 10, marginBottom: 6, alignSelf: 'flex-end', maxWidth: '85%',
    },
    messageItemThem: { backgroundColor: c.border, alignSelf: 'flex-start' },
    messageSender: { fontSize: 10, color: c.textMuted, marginBottom: 2, fontWeight: '600' },
    messageText: { fontSize: 13, color: c.text, lineHeight: 18 },
    messageTime: { fontSize: 10, color: c.textFaint, marginTop: 3, alignSelf: 'flex-end' },
    messageInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    messageInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 9,
      fontSize: 13, borderWidth: 1, borderColor: c.borderMid, color: c.text, letterSpacing: 0,
    },
    messageSendBtn: {
      backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    messageSendBtnDisabled: { opacity: 0.4 },
    messageSendBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

    appointmentsSection: { marginHorizontal: 16, marginBottom: 10 },
    appointmentsSectionTitle: {
      fontSize: 14, fontWeight: '800', color: c.primary,
      marginBottom: 10, letterSpacing: 0.3,
    },
    appointmentCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14,
      marginBottom: 8, borderLeftWidth: 4,
      borderWidth: 1, borderColor: c.borderMid,
    },
    appointmentHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    appointmentGarage: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 3 },
    appointmentDateTime: { fontSize: 13, color: c.textSub },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
    statusBadgeText: { fontSize: 12, fontWeight: '700' },
    serviceTypeChip: {
      alignSelf: 'flex-start', backgroundColor: c.primaryTint, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
    },
    serviceTypeChipText: { fontSize: 12, color: c.primary, fontWeight: '600' },
    appointmentNotes: { fontSize: 12, color: c.textSub, fontStyle: 'italic', marginBottom: 8 },
    appointmentActions: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
    },
    messagesToggleSmall: { paddingVertical: 6, paddingHorizontal: 4 },
    messagesToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    messagesToggleSmallText: { fontSize: 13, color: c.primary, fontWeight: '600' },
    msgDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#e53935',
    },
    cancelBkBtn: {
      borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    cancelBkBtnDisabled: { opacity: 0.5 },
    cancelBkBtnText: { fontSize: 12, color: '#c62828', fontWeight: '700' },
    counterOfferCard: {
      backgroundColor: '#e3f2fd', borderRadius: 10, padding: 12,
      marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#1565c0',
    },
    counterOfferTitle: { fontSize: 12, color: '#1565c0', fontWeight: '700', marginBottom: 4 },
    counterOfferDate: { fontSize: 15, fontWeight: '700', color: '#0d3c6b', marginBottom: 10 },
    counterOfferActions: { flexDirection: 'row', gap: 10 },
    counterAcceptBtn: {
      flex: 1, backgroundColor: '#2e7d32', borderRadius: 8,
      paddingVertical: 9, alignItems: 'center',
    },
    counterAcceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    counterDeclineBtn: {
      flex: 1, borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
      paddingVertical: 9, alignItems: 'center',
    },
    counterDeclineBtnText: { color: '#c62828', fontSize: 13, fontWeight: '700' },
    photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    recordThumb: { width: 72, height: 72, borderRadius: 8 },
    thumbCountBadge: {
      position: 'absolute', bottom: 4, right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
      paddingHorizontal: 5, paddingVertical: 2,
    },
    thumbCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    progressCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    progressCardTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    progressCardPct: { fontSize: 14, fontWeight: '800', color: c.primary },
    progressBarTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, marginBottom: 10 },
    progressBarFill: { height: 6, backgroundColor: c.primary, borderRadius: 3 },
    progressHint: { fontSize: 12, color: c.textSub, marginTop: 3, paddingLeft: 4 },

    moreSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    moreSheetCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
    moreSheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    moreSheetTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    moreSheetClose: { fontSize: 18, color: c.textMuted, fontWeight: '700' },
    moreSheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    moreSheetIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    moreSheetIconText: { fontSize: 15 },
    moreSheetItemText: { fontSize: 14, fontWeight: '600', color: c.text },

    editVehicleOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    editVehicleCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%' },
    editVehicleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    editVehicleTitle: { fontSize: 17, fontWeight: '800', color: c.text },
    editVehicleClose: { fontSize: 18, color: c.textMuted, fontWeight: '700' },
    editVehicleLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    editVehicleInput: { backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: c.text },
    fuelTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    fuelTypeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: c.border, borderWidth: 1, borderColor: c.borderMid },
    fuelTypeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    fuelTypeChipText: { fontSize: 13, color: c.textSub, fontWeight: '600' },
    fuelTypeChipTextActive: { color: '#fff' },
    vehicleTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    vehicleTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: c.border, borderWidth: 1, borderColor: c.borderMid },
    vehicleTypeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    vehicleTypeChipIcon: { fontSize: 14 },
    vehicleTypeChipText: { fontSize: 12, color: c.textSub, fontWeight: '600' },
    vehicleTypeChipTextActive: { color: '#fff' },
    profileCard: {
      backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, marginTop: 12, marginBottom: 10,
      padding: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
    },
    profileDivider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
    profileCardRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
    profileStat: { alignItems: 'center', flex: 1 },
    profileStatLabel: { fontSize: 10, color: c.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    profileStatValue: { fontSize: 14, fontWeight: '700', color: c.text },
    profileNotes: { fontSize: 13, color: c.textSub, fontStyle: 'italic', marginTop: 8, lineHeight: 18, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 },
    editVehicleSaveBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
    editVehicleSaveBtnDisabled: { opacity: 0.6 },
    editVehicleSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    editSectionDivider: { height: 1, backgroundColor: c.border, marginVertical: 20 },
    editSectionTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 },
    photoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
    photoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 12 },
    photoModalLabel: { color: '#fff', fontSize: 13, flex: 1, marginRight: 12 },
    photoModalCloseText: { color: '#fff', fontSize: 22, fontWeight: '700' },
    photoModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 18 },
    photoCounter: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 50, textAlign: 'center' },
    photoNavBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    photoNavBtnDisabled: { opacity: 0.25 },
    photoNavText: { color: '#fff', fontSize: 36, lineHeight: 38, fontWeight: '300' },
    familyShareList: { marginBottom: 10 },
    familyShareRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    familySharePhone: { fontSize: 14, fontWeight: '600', color: c.text },
    familyShareStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    revokeBtn: {
      borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    revokeBtnText: { fontSize: 12, color: '#c62828', fontWeight: '700' },
    familyShareInputRow: { flexDirection: 'row', gap: 8 },
    familyShareInput: {
      flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: c.text, borderWidth: 1, borderColor: c.borderMid,
    },
    familyShareBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
    },
    familyShareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    ratingSubtitle: { fontSize: 14, color: c.textSub, marginBottom: 16 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
    starIcon: { fontSize: 32 },
    ratingCommentInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text,
      minHeight: 64, textAlignVertical: 'top', marginBottom: 16,
    },
    ratingBtnRow: { flexDirection: 'row', gap: 12 },
    ratingSkipBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid,
    },
    ratingSkipBtnText: { fontSize: 14, fontWeight: '700', color: c.textSub },
    ratingSubmitBtn: {
      flex: 2, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    },
    ratingSubmitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  })
}
