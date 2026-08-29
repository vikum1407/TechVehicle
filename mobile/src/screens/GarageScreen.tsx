import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import DateField from '../components/DateField'
import Button from '../components/Button'
import {
  SelectedItem, NO_BRAND_ITEMS, ITEM_BRANDS, CATEGORY_BRANDS,
  getServiceCategories, todayDMY, parseDMY,
} from '../constants/serviceData'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  focusBookingId?: string | null
  onMessageCountChange?: (count: number) => void
  onFocusHandled?: () => void
  bookingSeenCounts?: Record<string, number>
  onBookingSeen?: (bookingId: string, count: number) => void
  notifUnread?: boolean
  onNotifPress?: () => void
  onNotifSeen?: (newCount: number) => void
  onRegistered?: () => void
  onBack?: () => void
  onOpenLedger?: (vehicleId?: string) => void
  initialTab?: 'profile' | 'customers' | 'history'
}

type Garage = {
  id: string
  name: string
  address: string | null
  brNumber: string | null
  verified: boolean
  createdAt: string
  priceList?: { service: string; price: number }[] | null
  avgRating?: number | null
  ratingCount?: number
}

type SharedRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type IncomingShare = {
  id: string
  vehicleId: string
  createdAt: string
  ownerPhone: string
  avgFuelEfficiency: number | null
  totalServiceCost: number
  vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    fuelType: string
    vehicleType?: string | null
    mileage: number
  }
  records: SharedRecord[]
}

type Tab = 'profile' | 'schedule' | 'bookings' | 'calendar' | 'customers' | 'history'

const DOW_KEYS: TranslationKey[] = [
  'garage.dow.sun', 'garage.dow.mon', 'garage.dow.tue', 'garage.dow.wed',
  'garage.dow.thu', 'garage.dow.fri', 'garage.dow.sat',
]

type Customer = {
  vehicleId: string; registrationNo: string; make: string; model: string; year: number
  jobCount: number; totalRevenue: number; lastServiceDate: string | null
  prediction: { name: string; status: string; remainingKm: number | null; remainingDays: number | null } | null
  lastReminderSentAt: string | null
}

type CompletedJob = {
  id: string; status: string; createdAt: string
  description: string; cost: number | null; mileage: number | null
  categories: string[]
  vehicle: { registrationNo: string; make: string; model: string; year: number }
}

type CalendarOverride = {
  id: string
  date: string
  status: string
  maxSlots: number | null
  message: string | null
  messageColor: string | null
}

type Booking = {
  id: string
  date: string
  status: string
  notes: string | null
  ownerPhone: string
  vehicleId: string
  vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    mileage: number
    fuelType?: string
    vehicleType?: string | null
  }
  _count?: { bookingNotes: number }
}

type BookingNote = {
  id: string
  senderPhone: string
  message: string
  createdAt: string
}

export default function GarageScreen({ token, focusBookingId, onMessageCountChange, onFocusHandled, bookingSeenCounts = {}, onBookingSeen, notifUnread, onNotifPress, onNotifSeen, onRegistered, onBack, onOpenLedger, initialTab }: Props) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>(initialTab ?? 'profile')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const tabScrollRef = useRef<ScrollView>(null)
  const tabLayouts = useRef<Partial<Record<Tab, { x: number; width: number }>>>({})
  const bookingsScrollRef = useRef<ScrollView>(null)
  const bookingLayouts = useRef<Record<string, number>>({})
  const [shares, setShares] = useState<IncomingShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [expandedShare, setExpandedShare] = useState<string | null>(null)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [counterModal, setCounterModal] = useState<{ bookingId: string } | null>(null)
  const [counterDate, setCounterDate] = useState('')
  const [counterSlot, setCounterSlot] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const [submittingCounter, setSubmittingCounter] = useState(false)
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)
  const [bookingNotesMap, setBookingNotesMap] = useState<Record<string, BookingNote[]>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [sendingNote, setSendingNote] = useState<string | null>(null)
  const [loadingNotesId, setLoadingNotesId] = useState<string | null>(null)
  const [expandedMessagesSet, setExpandedMessagesSet] = useState<Set<string>>(new Set())

  // Schedule tab state
  const [schedWorkDays, setSchedWorkDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [schedMaxPerDay, setSchedMaxPerDay] = useState(5)
  const [schedSlots, setSchedSlots] = useState<string[]>(['Morning', 'Afternoon'])
  const [newSlot, setNewSlot] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Calendar override state
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [overrides, setOverrides] = useState<CalendarOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)
  const [editingOverride, setEditingOverride] = useState<{
    date: string
    displayDate: string
    existing: CalendarOverride | null
  } | null>(null)
  const [ovStatus, setOvStatus] = useState<'open' | 'closed' | 'holiday'>('closed')
  const [ovMaxSlots, setOvMaxSlots] = useState('')
  const [ovMessage, setOvMessage] = useState('')
  const [ovColor, setOvColor] = useState('#FF9800')
  const [savingOverride, setSavingOverride] = useState(false)

  // History / Revenue tab state
  const [historyJobs, setHistoryJobs] = useState<CompletedJob[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Customers tab state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [walkinOpen, setWalkinOpen] = useState(false)
  const [walkinRegNo, setWalkinRegNo] = useState('')
  const [walkinLookupLoading, setWalkinLookupLoading] = useState(false)
  const [walkinResult, setWalkinResult] = useState<{
    id: string; registrationNo: string; make: string; model: string; year: number
    mileage: number; fuelType: string; vehicleType: string | null
  } | null>(null)
  const [isWalkIn, setIsWalkIn] = useState(false)

  // Garage profile form
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [brNumber, setBrNumber] = useState('')
  const [priceListRows, setPriceListRows] = useState<{ service: string; price: string }[]>([])
  const [ratingsModalOpen, setRatingsModalOpen] = useState(false)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [ratingsDetail, setRatingsDetail] = useState<{
    avgRating: number | null; ratingCount: number
    distribution: Record<string, number>
    reviews: { rating: number; comment: string | null; createdAt: string }[]
  } | null>(null)

  // Full submission form — shown when a share is being submitted
  const [submittingShare, setSubmittingShare] = useState<IncomingShare | null>(null)
  const [submittingBookingId, setSubmittingBookingId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [otherText, setOtherText] = useState('')
  const [customBrands, setCustomBrands] = useState<Record<string, string>>({})
  const [subDate, setSubDate] = useState(todayDMY())
  const [subMileage, setSubMileage] = useState('')
  const [subCost, setSubCost] = useState('')
  const [subNotes, setSubNotes] = useState('')
  const [subPhotos, setSubPhotos] = useState<string[]>([])
  const [uploadingSubPhoto, setUploadingSubPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const { t } = useTranslation()

  useEffect(() => {
    api.getGarage(token)
      .then(data => {
        setGarage(data)
        setName(data.name)
        setAddress(data.address || '')
        setBrNumber(data.brNumber || '')
      })
      .catch(e => {
        if (!e.message.includes('No garage')) Alert.alert(t('common.error'), e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadShares = async () => {
    setSharesLoading(true)
    try {
      const data = await api.getIncomingShares(token)
      setShares(data)
    } catch (e: any) {
      if (!e.message.includes('No garage')) Alert.alert(t('common.error'), e.message)
    } finally {
      setSharesLoading(false)
    }
  }

  const loadBookings = async () => {
    setBookingsLoading(true)
    try {
      const data = await api.getGarageBookings(token)
      setBookings(data)
    } catch (e: any) {
      if (!e.message.includes('No garage')) Alert.alert(t('common.error'), e.message)
    } finally {
      setBookingsLoading(false)
    }
  }

  const handleConfirmBooking = async (bookingId: string) => {
    setConfirmingId(bookingId)
    try {
      await api.confirmBooking(token, bookingId)
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b))
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setConfirmingId(null)
    }
  }

  const handleCounterSubmit = async () => {
    if (!counterModal || !counterDate) return
    setSubmittingCounter(true)
    try {
      await api.counterBooking(token, counterModal.bookingId, counterDate, counterSlot || null, counterNote.trim() || undefined)
      setBookings(prev => prev.map(b => b.id === counterModal.bookingId ? { ...b, status: 'counter_suggested' } : b))
      setCounterModal(null)
      setCounterDate('')
      setCounterSlot('')
      setCounterNote('')
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSubmittingCounter(false)
    }
  }

  const loadBookingNotes = async (bookingId: string): Promise<BookingNote[]> => {
    setLoadingNotesId(bookingId)
    try {
      const notes = await api.getBookingNotes(token, bookingId)
      setBookingNotesMap(prev => ({ ...prev, [bookingId]: notes }))
      return notes
    } catch { return [] }
    finally { setLoadingNotesId(null) }
  }

  const handleSendNote = async (bookingId: string) => {
    const msg = (noteInputs[bookingId] || '').trim()
    if (!msg) return
    setSendingNote(bookingId)
    try {
      const note = await api.addBookingNote(token, bookingId, msg)
      const currentNotes = bookingNotesMap[bookingId] || []
      const updated = [...currentNotes, note]
      setBookingNotesMap(prev => ({ ...prev, [bookingId]: updated }))
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, _count: { bookingNotes: updated.length } } : b
      ))
      onBookingSeen?.(bookingId, updated.length)
      setNoteInputs(prev => ({ ...prev, [bookingId]: '' }))
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSendingNote(null)
    }
  }

  const handleExpandBooking = (bookingId: string) => {
    const next = expandedBooking === bookingId ? null : bookingId
    setExpandedBooking(next)
  }

  const toggleMessages = async (bookingId: string) => {
    if (expandedMessagesSet.has(bookingId)) {
      setExpandedMessagesSet(prev => { const s = new Set(prev); s.delete(bookingId); return s })
      return
    }
    setExpandedMessagesSet(prev => new Set(prev).add(bookingId))
    const notes = await loadBookingNotes(bookingId)
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, _count: { bookingNotes: notes.length } } : b
    ))
    onBookingSeen?.(bookingId, notes.length)
    // Sync bell dot: mark any DB notification for this booking as read
    api.markBookingNotifsRead(token, bookingId)
      .then(({ count }) => onNotifSeen?.(count))
      .catch(() => {})
  }

  const loadSchedule = async () => {
    if (!garage) return
    try {
      const data = await api.getGarageAvailability(token, garage.id)
      setSchedWorkDays(JSON.parse(data.workDays || '[1,2,3,4,5]'))
      setSchedMaxPerDay(data.maxPerDay ?? 5)
      setSchedSlots(JSON.parse(data.timeSlots || '["Morning","Afternoon"]'))
    } catch {}
  }

  const loadOverrides = async (month: Date) => {
    if (!garage) return
    setOverridesLoading(true)
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    try {
      const data = await api.getCalendarOverrides(token, garage.id, monthStr)
      setOverrides(data)
    } catch {} finally {
      setOverridesLoading(false)
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await api.getGarageHistory(token)
      setHistoryJobs(data.filter((j: CompletedJob) => j.status === 'accepted'))
    } catch {} finally {
      setHistoryLoading(false)
    }
  }

  const loadCustomers = async () => {
    setCustomersLoading(true)
    try {
      const data = await api.getGarageCustomers(token)
      setCustomers(data)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setCustomersLoading(false)
    }
  }

  const handleRemind = async (vehicleId: string) => {
    setRemindingId(vehicleId)
    try {
      await api.sendServiceReminder(token, vehicleId)
      setCustomers(prev => prev.map(c => c.vehicleId === vehicleId ? { ...c, lastReminderSentAt: new Date().toISOString() } : c))
      Alert.alert(t('garage.reminderSent.title'), t('garage.reminderSent.message'))
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setRemindingId(null)
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      await api.setAvailability(token, schedWorkDays, schedMaxPerDay, schedSlots)
      Alert.alert(t('logEmissionTest.saved.title'), t('garage.scheduleSaved'))
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  const openOverrideEditor = (dateStr: string, displayDate: string) => {
    const existing = overrides.find(o => o.date === dateStr) || null
    setOvStatus((existing?.status as any) || 'closed')
    setOvMaxSlots(existing?.maxSlots?.toString() || '')
    setOvMessage(existing?.message || '')
    setOvColor(existing?.messageColor || '#FF9800')
    setEditingOverride({ date: dateStr, displayDate, existing })
  }

  const handleSaveOverride = async () => {
    if (!editingOverride) return
    setSavingOverride(true)
    try {
      await api.setCalendarOverride(token, {
        date: editingOverride.date,
        status: ovStatus,
        maxSlots: ovMaxSlots ? parseInt(ovMaxSlots) : null,
        message: ovMessage.trim() || undefined,
        messageColor: ovColor,
      })
      await loadOverrides(calMonth)
      setEditingOverride(null)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSavingOverride(false)
    }
  }

  const handleRemoveOverride = async () => {
    if (!editingOverride?.existing) return
    setSavingOverride(true)
    try {
      await api.deleteCalendarOverride(token, editingOverride.date)
      await loadOverrides(calMonth)
      setEditingOverride(null)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSavingOverride(false)
    }
  }

  // When a push notification brings the user here with a specific booking, switch to bookings and open messages
  useEffect(() => {
    if (!focusBookingId || !garage) return
    setTab('bookings')
    const focusAndLoad = async () => {
      setExpandedBooking(focusBookingId)
      setExpandedMessagesSet(prev => new Set(prev).add(focusBookingId))
      const notes = await loadBookingNotes(focusBookingId)
      onBookingSeen?.(focusBookingId, notes.length)
      onFocusHandled?.()
      // Give the card time to render/expand before measuring its position
      setTimeout(() => {
        const y = bookingLayouts.current[focusBookingId]
        if (y != null) {
          bookingsScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true })
        }
      }, 300)
    }
    if (bookings.length === 0) {
      loadBookings().then(focusAndLoad)
    } else {
      focusAndLoad()
    }
  }, [focusBookingId, garage])

  useEffect(() => {
    const total = bookings.reduce((sum, b) => {
      const unread = Math.max(0, (b._count?.bookingNotes ?? 0) - (bookingSeenCounts[b.id] ?? 0))
      return sum + unread
    }, 0)
    onMessageCountChange?.(total)
  }, [bookingSeenCounts, bookings])

  useEffect(() => {
    if (tab === 'bookings' && garage) { loadBookings(); loadShares() }
    if (tab === 'schedule' && garage) { loadSchedule(); loadOverrides(calMonth) }
    if (tab === 'calendar' && garage) { loadBookings(); loadSchedule(); loadOverrides(calMonth) }
    if (tab === 'history' && garage) { loadHistory() }
    if (tab === 'customers' && garage) { loadCustomers() }
  }, [tab, garage])

  // Keep the active tab fully in view when tabs overflow the screen width
  useEffect(() => {
    const layout = tabLayouts.current[tab]
    if (layout) {
      tabScrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 16), animated: true })
    }
  }, [tab])

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert(t('garage.nameRequired.title'), t('garage.nameRequired.message')); return }
    setSaving(true)
    try {
      const data = await api.registerGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
      setTab('schedule')
      onRegistered?.()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!name.trim()) { Alert.alert(t('garage.nameRequired.title'), t('garage.nameRequired.message')); return }
    setSaving(true)
    try {
      const priceList = priceListRows
        .filter(r => r.service.trim() && r.price.trim() && !isNaN(Number(r.price)))
        .map(r => ({ service: r.service.trim(), price: Number(r.price) }))
      const data = await api.updateGarage(token, { name, address, brNumber, priceList })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSaving(false)
    }
  }

  const openRatingsModal = async () => {
    if (!garage) return
    setRatingsModalOpen(true)
    setRatingsLoading(true)
    try {
      const data = await api.getGarageRatings(token, garage.id)
      setRatingsDetail(data)
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setRatingsLoading(false)
    }
  }

  const openSubmitForm = (share: IncomingShare) => {
    setSubmittingShare(share)
    setSelectedItems([])
    setOtherText('')
    setCustomBrands({})
    setSubDate(todayDMY())
    setSubMileage(share.vehicle.mileage.toString())
    setSubCost('')
    setSubNotes('')
  }

  const openSubmitFormFromBooking = (booking: Booking) => {
    const mockShare: IncomingShare = {
      id: '',
      vehicleId: booking.vehicleId,
      createdAt: booking.date,
      ownerPhone: booking.ownerPhone,
      avgFuelEfficiency: null,
      totalServiceCost: 0,
      vehicle: {
        registrationNo: booking.vehicle.registrationNo,
        make: booking.vehicle.make,
        model: booking.vehicle.model,
        year: booking.vehicle.year,
        fuelType: booking.vehicle.fuelType || 'Petrol',
        vehicleType: booking.vehicle.vehicleType,
        mileage: booking.vehicle.mileage,
      },
      records: [],
    }
    openSubmitForm(mockShare)
    setSubmittingBookingId(booking.id)
  }

  const handleWalkinLookup = async () => {
    if (!walkinRegNo.trim()) return
    setWalkinLookupLoading(true)
    setWalkinResult(null)
    try {
      const result = await api.lookupVehicle(token, walkinRegNo.trim())
      setWalkinResult(result)
    } catch (e: any) {
      Alert.alert(t('garage.notFound'), e.message)
    } finally {
      setWalkinLookupLoading(false)
    }
  }

  const openSubmitFormFromWalkin = () => {
    if (!walkinResult) return
    const mockShare: IncomingShare = {
      id: '',
      vehicleId: walkinResult.id,
      createdAt: new Date().toISOString(),
      ownerPhone: '',
      avgFuelEfficiency: null,
      totalServiceCost: 0,
      vehicle: {
        registrationNo: walkinResult.registrationNo,
        make: walkinResult.make,
        model: walkinResult.model,
        year: walkinResult.year,
        fuelType: walkinResult.fuelType || 'Petrol',
        vehicleType: walkinResult.vehicleType,
        mileage: walkinResult.mileage,
      },
      records: [],
    }
    openSubmitForm(mockShare)
    setIsWalkIn(true)
    setWalkinOpen(false)
    setWalkinRegNo('')
    setWalkinResult(null)
  }

  const isSelected = (name: string) => selectedItems.some(i => i.name === name)

  const toggleService = (itemName: string, category: string) => {
    if (isSelected(itemName)) {
      setSelectedItems(prev => prev.filter(i => i.name !== itemName))
    } else {
      setSelectedItems(prev => [...prev, { name: itemName, category, brand: '' }])
    }
  }

  const setBrandForItem = (itemName: string, brand: string) => {
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand } : i))
    setCustomBrands(prev => ({ ...prev, [itemName]: '' }))
  }

  const setCustomBrandForItem = (itemName: string, value: string) => {
    setCustomBrands(prev => ({ ...prev, [itemName]: value }))
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand: value } : i))
  }

  const pickSubPhoto = async (source: 'camera' | 'gallery') => {
    if (subPhotos.length >= 5) {
      Alert.alert(t('garage.photoLimitReached.title'), t('garage.photoLimitReached.message'))
      return
    }
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        t('addService.permissionNeeded.title'),
        t('addService.permissionNeeded.message', { source: t(source === 'camera' ? 'addService.cameraAccess' : 'addService.galleryAccess') })
      )
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    setUploadingSubPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const url = await api.uploadPhoto(token, compressed.uri)
      setSubPhotos(prev => [...prev, url])
    } catch (e: any) {
      Alert.alert(t('addService.uploadFailed.title'), e.message || t('addService.uploadFailed.message'))
    } finally {
      setUploadingSubPhoto(false)
    }
  }

  const handleSubmitService = async () => {
    if (!submittingShare) return
    const extras = otherText.trim()
      ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }]
      : []
    const allItems = [...selectedItems, ...extras]
    if (allItems.length === 0) {
      Alert.alert(t('garage.selectService.title'), t('garage.selectService.message'))
      return
    }
    const isoDate = parseDMY(subDate)
    if (!isoDate) {
      Alert.alert(t('addService.invalidDate.title'), t('addService.invalidDate.message'))
      return
    }

    if (!subMileage.trim()) {
      Alert.alert(t('addService.mileageRequired.title'), t('garage.mileageRequiredMessage'))
      return
    }
    const subMileageNum = parseInt(subMileage)
    if (isNaN(subMileageNum) || subMileageNum <= 0) {
      Alert.alert(t('addService.invalidMileage.title'), t('addService.invalidMileage.message'))
      return
    }

    if (!subCost.trim()) {
      Alert.alert(t('addService.costRequired.title'), t('addService.costRequired.message'))
      return
    }
    if (isNaN(parseFloat(subCost)) || parseFloat(subCost) <= 0) {
      Alert.alert(t('addService.invalidCost.title'), t('addService.invalidCost.message'))
      return
    }

    const description = allItems
      .map(i => i.brand ? `${i.name} (${i.brand})` : i.name)
      .join(', ')
    const categories = Array.from(new Set(allItems.map(i => i.category)))

    setSubmitting(true)
    try {
      if (isWalkIn) {
        await api.submitWalkinService(token, {
          vehicleId: submittingShare.vehicleId,
          description,
          mileage: subMileageNum,
          cost: subCost ? parseFloat(subCost) : undefined,
          notes: subNotes.trim() || undefined,
          photos: subPhotos.length > 0 ? subPhotos : undefined,
          categories,
        })
      } else {
        const isFromBooking = !!submittingBookingId
        await api.submitService(token, {
          shareSessionId: isFromBooking ? undefined : submittingShare.id,
          bookingId: submittingBookingId || undefined,
          vehicleId: submittingShare.vehicleId,
          description,
          mileage: subMileageNum,
          cost: subCost ? parseFloat(subCost) : undefined,
          notes: subNotes.trim() || undefined,
          photos: subPhotos.length > 0 ? subPhotos : undefined,
          categories,
        })
        const trackKey = submittingBookingId ? `booking_${submittingBookingId}` : submittingShare.id
        setSubmittedIds(prev => new Set(prev).add(trackKey))
      }
      setSubmittingBookingId(null)
      setSubmittingShare(null)
      setSubPhotos([])
      setIsWalkIn(false)
      Alert.alert(t('garage.serviceSubmitted.title'), t('garage.serviceSubmitted.message'))
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const parseServices = (desc: string) =>
    desc.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  // ── Full-screen submission form ──────────────────────────────────────────
  if (submittingShare) {
    const share = submittingShare
    const itemsNeedingBrand = selectedItems.filter(i => !NO_BRAND_ITEMS.has(i.name))

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <ScreenHeader title={t('garage.submitCompletedService')} onBack={() => { setSubmittingShare(null); setIsWalkIn(false) }} />
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

        {/* Which vehicle */}
        <View style={styles.vehicleBanner}>
          <Text style={styles.vehicleBannerReg}>{share.vehicle.registrationNo}</Text>
          <Text style={styles.vehicleBannerName}>
            {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
          </Text>
          <Text style={styles.vehicleBannerMileage}>{share.vehicle.mileage.toLocaleString()} km · {share.vehicle.fuelType}</Text>
        </View>

        <Text style={styles.formSubtitle}>{t('garage.tapEverythingVisit')}</Text>

        {getServiceCategories(submittingShare?.vehicle?.vehicleType).map(cat => (
          <View key={cat.title}>
            <Text style={styles.catLabel}>{cat.title}</Text>
            <View style={styles.chipRow}>
              {cat.items.map(item => {
                const sel = isSelected(item)
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => toggleService(item, cat.title)}
                    activeOpacity={0.7}
                  >
                    {sel && <Text style={styles.check}>✓ </Text>}
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}

        <Text style={styles.catLabel}>{t('addService.other')}</Text>
        <TextInput
          style={styles.fInput}
          value={otherText}
          onChangeText={setOtherText}
          placeholder={t('addService.otherPlaceholder')}
        />

        {itemsNeedingBrand.length > 0 && (
          <View style={styles.brandsSection}>
            <Text style={styles.brandsSectionTitle}>{t('addService.partsBrand')}</Text>
            <Text style={styles.brandsSectionSub}>{t('addService.selectBrandSub')}</Text>
            {itemsNeedingBrand.map(item => {
              const brands = ITEM_BRANDS[item.name] || CATEGORY_BRANDS[item.category] || CATEGORY_BRANDS['General & Other']
              return (
                <View key={item.name} style={styles.brandRow}>
                  <Text style={styles.brandItemName}>{item.name}</Text>
                  <View style={styles.chipRow}>
                    {brands.map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.brandChip, item.brand === b && styles.brandChipSelected]}
                        onPress={() => setBrandForItem(item.name, b)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.brandChipText, item.brand === b && styles.brandChipTextSelected]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.fInput, { marginTop: 6 }]}
                    value={customBrands[item.name] || ''}
                    onChangeText={v => setCustomBrandForItem(item.name, v)}
                    placeholder={t('addService.orTypeBrand')}
                  />
                </View>
              )
            })}
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <DateField label={t('garage.serviceDate')} value={subDate} onChange={setSubDate} maximumDate={new Date()} />
          </View>
          <View style={styles.half}>
            <FormField
              label={t('addService.mileage')}
              required
              value={subMileage}
              onChangeText={setSubMileage}
              placeholder="e.g. 45000"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <FormField
          label={t('addService.totalCost')}
          required
          value={subCost}
          onChangeText={setSubCost}
          placeholder="e.g. 8500"
          keyboardType="number-pad"
        />

        <FormField
          label={t('garage.notesForOwner')}
          style={styles.multiline}
          value={subNotes}
          onChangeText={setSubNotes}
          placeholder={t('garage.notesForOwnerPlaceholder')}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.fieldLabel}>{t('addService.photos')}</Text>
        <View style={styles.photoRow}>
          {subPhotos.map((url) => (
            <View key={url} style={styles.photoThumb}>
              <Image source={{ uri: url }} style={styles.thumbImg} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => setSubPhotos(prev => prev.filter(p => p !== url))}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {subPhotos.length < 5 && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickSubPhoto('camera')}
                disabled={uploadingSubPhoto}
              >
                {uploadingSubPhoto
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.photoBtnText}>📷 {t('addService.cameraBtn')}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickSubPhoto('gallery')}
                disabled={uploadingSubPhoto}
              >
                <Text style={styles.photoBtnText}>🖼 {t('addService.galleryBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {selectedItems.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{t('garage.servicesToSubmit', { count: selectedItems.length, s: selectedItems.length > 1 ? 's' : '' })}</Text>
            {selectedItems.map(i => (
              <Text key={i.name} style={styles.summaryLine}>
                • {i.name}{i.brand ? ` — ${i.brand}` : ''}
              </Text>
            ))}
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Button title={t('garage.submitToOwner')} onPress={handleSubmitService} loading={submitting} />
        </View>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Override editor (full-screen) ───────────────────────────────────────
  if (editingOverride) {
    const colorOptions = [
      { color: '#FF9800', label: 'Orange' },
      { color: '#e53935', label: 'Red' },
      { color: '#8B00FF', label: 'Purple' },
      { color: '#2e7d32', label: 'Green' },
    ]
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <ScreenHeader title={t('garage.setDayOverride')} onBack={() => setEditingOverride(null)} />
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.overrideDateBanner}>
          <Text style={styles.overrideDateText}>{editingOverride.displayDate}</Text>
        </View>

        <Text style={styles.fieldLabel}>{t('garage.dayStatus')}</Text>
        <View style={styles.statusRow}>
          {(['open', 'closed', 'holiday'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusBtn, ovStatus === s && styles.statusBtnActive]}
              onPress={() => setOvStatus(s)}
            >
              <Text style={[styles.statusBtnText, ovStatus === s && styles.statusBtnTextActive]}>
                {s === 'open' ? `✅ ${t('garage.status.open')}` : s === 'closed' ? `🔒 ${t('garage.status.closed')}` : `🎉 ${t('garage.status.holiday')}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {ovStatus === 'open' && (
          <FormField
            label={t('garage.maxVehiclesThisDay')}
            value={ovMaxSlots}
            onChangeText={setOvMaxSlots}
            placeholder={t('garage.leaveBlankDefault', { max: schedMaxPerDay })}
            keyboardType="number-pad"
          />
        )}

        <FormField
          label={t('garage.noticeMessage')}
          style={styles.multiline}
          value={ovMessage}
          onChangeText={setOvMessage}
          placeholder="e.g. Half day only — closing at 1pm for Vesak"
          multiline
          numberOfLines={2}
        />

        {ovMessage.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>{t('garage.messageColour')}</Text>
            <View style={styles.colorRow}>
              {colorOptions.map(opt => (
                <TouchableOpacity
                  key={opt.color}
                  style={[styles.colorBtn, { backgroundColor: opt.color }, ovColor === opt.color && styles.colorBtnSelected]}
                  onPress={() => setOvColor(opt.color)}
                >
                  {ovColor === opt.color && <Text style={styles.colorBtnCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Button title={t('garage.saveOverride')} onPress={handleSaveOverride} loading={savingOverride} />

        {editingOverride.existing && (
          <View style={{ marginTop: 12 }}>
            <Button
              title={t('garage.removeOverride')}
              onPress={handleRemoveOverride}
              disabled={savingOverride}
              variant="destructive"
            />
          </View>
        )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Normal garage view ───────────────────────────────────────────────────
  const showForm = !garage || editing

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      {(tab === 'customers' || tab === 'history') && garage && !editing ? (
        <ScreenHeader
          title={tab === 'customers' ? t('garage.customers') : t('garage.revenue')}
          onBack={() => setTab('profile')}
        />
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {!garage && onBack && (
                <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.backText}>← {t('common.back')}</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>{garage ? garage.name : t('garage.title')}</Text>
            </View>
            <View style={styles.headerRight}>
              {garage && onOpenLedger && (
                <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreMenuOpen(true)}>
                  <Text style={styles.moreIcon}>⋯</Text>
                </TouchableOpacity>
              )}
              {onNotifPress && (
                <TouchableOpacity style={styles.bellBtn} onPress={onNotifPress}>
                  <Text style={styles.bellIcon}>🔔</Text>
                  {notifUnread && <View style={styles.bellDot} />}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {garage && !editing && (
            <ScrollView
              ref={tabScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabs}
            >
              <TouchableOpacity
                style={[styles.tab, tab === 'profile' && styles.tabActive]}
                onPress={() => setTab('profile')}
                onLayout={e => { tabLayouts.current.profile = e.nativeEvent.layout }}
              >
                <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>{t('garage.tab.profile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'schedule' && styles.tabActive]}
                onPress={() => setTab('schedule')}
                onLayout={e => { tabLayouts.current.schedule = e.nativeEvent.layout }}
              >
                <Text style={[styles.tabText, tab === 'schedule' && styles.tabTextActive]}>{t('garage.tab.schedule')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'bookings' && styles.tabActive]}
                onPress={() => setTab('bookings')}
                onLayout={e => { tabLayouts.current.bookings = e.nativeEvent.layout }}
              >
                <Text style={[styles.tabText, tab === 'bookings' && styles.tabTextActive]}>{t('garage.tab.bookings')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'calendar' && styles.tabActive]}
                onPress={() => setTab('calendar')}
                onLayout={e => { tabLayouts.current.calendar = e.nativeEvent.layout }}
              >
                <Text style={[styles.tabText, tab === 'calendar' && styles.tabTextActive]}>{t('garage.tab.calendar')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={moreMenuOpen} transparent animationType="slide" onRequestClose={() => setMoreMenuOpen(false)}>
        <TouchableOpacity style={styles.moreSheetOverlay} activeOpacity={1} onPress={() => setMoreMenuOpen(false)}>
          <TouchableOpacity style={styles.moreSheetCard} activeOpacity={1} onPress={() => {}}>
            <View style={styles.moreSheetHeaderRow}>
              <Text style={styles.moreSheetTitle}>{t('garage.moreForGarage')}</Text>
              <TouchableOpacity onPress={() => setMoreMenuOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.moreSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreMenuOpen(false); setTab('customers') }}>
              <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>👥</Text></View>
              <Text style={styles.moreSheetItemText}>{t('garage.customers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreMenuOpen(false); setTab('history') }}>
              <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>💰</Text></View>
              <Text style={styles.moreSheetItemText}>{t('garage.revenue')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => { setMoreMenuOpen(false); onOpenLedger?.() }}>
              <View style={styles.moreSheetIcon}><Text style={styles.moreSheetIconText}>📒</Text></View>
              <Text style={styles.moreSheetItemText}>{t('garage.customerLedger')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {(tab === 'profile' || !garage) && (
        <ScrollView contentContainerStyle={styles.content}>
          {garage && !editing && (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.garageName}>{garage.name}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                    <Text style={styles.badgeText}>
                      {garage.verified ? `✅ ${t('garage.verifiedGarage')}` : `⚠️ ${t('garage.unverified')}`}
                    </Text>
                  </View>
                  {garage.ratingCount != null && garage.ratingCount > 0 && (
                    <TouchableOpacity style={styles.ratingBadge} onPress={openRatingsModal}>
                      <Text style={styles.ratingBadgeText}>⭐ {garage.avgRating} ({garage.ratingCount}) ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {garage.address && <Text style={styles.detail}>📍 {garage.address}</Text>}
                {garage.brNumber
                  ? <Text style={styles.detail}>🏢 {t('garage.brLabel', { br: garage.brNumber })}</Text>
                  : <Text style={styles.detailMuted}>{t('garage.noBrNumber')}</Text>
                }
                <Text style={styles.detail}>
                  💰 {garage.priceList && garage.priceList.length > 0 ? t('garage.pricesListed', { count: garage.priceList.length }) : t('garage.noPriceList')}
                </Text>
              </View>

              {!garage.verified && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>{t('garage.howToGetVerified')}</Text>
                  <Text style={styles.infoText}>
                    {t('garage.verifiedInfoText')}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setName(garage.name)
                  setAddress(garage.address || '')
                  setBrNumber(garage.brNumber || '')
                  setPriceListRows((garage.priceList || []).map(p => ({ service: p.service, price: String(p.price) })))
                  setEditing(true)
                }}
              >
                <Text style={styles.editBtnText}>{t('garage.editGarageDetails')}</Text>
              </TouchableOpacity>
            </>
          )}

          {showForm && (
            <>
              <Text style={styles.formTitle}>{garage ? t('garage.editGarage') : t('garage.registerYourGarage')}</Text>
              <Text style={styles.formSubtitleSmall}>
                {garage
                  ? t('garage.updateDetailsBelow')
                  : t('garage.setupProfileNote')}
              </Text>

              <Text style={styles.label}>{t('garage.garageName')}</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Silva Auto Service" />

              <Text style={styles.label}>{t('garage.addressOptional')}</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 45/A Kandy Road, Kelaniya" />

              <Text style={styles.label}>{t('garage.brNumberOptional')}</Text>
              <TextInput style={styles.input} value={brNumber} onChangeText={setBrNumber} placeholder="e.g. PV 00123456" autoCapitalize="characters" />

              <Text style={[styles.label, { marginTop: 20 }]}>{t('garage.priceListOptional')}</Text>
              <Text style={styles.formSubtitleSmall}>{t('garage.priceListNote')}</Text>
              {priceListRows.map((row, i) => (
                <View key={i} style={styles.priceRow}>
                  <TextInput
                    style={[styles.input, styles.priceServiceInput]}
                    value={row.service}
                    onChangeText={v => setPriceListRows(prev => prev.map((r, idx) => idx === i ? { ...r, service: v } : r))}
                    placeholder="e.g. Oil Change"
                  />
                  <TextInput
                    style={[styles.input, styles.pricePriceInput]}
                    value={row.price}
                    onChangeText={v => setPriceListRows(prev => prev.map((r, idx) => idx === i ? { ...r, price: v } : r))}
                    placeholder="LKR"
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.priceRemoveBtn}
                    onPress={() => setPriceListRows(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Text style={styles.priceRemoveBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.priceAddBtn}
                onPress={() => setPriceListRows(prev => [...prev, { service: '', price: '' }])}
              >
                <Text style={styles.priceAddBtnText}>{t('garage.addServicePrice')}</Text>
              </TouchableOpacity>

              <View style={styles.brNote}>
                <Text style={styles.brNoteText}>
                  {t('garage.brNoteText')}
                </Text>
              </View>

              {editing && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={garage ? handleUpdate : handleRegister}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>{garage ? t('history.saveChanges') : t('garage.registerGarage')}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {tab === 'schedule' && garage && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* ── Work days ── */}
          <Text style={styles.schedSection}>{t('garage.workingDays')}</Text>
          <View style={styles.dayRow}>
            {[
              { d: 1, labelKey: 'garage.dow.mon' as const }, { d: 2, labelKey: 'garage.dow.tue' as const }, { d: 3, labelKey: 'garage.dow.wed' as const },
              { d: 4, labelKey: 'garage.dow.thu' as const }, { d: 5, labelKey: 'garage.dow.fri' as const }, { d: 6, labelKey: 'garage.dow.sat' as const }, { d: 0, labelKey: 'garage.dow.sun' as const },
            ].map(({ d, labelKey }) => {
              const on = schedWorkDays.includes(d)
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, on && styles.dayBtnOn]}
                  onPress={() => setSchedWorkDays(prev =>
                    on ? prev.filter(x => x !== d) : [...prev, d]
                  )}
                >
                  <Text style={[styles.dayBtnText, on && styles.dayBtnTextOn]}>{t(labelKey)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ── Max per day ── */}
          <Text style={styles.schedSection}>{t('garage.maxVehiclesPerDay')}</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setSchedMaxPerDay(v => Math.max(1, v - 1))}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{schedMaxPerDay}</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setSchedMaxPerDay(v => v + 1)}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* ── Time slots ── */}
          <Text style={styles.schedSection}>{t('garage.timeSlots')}</Text>
          <View style={styles.chipRow}>
            {schedSlots.map(slot => (
              <TouchableOpacity
                key={slot}
                style={styles.slotChip}
                onPress={() => setSchedSlots(prev => prev.filter(s => s !== slot))}
              >
                <Text style={styles.slotChipText}>{slot}  ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addSlotRow}>
            <TextInput
              style={styles.addSlotInput}
              value={newSlot}
              onChangeText={setNewSlot}
              placeholder="e.g. 9:00 AM or Morning"
            />
            <TouchableOpacity
              style={styles.addSlotBtn}
              onPress={() => {
                const s = newSlot.trim()
                if (s && !schedSlots.includes(s)) setSchedSlots(prev => [...prev, s])
                setNewSlot('')
              }}
            >
              <Text style={styles.addSlotBtnText}>{t('garage.add')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingSchedule && styles.saveBtnDisabled]}
            onPress={handleSaveSchedule}
            disabled={savingSchedule}
          >
            {savingSchedule
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{t('garage.saveScheduleSettings')}</Text>
            }
          </TouchableOpacity>

          {/* ── Monthly calendar ── */}
          <View style={styles.calHeader}>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => {
                const m = new Date(calMonth)
                m.setMonth(m.getMonth() - 1)
                setCalMonth(m)
                loadOverrides(m)
              }}
            >
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              {calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => {
                const m = new Date(calMonth)
                m.setMonth(m.getMonth() + 1)
                setCalMonth(m)
                loadOverrides(m)
              }}
            >
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={styles.calDowRow}>
            {DOW_KEYS.map(d => (
              <Text key={d} style={styles.calDow}>{t(d)}</Text>
            ))}
          </View>

          {overridesLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : (() => {
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const firstDow = new Date(year, month, 1).getDay()
            const totalDays = new Date(year, month + 1, 0).getDate()
            const cells: (number | null)[] = [
              ...Array(firstDow).fill(null),
              ...Array.from({ length: totalDays }, (_, i) => i + 1),
            ]
            while (cells.length % 7 !== 0) cells.push(null)
            const overrideMap = new Map(overrides.map(o => [o.date, o]))
            const today = new Date(); today.setHours(0,0,0,0)

            return (
              <View style={styles.calGrid}>
                {cells.map((day, idx) => {
                  if (!day) return <View key={idx} style={styles.calCell} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const override = overrideMap.get(dateStr)
                  const cellDate = new Date(year, month, day)
                  const isPast = cellDate < today
                  const dotColor = override
                    ? override.status === 'open'
                      ? (override.messageColor || '#FF9800')
                      : override.status === 'holiday' ? '#e91e63' : '#e53935'
                    : null

                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[styles.calCell, isPast && styles.calCellPast]}
                      onPress={() => !isPast && openOverrideEditor(
                        dateStr,
                        cellDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                      )}
                      disabled={isPast}
                      activeOpacity={isPast ? 1 : 0.7}
                    >
                      <Text style={[styles.calDayNum, isPast && styles.calDayNumPast]}>{day}</Text>
                      {dotColor && <View style={[styles.calDot, { backgroundColor: dotColor }]} />}
                      {override?.status === 'closed' && <Text style={styles.calClosed}>✕</Text>}
                      {override?.status === 'holiday' && <Text style={styles.calHoliday}>★</Text>}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )
          })()}

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#FF9800' }]} />
              <Text style={styles.calLegendText}>{t('garage.customNotice')}</Text>
            </View>
            <View style={styles.calLegendItem}>
              <Text style={styles.calLegendIcon}>✕</Text>
              <Text style={styles.calLegendText}>{t('garage.status.closed')}</Text>
            </View>
            <View style={styles.calLegendItem}>
              <Text style={styles.calLegendIcon}>★</Text>
              <Text style={styles.calLegendText}>{t('garage.status.holiday')}</Text>
            </View>
          </View>
          <Text style={styles.calTip}>{t('garage.tapFutureDateTip')}</Text>
        </ScrollView>
      )}

      {tab === 'bookings' && garage && (
        <ScrollView ref={bookingsScrollRef} contentContainerStyle={styles.content}>
          {bookingsLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
          ) : bookings.length === 0 ? (
            <View style={styles.emptyShares}>
              <Text style={styles.emptySharesTitle}>{t('garage.noBookingsYet')}</Text>
              <Text style={styles.emptySharesText}>
                {t('garage.noBookingsYetSub')}
              </Text>
            </View>
          ) : bookings.map(booking => {
            const d = new Date(booking.date)
            const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
            const isPending = booking.status === 'pending'
            const isConfirmed = booking.status === 'confirmed'
            const isCounter = booking.status === 'counter_suggested'
            const isExpanded = expandedBooking === booking.id
            const bAny = booking as any
            const attachedShare = bAny.shareSessionId
              ? shares.find((s: IncomingShare) => s.id === bAny.shareSessionId) || null
              : null
            const alreadySubmitted = attachedShare
              ? submittedIds.has(attachedShare.id)
              : submittedIds.has(`booking_${booking.id}`)

            return (
              <TouchableOpacity
                key={booking.id}
                onLayout={e => { bookingLayouts.current[booking.id] = e.nativeEvent.layout.y }}
                style={[
                  styles.bookingCard,
                  isPending && styles.bookingCardPending,
                  isConfirmed && styles.bookingCardConfirmed,
                  isCounter && styles.bookingCardCounter,
                ]}
                onPress={() => handleExpandBooking(booking.id)}
                activeOpacity={0.85}
              >
                <View style={styles.bookingHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingVehicle}>
                      {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}
                    </Text>
                    <Text style={styles.bookingReg}>{booking.vehicle.registrationNo}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[
                      styles.bookingBadge,
                      isPending ? styles.bookingBadgePending : isCounter ? styles.bookingBadgeCounter : styles.bookingBadgeConfirmed,
                    ]}>
                      <Text style={[
                        styles.bookingBadgeText,
                        isPending ? styles.bookingBadgeTextPending : isCounter ? styles.bookingBadgeTextCounter : styles.bookingBadgeTextConfirmed,
                      ]}>
                        {isPending ? t('garage.pending') : isCounter ? `🔄 ${t('garage.counterSent')}` : t('garage.confirmed')}
                      </Text>
                    </View>
                    {attachedShare && (
                      <Text style={styles.shareAttachedTag}>📎 {t('garage.historyAttached')}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.bookingMeta}>
                  <Text style={styles.bookingDate}>📅 {dateStr}</Text>
                  {bAny.slotLabel && (
                    <Text style={styles.bookingSlot}>⏰ {bAny.slotLabel}</Text>
                  )}
                  <Text style={styles.bookingOwner}>{t('garage.ownerLabel', { phone: booking.ownerPhone })}</Text>
                  <Text style={styles.bookingMileage}>{booking.vehicle.mileage.toLocaleString()} km</Text>
                </View>

                {booking.notes ? (
                  <Text style={[
                    styles.bookingNotes,
                    bAny.noteType === 'urgent' && styles.bookingNotesUrgent,
                  ]}>
                    {bAny.noteType === 'urgent' ? '🚨 ' : ''}"{booking.notes}"
                  </Text>
                ) : null}

                {isPending && (
                  <View style={styles.bookingActionRow}>
                    <TouchableOpacity
                      style={[styles.confirmBookingBtn, { flex: 1 }, confirmingId === booking.id && styles.confirmBookingBtnDisabled]}
                      onPress={(e) => { e.stopPropagation?.(); handleConfirmBooking(booking.id) }}
                      disabled={confirmingId === booking.id}
                    >
                      {confirmingId === booking.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.confirmBookingBtnText}>✓ {t('garage.confirm')}</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.counterSuggestBtn}
                      onPress={(e) => { e.stopPropagation?.(); setCounterDate(''); setCounterSlot(''); setCounterNote(''); setCounterModal({ bookingId: booking.id }) }}
                    >
                      <Text style={styles.counterSuggestBtnText}>🔄 {t('garage.suggestSlot')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isCounter && (
                  <View style={styles.counterSentNote}>
                    <Text style={styles.counterSentText}>🔄 {t('garage.counterSentAwaiting')}</Text>
                  </View>
                )}

                {isConfirmed && !attachedShare && !isExpanded && (
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>✓ {t('garage.confirmedTapToSubmit')}</Text>
                  </View>
                )}

                {isConfirmed && attachedShare && !isExpanded && (
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>
                      {alreadySubmitted ? `✓ ${t('garage.serviceSubmittedAwaiting')}` : `📋 ${t('garage.confirmedTapToViewHistory')}`}
                    </Text>
                  </View>
                )}

                {/* ── Expanded: confirmed without share → show submit button ── */}
                {isExpanded && isConfirmed && !attachedShare && (
                  <View style={styles.inlineShareSection}>
                    <Text style={styles.inlineShareTitle}>{t('garage.noHistoryAttached')}</Text>
                    {alreadySubmitted ? (
                      <View style={styles.submittedBadge}>
                        <Text style={styles.submittedText}>✓ {t('garage.serviceSubmittedAwaiting')}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.openSubmitBtn}
                        onPress={(e) => { e.stopPropagation?.(); openSubmitFormFromBooking(booking) }}
                      >
                        <Text style={styles.openSubmitBtnText}>{t('garage.submitCompletedService')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* ── Expanded: shared records + submit ── */}
                {isExpanded && attachedShare && (
                  <View style={styles.inlineShareSection}>
                    <Text style={styles.inlineShareTitle}>
                      📋 {t('garage.sharedServiceHistory', { count: attachedShare.records.length })}
                    </Text>

                    {/* Vehicle profile */}
                    <View style={styles.inlineVehicleRow}>
                      <View style={styles.inlineVehicleItem}>
                        <Text style={styles.inlineVehicleLabel}>{t('garage.fuelTypeLabel')}</Text>
                        <Text style={styles.inlineVehicleValue}>{attachedShare.vehicle.fuelType}</Text>
                      </View>
                      <View style={styles.inlineVehicleItem}>
                        <Text style={styles.inlineVehicleLabel}>{t('addService.mileage')}</Text>
                        <Text style={styles.inlineVehicleValue}>{attachedShare.vehicle.mileage.toLocaleString()} km</Text>
                      </View>
                      {attachedShare.avgFuelEfficiency != null && (
                        <View style={styles.inlineVehicleItem}>
                          <Text style={styles.inlineVehicleLabel}>{t('garage.avgEconomy')}</Text>
                          <Text style={styles.inlineVehicleValue}>{attachedShare.avgFuelEfficiency} km/L</Text>
                        </View>
                      )}
                    </View>

                    {/* Records */}
                    {attachedShare.records.map((r: SharedRecord) => (
                      <View key={r.id} style={styles.inlineRecord}>
                        <View style={styles.inlineRecordTop}>
                          <Text style={styles.inlineRecordDate}>{formatDate(r.date)}</Text>
                          {r.cost != null && (
                            <Text style={styles.inlineRecordCost}>LKR {r.cost.toLocaleString()}</Text>
                          )}
                        </View>
                        <View style={styles.tagRow}>
                          {parseServices(r.description).map((s: string, i: number) => (
                            <View key={i} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
                          ))}
                        </View>
                        {r.mileage != null && (
                          <Text style={styles.inlineRecordMileage}>{r.mileage.toLocaleString()} km</Text>
                        )}
                      </View>
                    ))}

                    {/* Submit service action */}
                    <View style={styles.submitArea}>
                      {alreadySubmitted ? (
                        <View style={styles.submittedBadge}>
                          <Text style={styles.submittedText}>✓ {t('garage.serviceSubmittedAwaiting')}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.openSubmitBtn}
                          onPress={() => openSubmitForm(attachedShare)}
                        >
                          <Text style={styles.openSubmitBtnText}>{t('garage.submitCompletedService')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Messages toggle — always visible on every booking card */}
                <TouchableOpacity
                  style={styles.messagesToggleBtn}
                  onPress={(e) => { e.stopPropagation?.(); toggleMessages(booking.id) }}
                >
                  <Text style={styles.messagesToggleBtnText}>
                    💬 {t('garage.messagesWithOwner')} {expandedMessagesSet.has(booking.id) ? '▲' : '▼'}
                  </Text>
                  {(() => {
                    const unread = Math.max(0, (booking._count?.bookingNotes ?? 0) - (bookingSeenCounts[booking.id] ?? 0))
                    return unread > 0 ? <View style={styles.msgDot} /> : null
                  })()}
                </TouchableOpacity>

                {/* Messages thread — shown independently of card expand */}
                {expandedMessagesSet.has(booking.id) && (
                  <View style={styles.notesSection}>
                    {loadingNotesId === booking.id ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {(bookingNotesMap[booking.id] || []).length === 0 ? (
                          <Text style={styles.noNotes}>{t('garage.noMessagesYet')}</Text>
                        ) : (bookingNotesMap[booking.id] || []).map(note => (
                          <View
                            key={note.id}
                            style={[
                              styles.noteItem,
                              note.senderPhone === booking.ownerPhone && styles.noteItemThem,
                            ]}
                          >
                            <Text style={styles.noteSender}>
                              {note.senderPhone === booking.ownerPhone ? t('garage.owner') : t('garage.youGarage')}
                            </Text>
                            <Text style={styles.noteText}>{note.message}</Text>
                            <Text style={styles.noteTime}>
                              {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        ))}
                        <View style={styles.noteInputRow}>
                          <TextInput
                            style={styles.noteInput}
                            value={noteInputs[booking.id] || ''}
                            onChangeText={v => setNoteInputs(prev => ({ ...prev, [booking.id]: v }))}
                            placeholder={t('garage.typeMessageToOwner')}
                          />
                          <TouchableOpacity
                            style={[
                              styles.noteSendBtn,
                              (!noteInputs[booking.id]?.trim() || sendingNote === booking.id) && styles.noteSendBtnDisabled,
                            ]}
                            onPress={(e) => { e.stopPropagation?.(); handleSendNote(booking.id) }}
                            disabled={!noteInputs[booking.id]?.trim() || sendingNote === booking.id}
                          >
                            {sendingNote === booking.id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.noteSendBtnText}>→</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {!isExpanded && !isConfirmed && (
                  <Text style={styles.expandHint}>{t('garage.tapToExpand')}</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {tab === 'calendar' && garage && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Month navigation */}
          <View style={styles.calHeader}>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => {
                const m = new Date(calMonth); m.setMonth(m.getMonth() - 1)
                setCalMonth(m); loadOverrides(m); setSelectedCalDate(null)
              }}
            >
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              {calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => {
                const m = new Date(calMonth); m.setMonth(m.getMonth() + 1)
                setCalMonth(m); loadOverrides(m); setSelectedCalDate(null)
              }}
            >
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calDowRow}>
            {DOW_KEYS.map(d => (
              <Text key={d} style={styles.calDow}>{t(d)}</Text>
            ))}
          </View>

          {(() => {
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const firstDow = new Date(year, month, 1).getDay()
            const totalDays = new Date(year, month + 1, 0).getDate()
            const cells: (number | null)[] = [
              ...Array(firstDow).fill(null),
              ...Array.from({ length: totalDays }, (_, i) => i + 1),
            ]
            while (cells.length % 7 !== 0) cells.push(null)

            const overrideMap = new Map(overrides.map(o => [o.date, o]))
            const bookingCountByDay = new Map<string, number>()
            bookings.forEach(b => {
              const key = new Date(b.date).toISOString().slice(0, 10)
              bookingCountByDay.set(key, (bookingCountByDay.get(key) || 0) + 1)
            })

            return (
              <View style={styles.calGrid}>
                {cells.map((day, idx) => {
                  if (!day) return <View key={idx} style={styles.calCell} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const count = bookingCountByDay.get(dateStr) || 0
                  const override = overrideMap.get(dateStr)
                  const fillRatio = schedMaxPerDay > 0 ? count / schedMaxPerDay : 0
                  const isSelected = selectedCalDate === dateStr

                  let cellBg: string = colors.surface
                  let cellTextColor: string | null = null
                  if (override?.status === 'closed' || override?.status === 'holiday') {
                    cellBg = '#fce4ec'
                    cellTextColor = '#6d2145'
                  } else if (fillRatio >= 1) {
                    cellBg = '#ffebee'
                    cellTextColor = '#7a1f1f'
                  } else if (fillRatio > 0) {
                    cellBg = '#fff3e0'
                    cellTextColor = '#7a4a00'
                  }

                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[
                        styles.calCell,
                        { backgroundColor: cellBg },
                        isSelected && styles.calCellSelected,
                      ]}
                      onPress={() => setSelectedCalDate(isSelected ? null : dateStr)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.calDayNum,
                        cellTextColor ? { color: cellTextColor } : null,
                        isSelected && { color: colors.primary },
                      ]}>{day}</Text>
                      {count > 0 && (
                        <Text style={[
                          styles.calBookingCount,
                          fillRatio >= 1 ? styles.calBookingCountFull : styles.calBookingCountPartial,
                        ]}>
                          {count}/{schedMaxPerDay}
                        </Text>
                      )}
                      {override?.message && (
                        <View style={[styles.calDot, { backgroundColor: '#e53935' }]} />
                      )}
                      {override?.status === 'closed' && <Text style={styles.calClosed}>✕</Text>}
                      {override?.status === 'holiday' && <Text style={styles.calHoliday}>★</Text>}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )
          })()}

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffe0b2' }]} />
              <Text style={styles.calLegendText}>{t('garage.partial')}</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ffcdd2' }]} />
              <Text style={styles.calLegendText}>{t('booking.full')}</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#e53935' }]} />
              <Text style={styles.calLegendText}>{t('garage.notice')}</Text>
            </View>
          </View>
          <Text style={styles.calTip}>{t('garage.tapDateForBookings')}</Text>

          {/* Selected date detail */}
          {selectedCalDate && (() => {
            const dayBookings = bookings.filter(b =>
              new Date(b.date).toISOString().slice(0, 10) === selectedCalDate
            )
            const override = overrides.find(o => o.date === selectedCalDate)
            const displayDate = new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })
            return (
              <View style={styles.calDayDetail}>
                <Text style={styles.calDayDetailDate}>{displayDate}</Text>

                {override?.message && (
                  <Text style={styles.calDayMessage}>⚠️ {override.message}</Text>
                )}
                {override?.status === 'closed' && (
                  <Text style={styles.calDayClosedMsg}>{t('garage.closedThisDay')}</Text>
                )}
                {override?.status === 'holiday' && (
                  <Text style={styles.calDayClosedMsg}>{t('garage.holidayDash', { desc: override.message || t('garage.noDescription') })}</Text>
                )}

                {dayBookings.length === 0 ? (
                  <Text style={styles.calDayEmpty}>{t('garage.noBookingsThisDay')}</Text>
                ) : (
                  dayBookings.map((b: any) => (
                    <View key={b.id} style={[
                      styles.calDayBookingCard,
                      b.status === 'confirmed' && styles.calDayBookingConfirmed,
                    ]}>
                      <View style={styles.calDayBookingTop}>
                        <Text style={styles.calDayBookingVehicle}>
                          {b.vehicle.registrationNo} · {b.vehicle.make} {b.vehicle.model}
                        </Text>
                        <View style={[
                          styles.bookingBadge,
                          b.status === 'pending' ? styles.bookingBadgePending : styles.bookingBadgeConfirmed,
                        ]}>
                          <Text style={[styles.bookingBadgeText, b.status === 'pending' ? styles.bookingBadgeTextPending : styles.bookingBadgeTextConfirmed]}>{b.status === 'pending' ? t('garage.pending') : t('garage.confirmed')}</Text>
                        </View>
                      </View>
                      {b.slotLabel && <Text style={styles.calDaySlot}>⏰ {b.slotLabel}</Text>}
                      {b.notes && (
                        <Text style={[styles.calDayNotes, b.noteType === 'urgent' && { color: '#e53935' }]}>
                          {b.noteType === 'urgent' ? '🚨 ' : ''}"{b.notes}"
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            )
          })()}
        </ScrollView>
      )}

      {/* ── Customers tab ──────────────────────────────────────────────── */}
      {tab === 'customers' && (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.walkinBtn} onPress={() => setWalkinOpen(true)}>
            <Text style={styles.walkinBtnText}>🚶 {t('garage.logWalkinService')}</Text>
          </TouchableOpacity>

          <FormField
            label={t('garage.search')}
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder={t('garage.searchByRegNo')}
          />

          {customersLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (() => {
            const q = customerSearch.trim().toLowerCase()
            const filtered = customers.filter(c => !q || c.registrationNo.toLowerCase().includes(q))
            if (filtered.length === 0) {
              return (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>{t('garage.noCustomersYet')}</Text>
                  <Text style={styles.emptySub}>{t('garage.noCustomersYetSub')}</Text>
                </View>
              )
            }
            return filtered.map(cust => {
              const isOverdue = cust.prediction?.status === 'overdue'
              const isDueSoon = cust.prediction?.status === 'due_soon'
              const cooldownMs = cust.lastReminderSentAt ? Date.now() - new Date(cust.lastReminderSentAt).getTime() : null
              const cooldownActive = cooldownMs != null && cooldownMs < 7 * 24 * 60 * 60 * 1000
              const daysSinceReminder = cooldownMs != null ? Math.floor(cooldownMs / 86400000) : null

              return (
                <View key={cust.vehicleId} style={styles.custCard}>
                  <View style={styles.custTop}>
                    <Text style={styles.custReg}>{cust.registrationNo}</Text>
                    {(isOverdue || isDueSoon) && (
                      <View style={[styles.custBadge, isOverdue ? styles.custBadgeOverdue : styles.custBadgeDueSoon]}>
                        <Text style={styles.custBadgeText}>{isOverdue ? `🚨 ${t('predictions.status.overdue')}` : `⚠ ${t('predictions.status.dueSoon')}`}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.custVehicle}>{cust.year} {cust.make} {cust.model}</Text>
                  <View style={styles.custStatsRow}>
                    <Text style={styles.custStat}>{t('garage.jobCount', { count: cust.jobCount, s: cust.jobCount !== 1 ? 's' : '' })}</Text>
                    <Text style={styles.custStat}>LKR {cust.totalRevenue.toLocaleString()}</Text>
                    {cust.lastServiceDate && (
                      <Text style={styles.custStat}>
                        {t('garage.lastLabel', { date: new Date(cust.lastServiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) })}
                      </Text>
                    )}
                  </View>
                  {cust.prediction && (isOverdue || isDueSoon) && (
                    <Text style={styles.custPredictionText}>{cust.prediction.name}</Text>
                  )}
                  {(isOverdue || isDueSoon) && (
                    <TouchableOpacity
                      style={[styles.custRemindBtn, cooldownActive && styles.custRemindBtnDisabled]}
                      disabled={cooldownActive || remindingId === cust.vehicleId}
                      onPress={() => handleRemind(cust.vehicleId)}
                    >
                      {remindingId === cust.vehicleId ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.custRemindBtnText}>
                          {cooldownActive ? t('garage.sentDaysAgo', { days: daysSinceReminder ?? 0 }) : `🔔 ${t('garage.sendReminder')}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {onOpenLedger && (
                    <TouchableOpacity onPress={() => onOpenLedger(cust.vehicleId)}>
                      <Text style={styles.viewHistoryLink}>{t('garage.viewFullHistory')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })
          })()}
        </ScrollView>
      )}

      {/* ── Revenue / History tab ──────────────────────────────────────── */}
      {tab === 'history' && (
        <ScrollView contentContainerStyle={styles.content}>
          {historyLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (() => {
            const completed = historyJobs
            const totalRevenue = completed.reduce((s, j) => s + (j.cost ?? 0), 0)

            // This month
            const now = new Date()
            const thisMonthJobs = completed.filter(j => {
              const d = new Date(j.createdAt)
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            })
            const thisMonthRevenue = thisMonthJobs.reduce((s, j) => s + (j.cost ?? 0), 0)

            // Last 6 months bar data
            const months: { label: string; revenue: number }[] = []
            for (let i = 5; i >= 0; i--) {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
              const label = d.toLocaleDateString('en-GB', { month: 'short' })
              const revenue = completed.filter(j => {
                const jd = new Date(j.createdAt)
                return jd.getMonth() === d.getMonth() && jd.getFullYear() === d.getFullYear()
              }).reduce((s, j) => s + (j.cost ?? 0), 0)
              months.push({ label, revenue })
            }
            const maxRev = Math.max(...months.map(m => m.revenue), 1)

            const avgJobValue = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0

            const jobsByVehicle = new Map<string, number>()
            completed.forEach(j => {
              jobsByVehicle.set(j.vehicle.registrationNo, (jobsByVehicle.get(j.vehicle.registrationNo) ?? 0) + 1)
            })
            const distinctVehicles = jobsByVehicle.size
            const repeatVehicles = Array.from(jobsByVehicle.values()).filter(n => n > 1).length
            const repeatPct = distinctVehicles > 0 ? Math.round((repeatVehicles / distinctVehicles) * 100) : 0

            const catRevenue = new Map<string, number>()
            completed.forEach(j => {
              const cats = j.categories && j.categories.length > 0 ? j.categories : [t('garage.uncategorized')]
              cats.forEach(cat => catRevenue.set(cat, (catRevenue.get(cat) ?? 0) + (j.cost ?? 0)))
            })
            const catBreakdown = Array.from(catRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
            const maxCatRevenue = Math.max(...catBreakdown.map(c => c[1]), 1)
            const CAT_COLORS = ['#1d3a5f', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00897b']

            return (
              <>
                {/* Summary cards */}
                <View style={styles.revSummaryRow}>
                  <View style={styles.revCard}>
                    <Text style={styles.revCardLabel}>{t('garage.totalRevenue')}</Text>
                    <Text style={styles.revCardValue}>LKR {totalRevenue.toLocaleString()}</Text>
                    <Text style={styles.revCardSub}>{t('garage.completedJobsCount', { count: completed.length, s: completed.length !== 1 ? 's' : '' })}</Text>
                  </View>
                  <View style={styles.revCard}>
                    <Text style={styles.revCardLabel}>{t('garage.thisMonth')}</Text>
                    <Text style={styles.revCardValue}>LKR {thisMonthRevenue.toLocaleString()}</Text>
                    <Text style={styles.revCardSub}>{t('garage.jobCount', { count: thisMonthJobs.length, s: thisMonthJobs.length !== 1 ? 's' : '' })}</Text>
                  </View>
                </View>
                <View style={styles.revSummaryRow}>
                  <View style={styles.revCard}>
                    <Text style={styles.revCardLabel}>{t('garage.avgJobValue')}</Text>
                    <Text style={styles.revCardValue}>LKR {avgJobValue.toLocaleString()}</Text>
                  </View>
                  <View style={styles.revCard}>
                    <Text style={styles.revCardLabel}>{t('garage.repeatCustomers')}</Text>
                    <Text style={styles.revCardValue}>{repeatPct}%</Text>
                    <Text style={styles.revCardSub}>{t('garage.ofVehicles', { repeat: repeatVehicles, total: distinctVehicles })}</Text>
                  </View>
                </View>

                {/* Revenue by category */}
                {catBreakdown.length > 0 && (
                  <View style={styles.revChartCard}>
                    <Text style={styles.revChartTitle}>{t('garage.revenueByCategory')}</Text>
                    {catBreakdown.map(([cat, rev], i) => (
                      <View key={cat} style={styles.revCatRow}>
                        <Text style={styles.revCatLabel} numberOfLines={1}>{cat}</Text>
                        <View style={styles.revCatBarTrack}>
                          <View style={[styles.revCatBarFill, { width: `${Math.round((rev / maxCatRevenue) * 100)}%` as any, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                        </View>
                        <Text style={styles.revCatAmount}>{Math.round(rev / 1000)}k</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Monthly bar chart */}
                <View style={styles.revChartCard}>
                  <Text style={styles.revChartTitle}>{t('garage.revenueLast6Months')}</Text>
                  <View style={styles.revBars}>
                    {months.map((m, i) => (
                      <View key={i} style={styles.revBarCol}>
                        <View style={styles.revBarTrack}>
                          <View style={[styles.revBarFill, { height: `${Math.round((m.revenue / maxRev) * 100)}%` as any }]} />
                        </View>
                        <Text style={styles.revBarLabel}>{m.label}</Text>
                        {m.revenue > 0 && (
                          <Text style={styles.revBarValue}>{Math.round(m.revenue / 1000)}k</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Completed jobs list */}
                <Text style={styles.revSectionTitle}>{t('garage.completedJobs')}</Text>
                {completed.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>🔧</Text>
                    <Text style={styles.emptyText}>{t('garage.noCompletedJobsYet')}</Text>
                    <Text style={styles.emptySub}>{t('garage.acceptedSubmissionsAppearHere')}</Text>
                  </View>
                ) : (
                  completed.map(job => (
                    <View key={job.id} style={styles.revJobCard}>
                      <View style={styles.revJobTop}>
                        <Text style={styles.revJobReg}>{job.vehicle.registrationNo}</Text>
                        {job.cost != null && (
                          <Text style={styles.revJobCost}>LKR {job.cost.toLocaleString()}</Text>
                        )}
                      </View>
                      <Text style={styles.revJobVehicle}>
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </Text>
                      <Text style={styles.revJobDesc} numberOfLines={2}>{job.description}</Text>
                      <View style={styles.revJobMeta}>
                        <Text style={styles.revJobDate}>
                          {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        {job.mileage != null && (
                          <Text style={styles.revJobMileage}>{job.mileage.toLocaleString()} km</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </>
            )
          })()}
        </ScrollView>
      )}

      {/* ── Ratings breakdown modal ────────────────────────────────────── */}
      {ratingsModalOpen && (
        <Modal visible animationType="slide" transparent={false} onRequestClose={() => setRatingsModalOpen(false)}>
          <View style={styles.container}>
            <ScreenHeader title="Reviews" onBack={() => setRatingsModalOpen(false)} />
            <ScrollView contentContainerStyle={styles.content}>
              {ratingsLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
              ) : ratingsDetail && (
                <>
                  <View style={styles.ratingsSummaryRow}>
                    <Text style={styles.ratingsAvgNum}>{ratingsDetail.avgRating}</Text>
                    <View>
                      <Text style={styles.ratingsAvgStars}>{'⭐'.repeat(Math.round(ratingsDetail.avgRating ?? 0))}</Text>
                      <Text style={styles.ratingsCountText}>
                        {ratingsDetail.ratingCount} rating{ratingsDetail.ratingCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ratingsDistWrap}>
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = ratingsDetail.distribution[String(star)] ?? 0
                      const pct = ratingsDetail.ratingCount > 0 ? Math.round((count / ratingsDetail.ratingCount) * 100) : 0
                      return (
                        <View key={star} style={styles.ratingsDistRow}>
                          <Text style={styles.ratingsDistLabel}>{star}★</Text>
                          <View style={styles.ratingsDistTrack}>
                            <View style={[styles.ratingsDistFill, { width: `${pct}%` as any }]} />
                          </View>
                          <Text style={styles.ratingsDistCount}>{count}</Text>
                        </View>
                      )
                    })}
                  </View>

                  <Text style={styles.ratingsReviewsTitle}>Written Reviews</Text>
                  {ratingsDetail.reviews.length === 0 ? (
                    <Text style={styles.emptySub}>No written reviews yet.</Text>
                  ) : (
                    ratingsDetail.reviews.map((r, i) => (
                      <View key={i} style={styles.reviewCard}>
                        <Text style={styles.reviewStars}>{'⭐'.repeat(r.rating)}</Text>
                        <Text style={styles.reviewComment}>{r.comment}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ── Walk-in service lookup modal ──────────────────────────────── */}
      {walkinOpen && (
        <Modal visible animationType="slide" transparent={false} onRequestClose={() => setWalkinOpen(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.container}>
            <ScreenHeader title="Log a Walk-in Service" onBack={() => { setWalkinOpen(false); setWalkinRegNo(''); setWalkinResult(null) }} />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.walkinIntro}>
                Enter the vehicle's registration number to look it up, then log the completed service. The owner will still need to Accept it before it's added to their history.
              </Text>
              <View style={styles.walkinSearchRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={walkinRegNo}
                  onChangeText={setWalkinRegNo}
                  placeholder="e.g. WP CAB-1234"
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.walkinFindBtn} onPress={handleWalkinLookup} disabled={walkinLookupLoading}>
                  {walkinLookupLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.walkinFindBtnText}>Find</Text>
                  }
                </TouchableOpacity>
              </View>

              {walkinResult && (
                <View style={styles.walkinResultCard}>
                  <Text style={styles.walkinResultReg}>{walkinResult.registrationNo}</Text>
                  <Text style={styles.walkinResultVehicle}>
                    {walkinResult.year} {walkinResult.make} {walkinResult.model}
                  </Text>
                  <Text style={styles.walkinResultMeta}>{walkinResult.mileage.toLocaleString()} km · {walkinResult.fuelType}</Text>
                  <TouchableOpacity style={styles.walkinConfirmBtn} onPress={openSubmitFormFromWalkin}>
                    <Text style={styles.walkinConfirmBtnText}>Log Service for this Vehicle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Counter-suggest modal ─────────────────────────────────────── */}
      {counterModal && (() => {
        const next14 = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i + 1); return d
        })
        const slots = schedSlots.length > 0 ? schedSlots : ['Morning', 'Afternoon']
        return (
          <Modal visible animationType="slide" transparent={false} onRequestClose={() => setCounterModal(null)}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.counterModalContainer}>
              <View style={styles.counterModalHeader}>
                <TouchableOpacity onPress={() => setCounterModal(null)}>
                  <Text style={styles.counterModalBack}>✕ Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.counterModalTitle}>Suggest Different Slot</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
                <Text style={styles.counterLabel}>Select a new date</Text>
                <View style={styles.counterDateGrid}>
                  {next14.map(d => {
                    const iso = d.toISOString().split('T')[0]
                    const isSelected = counterDate === iso
                    return (
                      <TouchableOpacity
                        key={iso}
                        style={[styles.counterDateCell, isSelected && styles.counterDateCellActive]}
                        onPress={() => setCounterDate(iso)}
                      >
                        <Text style={[styles.counterDateDay, isSelected && styles.counterDateDayActive]}>
                          {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.counterDateNum, isSelected && styles.counterDateNumActive]}>
                          {d.getDate()}
                        </Text>
                        <Text style={[styles.counterDateMon, isSelected && styles.counterDateMonActive]}>
                          {d.toLocaleDateString('en-GB', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <Text style={[styles.counterLabel, { marginTop: 20 }]}>Select a time slot (optional)</Text>
                <View style={styles.counterSlotRow}>
                  {slots.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.counterSlotChip, counterSlot === s && styles.counterSlotChipActive]}
                      onPress={() => setCounterSlot(counterSlot === s ? '' : s)}
                    >
                      <Text style={[styles.counterSlotChipText, counterSlot === s && styles.counterSlotChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.counterNoteWrap}>
                  <FormField
                    label="Add a note for the owner (optional)"
                    value={counterNote}
                    onChangeText={setCounterNote}
                    placeholder="e.g. Sorry, we're fully booked that slot — this time works better for us"
                    multiline
                    numberOfLines={2}
                    style={styles.counterNoteInput}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.counterSubmitBtn, (!counterDate || submittingCounter) && styles.counterSubmitBtnDisabled]}
                  onPress={handleCounterSubmit}
                  disabled={!counterDate || submittingCounter}
                >
                  {submittingCounter
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.counterSubmitBtnText}>Send Suggestion to Owner</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
            </KeyboardAvoidingView>
          </Modal>
        )
      })()}
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    formContent: { padding: 20, paddingBottom: 56 },
    formTitle: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 12 },
    formSubtitle: { fontSize: 14, color: c.textMuted, marginBottom: 16 },
    formSubtitleSmall: { fontSize: 14, color: c.textMuted, marginBottom: 20, lineHeight: 20 },
    vehicleBanner: {
      backgroundColor: c.primary, borderRadius: 12, padding: 16, marginBottom: 20,
    },
    vehicleBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
    vehicleBannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
    vehicleBannerMileage: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    catLabel: { fontSize: 12, fontWeight: '700', color: c.textSub, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.textSub, marginTop: 18, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: 22, borderWidth: 1.5,
      borderColor: c.borderMid, backgroundColor: c.surface,
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    check: { fontSize: 13, color: '#fff' },
    chipText: { fontSize: 14, color: c.textBody },
    chipTextSelected: { color: '#fff', fontWeight: '600' },
    brandsSection: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginTop: 24,
      borderWidth: 1, borderColor: c.primaryTint,
    },
    brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: c.primary, marginBottom: 2 },
    brandsSectionSub: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
    brandRow: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 14 },
    brandItemName: { fontSize: 14, fontWeight: '600', color: c.textBody, marginBottom: 8 },
    brandChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 18, borderWidth: 1.5,
      borderColor: c.borderMid, backgroundColor: c.surfaceAlt,
    },
    brandChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    brandChipText: { fontSize: 12, color: c.textSub },
    brandChipTextSelected: { color: '#fff', fontWeight: '600' },
    fInput: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 15, color: c.text, letterSpacing: 0,
      borderWidth: 1, borderColor: c.borderMid,
    },
    multiline: { height: 90, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    summary: { backgroundColor: '#e6f4ea', borderRadius: 12, padding: 16, marginTop: 20 },
    summaryLabel: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
    summaryLine: { fontSize: 13, color: '#1b4332', marginBottom: 4, lineHeight: 20 },
    requiredStar: { color: c.error, fontWeight: '700' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
    photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    thumbImg: { width: 80, height: 80 },
    photoRemove: {
      position: 'absolute', top: 2, right: 2,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
      width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    },
    photoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    photoActions: { flexDirection: 'row', gap: 8 },
    photoBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.primaryTint, minWidth: 100,
    },
    photoBtnText: { color: c.primary, fontSize: 13, fontWeight: '600' },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, paddingTop: topInset + 12, paddingBottom: 16,
      paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: c.text },
    backBtn: {},
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    moreBtn: { padding: 4 },
    moreIcon: { fontSize: 24, color: c.text, fontWeight: '800' },
    moreSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    moreSheetCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
    moreSheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    moreSheetTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    moreSheetClose: { fontSize: 18, color: c.textMuted, fontWeight: '700' },
    moreSheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    moreSheetIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    moreSheetIconText: { fontSize: 15 },
    moreSheetItemText: { fontSize: 14, fontWeight: '600', color: c.text },
    bellBtn: { padding: 4, position: 'relative' },
    bellIcon: { fontSize: 22 },
    bellDot: {
      position: 'absolute', top: 0, right: 0,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#e53935', borderWidth: 1.5, borderColor: c.surface,
    },
    tabsScroll: {
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      flexGrow: 0, height: 48,
    },
    tabs: {
      flexDirection: 'row', height: 48,
    },
    tab: { height: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: c.primary },
    tabText: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    tabTextActive: { color: c.primary },
    content: { padding: 20, paddingBottom: 48 },
    profileCard: {
      backgroundColor: c.surface, borderRadius: 16, padding: 24, marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    garageName: { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 12 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14 },
    badgeVerified: { backgroundColor: '#e6f4ea' },
    badgeUnverified: { backgroundColor: '#fff8e1' },
    badgeText: { fontSize: 13, fontWeight: '700' },
    ratingBadge: {
      alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
      marginBottom: 14, backgroundColor: '#fff3e0',
    },
    ratingBadgeText: { fontSize: 13, fontWeight: '700', color: '#e65100' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    priceServiceInput: { flex: 2 },
    pricePriceInput: { flex: 1 },
    priceRemoveBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    priceRemoveBtnText: { fontSize: 16, color: c.error, fontWeight: '700' },
    priceAddBtn: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 4 },
    priceAddBtnText: { fontSize: 13, color: c.primary, fontWeight: '700' },
    detail: { fontSize: 14, color: c.textSub, marginBottom: 6 },
    detailMuted: { fontSize: 13, color: c.textFaint, fontStyle: 'italic', marginTop: 4 },
    infoBox: { backgroundColor: c.primaryTint, borderRadius: 12, padding: 16, marginBottom: 16 },
    infoTitle: { fontSize: 13, fontWeight: '700', color: c.primaryTintText, marginBottom: 6 },
    infoText: { fontSize: 13, color: c.textBody, lineHeight: 20 },
    editBtn: {
      borderWidth: 1.5, borderColor: c.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
    },
    editBtnText: { fontSize: 15, color: c.primary, fontWeight: '700' },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 18 },
    input: {
      backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.borderMid,
    },
    brNote: { backgroundColor: c.primaryTint, borderRadius: 10, padding: 14, marginTop: 14 },
    brNoteText: { fontSize: 13, color: c.primaryTintText, lineHeight: 19 },
    cancelBtn: {
      borderWidth: 1, borderColor: c.borderStrong, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 20,
    },
    cancelBtnText: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
    saveBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 18, alignItems: 'center', marginTop: 16,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    emptyShares: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptySharesTitle: { fontSize: 17, fontWeight: '700', color: c.textSub, marginBottom: 10 },
    emptySharesText: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
    shareCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    shareCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    shareVehicle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    shareReg: { fontSize: 13, color: c.primary, fontWeight: '600' },
    shareRight: { alignItems: 'flex-end' },
    shareRecordCount: { fontSize: 13, fontWeight: '700', color: c.primary },
    shareMileage: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    shareDate: { fontSize: 12, color: c.textFaint, marginBottom: 6 },
    expandHint: { fontSize: 11, color: c.textFaint, marginTop: 4 },
    shareRecords: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    sharedRecord: { marginBottom: 12 },
    sharedRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    sharedRecordDate: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    sharedRecordCost: { fontSize: 12, color: c.primary, fontWeight: '700' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    tag: { backgroundColor: c.primaryTint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    tagText: { fontSize: 12, color: c.textBody },
    sharedRecordMileage: { fontSize: 11, color: c.textFaint },
    collapseHint: { fontSize: 11, color: c.textFaint, marginTop: 8, textAlign: 'center' },
    profileSection: { backgroundColor: c.primaryTint, borderRadius: 10, padding: 14, marginBottom: 14 },
    profileSectionTitle: { fontSize: 12, fontWeight: '700', color: c.primaryTintText, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    profileItem: { width: '47%' },
    profileLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600', marginBottom: 2 },
    profileValue: { fontSize: 13, color: c.text, fontWeight: '600' },
    profileValueHighlight: { fontSize: 14, color: c.primary, fontWeight: '800' },
    recordsSectionTitle: { fontSize: 12, fontWeight: '700', color: c.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    submitArea: { marginTop: 16, borderTopWidth: 1, borderTopColor: c.borderMid, paddingTop: 14 },
    submittedBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, alignItems: 'center' },
    submittedText: { fontSize: 14, color: '#2e7d32', fontWeight: '700' },
    openSubmitBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    openSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    bookingCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    bookingVehicle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    bookingReg: { fontSize: 13, color: c.primary, fontWeight: '600' },
    bookingBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    bookingBadgePending: { backgroundColor: '#fff8e1' },
    bookingBadgeConfirmed: { backgroundColor: '#e6f4ea' },
    bookingBadgeCounter: { backgroundColor: '#e3f2fd' },
    bookingBadgeText: { fontSize: 12, fontWeight: '700', color: c.textSub },
    bookingBadgeTextPending: { color: '#8a6300' },
    bookingBadgeTextConfirmed: { color: '#2e7d32' },
    bookingBadgeTextCounter: { color: '#1565c0' },
    bookingMeta: { gap: 3, marginBottom: 10 },
    bookingDate: { fontSize: 14, fontWeight: '600', color: c.textBody },
    bookingOwner: { fontSize: 13, color: c.textMuted },
    bookingMileage: { fontSize: 13, color: c.textMuted },
    bookingNotes: { fontSize: 13, color: c.textSub, fontStyle: 'italic', marginBottom: 12, lineHeight: 18 },
    confirmBookingBtn: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    },
    confirmBookingBtnDisabled: { opacity: 0.6 },
    confirmBookingBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    confirmedBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, alignItems: 'center' },
    confirmedText: { fontSize: 13, color: '#2e7d32', fontWeight: '700' },
    bookingSlot: { fontSize: 13, color: c.textSub },
    bookingNotesUrgent: { color: '#e53935', fontWeight: '700' },

    overrideDateBanner: {
      backgroundColor: c.primary, borderRadius: 12, padding: 16, marginBottom: 8,
    },
    overrideDateText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    statusBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    statusBtnActive: { borderColor: c.primary, backgroundColor: c.primary },
    statusBtnText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    statusBtnTextActive: { color: '#fff', fontWeight: '700' },
    colorRow: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 4 },
    colorBtn: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
    },
    colorBtnSelected: { borderWidth: 3, borderColor: c.text },
    colorBtnCheck: { color: '#fff', fontSize: 18, fontWeight: '900' },
    removeOverrideBtn: {
      borderWidth: 1.5, borderColor: '#e53935', borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 12,
    },
    removeOverrideBtnText: { fontSize: 15, color: '#e53935', fontWeight: '700' },

    schedSection: {
      fontSize: 12, fontWeight: '700', color: c.textSub, marginTop: 20, marginBottom: 12,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.borderMid,
    },
    dayBtnOn: { backgroundColor: c.primary, borderColor: c.primary },
    dayBtnText: { fontSize: 11, fontWeight: '700', color: c.textMuted },
    dayBtnTextOn: { color: '#fff' },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    counterBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface,
      borderWidth: 1.5, borderColor: c.borderMid, justifyContent: 'center', alignItems: 'center',
    },
    counterBtnText: { fontSize: 22, fontWeight: '700', color: c.primary },
    counterValue: { fontSize: 28, fontWeight: '800', color: c.text, minWidth: 40, textAlign: 'center' },
    slotChip: {
      backgroundColor: c.primaryTint, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    slotChipText: { fontSize: 13, color: c.primaryTintText, fontWeight: '600' },
    addSlotRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    addSlotInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
    },
    addSlotBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 18, justifyContent: 'center',
    },
    addSlotBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    calHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 28, marginBottom: 16,
    },
    calNavBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.borderMid, justifyContent: 'center', alignItems: 'center',
    },
    calNavText: { fontSize: 20, fontWeight: '700', color: c.primary },
    calMonthLabel: { fontSize: 16, fontWeight: '700', color: c.text },
    calDowRow: { flexDirection: 'row', marginBottom: 4 },
    calDow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: c.textMuted },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
      borderRadius: 8,
    },
    calCellPast: { opacity: 0.35 },
    calDayNum: { fontSize: 14, fontWeight: '600', color: c.text },
    calDayNumPast: { color: c.textFaint },
    calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
    calClosed: { fontSize: 10, color: '#e53935', fontWeight: '900', marginTop: 1 },
    calHoliday: { fontSize: 10, color: '#e91e63', fontWeight: '900', marginTop: 1 },
    calLegend: { flexDirection: 'row', gap: 16, marginTop: 14, justifyContent: 'center' },
    calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    calLegendDot: { width: 8, height: 8, borderRadius: 4 },
    calLegendIcon: { fontSize: 10, color: c.textSub, fontWeight: '700' },
    calLegendText: { fontSize: 11, color: c.textMuted },
    calTip: { fontSize: 12, color: c.textFaint, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

    bookingCardPending: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
    bookingCardConfirmed: { borderLeftWidth: 4, borderLeftColor: '#34a853' },
    bookingCardCounter: { borderLeftWidth: 4, borderLeftColor: c.primary },
    bookingActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    counterSuggestBtn: {
      flex: 1, borderWidth: 1.5, borderColor: c.primary, borderRadius: 10,
      paddingVertical: 12, alignItems: 'center',
    },
    counterSuggestBtnText: { color: c.primary, fontSize: 14, fontWeight: '700' },
    counterSentNote: { backgroundColor: '#e3f2fd', borderRadius: 8, padding: 10, marginTop: 10 },
    counterSentText: { fontSize: 12, color: '#1565c0', fontWeight: '600' },
    counterModalContainer: { flex: 1, backgroundColor: c.background },
    counterModalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: topInset + 12, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    counterModalBack: { fontSize: 14, color: c.textMuted, fontWeight: '600', width: 60 },
    counterModalTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    counterLabel: { fontSize: 13, fontWeight: '700', color: c.textSub, marginBottom: 12 },
    counterDateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    counterDateCell: {
      width: 64, borderRadius: 10, padding: 8, alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderMid,
    },
    counterDateCellActive: { backgroundColor: c.primary, borderColor: c.primary },
    counterDateDay: { fontSize: 10, color: c.textMuted, fontWeight: '600' },
    counterDateDayActive: { color: 'rgba(255,255,255,0.8)' },
    counterDateNum: { fontSize: 20, fontWeight: '800', color: c.text, marginVertical: 2 },
    counterDateNumActive: { color: '#fff' },
    counterDateMon: { fontSize: 10, color: c.textMuted },
    counterDateMonActive: { color: 'rgba(255,255,255,0.8)' },
    counterSlotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    counterSlotChip: {
      paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    counterSlotChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    counterSlotChipText: { fontSize: 14, color: c.textSub, fontWeight: '600' },
    counterSlotChipTextActive: { color: '#fff' },
    counterNoteWrap: { marginTop: 20 },
    counterNoteInput: { minHeight: 70, textAlignVertical: 'top' },
    counterSubmitBtn: {
      backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16,
      alignItems: 'center', marginTop: 28,
    },
    counterSubmitBtnDisabled: { opacity: 0.4 },
    counterSubmitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    notesSection: {
      marginTop: 14, borderTopWidth: 1, borderTopColor: c.borderMid, paddingTop: 12,
    },
    notesSectionTitle: { fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 10 },
    noNotes: { fontSize: 12, color: c.textFaint, fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 },
    noteItem: {
      backgroundColor: c.primaryTint, borderRadius: 8, padding: 10, marginBottom: 6,
      alignSelf: 'flex-end', maxWidth: '85%',
    },
    noteItemThem: { backgroundColor: c.border, alignSelf: 'flex-start' },
    noteSender: { fontSize: 10, color: c.textMuted, marginBottom: 2, fontWeight: '600' },
    noteText: { fontSize: 13, color: c.text, lineHeight: 18 },
    noteTime: { fontSize: 10, color: c.textFaint, marginTop: 3, alignSelf: 'flex-end' },
    noteInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    noteInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 9,
      fontSize: 13, borderWidth: 1, borderColor: c.borderMid, color: c.text, letterSpacing: 0,
    },
    noteSendBtn: {
      backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    noteSendBtnDisabled: { opacity: 0.4 },
    noteSendBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    messagesToggleBtn: {
      marginTop: 10, paddingVertical: 9, paddingHorizontal: 12,
      backgroundColor: c.primaryTint, borderRadius: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    messagesToggleBtnText: { fontSize: 13, color: c.primary, fontWeight: '700', flex: 1 },
    msgDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#e53935',
    },
    shareAttachedTag: { fontSize: 11, color: c.primary, fontWeight: '600' },

    inlineShareSection: {
      marginTop: 14, borderTopWidth: 1, borderTopColor: c.borderMid, paddingTop: 12,
    },
    inlineShareTitle: { fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 10 },
    inlineVehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    inlineVehicleItem: {
      backgroundColor: c.primaryTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: '30%',
    },
    inlineVehicleLabel: { fontSize: 10, color: c.textMuted, marginBottom: 2 },
    inlineVehicleValue: { fontSize: 12, fontWeight: '700', color: c.text },
    inlineRecord: { marginBottom: 10, backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 10 },
    inlineRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    inlineRecordDate: { fontSize: 11, color: c.textMuted, fontWeight: '600' },
    inlineRecordCost: { fontSize: 11, color: c.primary, fontWeight: '700' },
    inlineRecordMileage: { fontSize: 10, color: c.textFaint, marginTop: 4 },

    calCellSelected: { borderWidth: 2, borderColor: c.primary, borderRadius: 8 },
    calBookingCount: { fontSize: 9, fontWeight: '700', marginTop: 1 },
    calBookingCountPartial: { color: '#E65100' },
    calBookingCountFull: { color: '#c62828' },

    calDayDetail: {
      marginTop: 16, backgroundColor: c.surface, borderRadius: 14, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    calDayDetailDate: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 8 },
    calDayMessage: { fontSize: 13, color: '#e53935', fontWeight: '600', marginBottom: 8, lineHeight: 18 },
    calDayClosedMsg: { fontSize: 13, color: '#e53935', fontWeight: '700', marginBottom: 8 },
    calDayEmpty: { fontSize: 14, color: c.textFaint, textAlign: 'center', paddingVertical: 12 },
    calDayBookingCard: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8,
      borderLeftWidth: 3, borderLeftColor: '#FF9800',
    },
    calDayBookingConfirmed: { borderLeftColor: '#34a853' },
    calDayBookingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    calDayBookingVehicle: { fontSize: 13, fontWeight: '700', color: c.text, flex: 1 },
    calDaySlot: { fontSize: 12, color: c.textSub, marginBottom: 3 },
    calDayNotes: { fontSize: 12, color: c.textSub, fontStyle: 'italic' },

    revSummaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    revCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    revCardLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginBottom: 4 },
    revCardValue: { fontSize: 18, fontWeight: '800', color: c.primary, marginBottom: 2 },
    revCardSub: { fontSize: 12, color: c.textFaint },
    revChartCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    revChartTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 16 },
    revBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 8 },
    revBarCol: { flex: 1, alignItems: 'center' },
    revBarTrack: { width: '100%', height: 80, backgroundColor: c.primaryTint, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    revBarFill: { width: '100%', backgroundColor: c.primary, borderRadius: 6, minHeight: 3 },
    revBarLabel: { fontSize: 10, color: c.textMuted, marginTop: 4, fontWeight: '600' },
    revBarValue: { fontSize: 9, color: c.primary, fontWeight: '700' },
    revSectionTitle: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 10 },
    revJobCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
      borderLeftWidth: 3, borderLeftColor: '#34a853',
    },
    revJobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    revJobReg: { fontSize: 15, fontWeight: '800', color: c.text },
    revJobCost: { fontSize: 15, fontWeight: '800', color: '#34a853' },
    revJobVehicle: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    revJobDesc: { fontSize: 13, color: c.textBody, marginBottom: 6, lineHeight: 18 },
    revJobMeta: { flexDirection: 'row', gap: 12 },
    revJobDate: { fontSize: 12, color: c.textFaint },
    revJobMileage: { fontSize: 12, color: c.textFaint },
    revCatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    revCatLabel: { width: 100, fontSize: 12, color: c.textSub, fontWeight: '600' },
    revCatBarTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.borderMid, marginHorizontal: 8, overflow: 'hidden' },
    revCatBarFill: { height: '100%', borderRadius: 5 },
    revCatAmount: { fontSize: 12, color: c.textMuted, fontWeight: '700', width: 42, textAlign: 'right' },

    walkinBtn: {
      backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', marginBottom: 16,
    },
    walkinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    custCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    custTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    custReg: { fontSize: 16, fontWeight: '800', color: c.text },
    custBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    custBadgeOverdue: { backgroundColor: '#c62828' },
    custBadgeDueSoon: { backgroundColor: '#e65100' },
    custBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    custVehicle: { fontSize: 13, color: c.textSub, marginTop: 2 },
    custStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    custStat: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    custPredictionText: { fontSize: 12, color: c.textSub, marginTop: 8, fontStyle: 'italic' },
    custRemindBtn: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 9,
      alignItems: 'center', marginTop: 10,
    },
    custRemindBtnDisabled: { backgroundColor: c.borderMid },
    custRemindBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    viewHistoryLink: { fontSize: 12, color: c.primary, fontWeight: '700', marginTop: 10 },

    walkinIntro: { fontSize: 13, color: c.textSub, marginBottom: 16, lineHeight: 19 },
    walkinSearchRow: { flexDirection: 'row', gap: 10 },
    walkinFindBtn: {
      backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    walkinFindBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    walkinResultCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginTop: 20,
      borderWidth: 1, borderColor: c.border,
    },
    walkinResultReg: { fontSize: 18, fontWeight: '800', color: c.text },
    walkinResultVehicle: { fontSize: 14, color: c.textSub, marginTop: 4 },
    walkinResultMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    walkinConfirmBtn: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12,
      alignItems: 'center', marginTop: 14,
    },
    walkinConfirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    ratingsSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    ratingsAvgNum: { fontSize: 44, fontWeight: '800', color: c.text },
    ratingsAvgStars: { fontSize: 16, marginBottom: 2 },
    ratingsCountText: { fontSize: 13, color: c.textMuted },
    ratingsDistWrap: { marginBottom: 28 },
    ratingsDistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    ratingsDistLabel: { width: 28, fontSize: 12, color: c.textSub, fontWeight: '600' },
    ratingsDistTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.borderMid, marginHorizontal: 8, overflow: 'hidden' },
    ratingsDistFill: { height: '100%', borderRadius: 5, backgroundColor: '#f9a825' },
    ratingsDistCount: { width: 28, fontSize: 12, color: c.textMuted, textAlign: 'right' },
    ratingsReviewsTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 12 },
    reviewCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
    },
    reviewStars: { fontSize: 13, marginBottom: 6 },
    reviewComment: { fontSize: 14, color: c.textBody, lineHeight: 20, marginBottom: 6 },
    reviewDate: { fontSize: 11, color: c.textFaint },

    empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 15, fontWeight: '700', color: c.textSub, marginBottom: 4 },
    emptySub: { fontSize: 13, color: c.textFaint, textAlign: 'center' },
  })
}
