import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'
import {
  SelectedItem, NO_BRAND_ITEMS, ITEM_BRANDS, CATEGORY_BRANDS,
  SERVICE_CATEGORIES, todayDMY, parseDMY,
} from '../constants/serviceData'

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
}

type Garage = {
  id: string
  name: string
  address: string | null
  brNumber: string | null
  verified: boolean
  createdAt: string
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
    mileage: number
  }
  records: SharedRecord[]
}

type Tab = 'profile' | 'schedule' | 'bookings' | 'calendar'

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
  }
  _count?: { bookingNotes: number }
}

type BookingNote = {
  id: string
  senderPhone: string
  message: string
  createdAt: string
}

export default function GarageScreen({ token, focusBookingId, onMessageCountChange, onFocusHandled, bookingSeenCounts = {}, onBookingSeen, notifUnread, onNotifPress, onNotifSeen }: Props) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('profile')
  const [shares, setShares] = useState<IncomingShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [expandedShare, setExpandedShare] = useState<string | null>(null)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
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

  // Garage profile form
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [brNumber, setBrNumber] = useState('')

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
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.getGarage(token)
      .then(data => {
        setGarage(data)
        setName(data.name)
        setAddress(data.address || '')
        setBrNumber(data.brNumber || '')
      })
      .catch(e => {
        if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadShares = async () => {
    setSharesLoading(true)
    try {
      const data = await api.getIncomingShares(token)
      setShares(data)
    } catch (e: any) {
      if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
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
      if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
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
      Alert.alert('Error', e.message)
    } finally {
      setConfirmingId(null)
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
      Alert.alert('Error', e.message)
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

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      await api.setAvailability(token, schedWorkDays, schedMaxPerDay, schedSlots)
      Alert.alert('Saved', 'Your schedule settings have been updated.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
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
      Alert.alert('Error', e.message)
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
      Alert.alert('Error', e.message)
    } finally {
      setSavingOverride(false)
    }
  }

  // When a push notification brings the user here with a specific booking, switch to bookings and open messages
  useEffect(() => {
    if (!focusBookingId || !garage) return
    setTab('bookings')
    const focusAndLoad = async () => {
      setExpandedMessagesSet(prev => new Set(prev).add(focusBookingId))
      const notes = await loadBookingNotes(focusBookingId)
      onBookingSeen?.(focusBookingId, notes.length)
      onFocusHandled?.()
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
  }, [tab, garage])

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
    setSaving(true)
    try {
      const data = await api.registerGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
    setSaving(true)
    try {
      const data = await api.updateGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
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
        mileage: booking.vehicle.mileage,
      },
      records: [],
    }
    openSubmitForm(mockShare)
    setSubmittingBookingId(booking.id)
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

  const handleSubmitService = async () => {
    if (!submittingShare) return
    const extras = otherText.trim()
      ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }]
      : []
    const allItems = [...selectedItems, ...extras]
    if (allItems.length === 0) {
      Alert.alert('Select a service', 'Please tap at least one service that was performed.')
      return
    }
    const isoDate = parseDMY(subDate)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }

    const description = allItems
      .map(i => i.brand ? `${i.name} (${i.brand})` : i.name)
      .join(', ')

    setSubmitting(true)
    try {
      const isFromBooking = !!submittingBookingId
      await api.submitService(token, {
        shareSessionId: isFromBooking ? undefined : submittingShare.id,
        bookingId: submittingBookingId || undefined,
        vehicleId: submittingShare.vehicleId,
        description,
        cost: subCost ? parseFloat(subCost) : undefined,
        notes: subNotes.trim() || undefined,
      })
      const trackKey = submittingBookingId ? `booking_${submittingBookingId}` : submittingShare.id
      setSubmittedIds(prev => new Set(prev).add(trackKey))
      setSubmittingBookingId(null)
      setSubmittingShare(null)
      Alert.alert('Submitted', 'Service record sent to the vehicle owner for acceptance.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const parseServices = (desc: string) =>
    desc.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  // ── Full-screen submission form ──────────────────────────────────────────
  if (submittingShare) {
    const share = submittingShare
    const itemsNeedingBrand = selectedItems.filter(i => !NO_BRAND_ITEMS.has(i.name))

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formTopRow}>
          <TouchableOpacity onPress={() => setSubmittingShare(null)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.formTitle}>Submit Completed Service</Text>

        {/* Which vehicle */}
        <View style={styles.vehicleBanner}>
          <Text style={styles.vehicleBannerReg}>{share.vehicle.registrationNo}</Text>
          <Text style={styles.vehicleBannerName}>
            {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
          </Text>
          <Text style={styles.vehicleBannerMileage}>{share.vehicle.mileage.toLocaleString()} km · {share.vehicle.fuelType}</Text>
        </View>

        <Text style={styles.formSubtitle}>Tap everything that was done on this visit</Text>

        {SERVICE_CATEGORIES.map(cat => (
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

        <Text style={styles.catLabel}>Other (not listed above)</Text>
        <TextInput
          style={styles.fInput}
          value={otherText}
          onChangeText={setOtherText}
          placeholder="Type anything else that was done..."
        />

        {itemsNeedingBrand.length > 0 && (
          <View style={styles.brandsSection}>
            <Text style={styles.brandsSectionTitle}>Parts Brand (optional)</Text>
            <Text style={styles.brandsSectionSub}>Select brand for each replaced part</Text>
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
                    placeholder="Or type brand..."
                  />
                </View>
              )
            })}
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.catLabel}>Service Date</Text>
            <TextInput
              style={styles.fInput}
              value={subDate}
              onChangeText={setSubDate}
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.catLabel}>Mileage (km)</Text>
            <TextInput
              style={styles.fInput}
              value={subMileage}
              onChangeText={setSubMileage}
              placeholder="e.g. 45000"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.catLabel}>Total Cost (LKR)</Text>
        <TextInput
          style={styles.fInput}
          value={subCost}
          onChangeText={setSubCost}
          placeholder="e.g. 8500"
          keyboardType="number-pad"
        />

        <Text style={styles.catLabel}>Notes for Owner (optional)</Text>
        <TextInput
          style={[styles.fInput, styles.multiline]}
          value={subNotes}
          onChangeText={setSubNotes}
          placeholder="Any observations, recommendations, or notes..."
          multiline
          numberOfLines={3}
        />

        {selectedItems.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{selectedItems.length} service{selectedItems.length > 1 ? 's' : ''} to submit</Text>
            {selectedItems.map(i => (
              <Text key={i.name} style={styles.summaryLine}>
                • {i.name}{i.brand ? ` — ${i.brand}` : ''}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitServiceBtn, submitting && styles.submitServiceBtnDisabled]}
          onPress={handleSubmitService}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitServiceBtnText}>Submit to Owner</Text>
          }
        </TouchableOpacity>
      </ScrollView>
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
      <ScrollView style={styles.container} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formTopRow}>
          <TouchableOpacity onPress={() => setEditingOverride(null)}>
            <Text style={styles.backText}>← Back to Calendar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.formTitle}>Set Day Override</Text>
        <View style={styles.overrideDateBanner}>
          <Text style={styles.overrideDateText}>{editingOverride.displayDate}</Text>
        </View>

        <Text style={styles.catLabel}>Day Status</Text>
        <View style={styles.statusRow}>
          {(['open', 'closed', 'holiday'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusBtn, ovStatus === s && styles.statusBtnActive]}
              onPress={() => setOvStatus(s)}
            >
              <Text style={[styles.statusBtnText, ovStatus === s && styles.statusBtnTextActive]}>
                {s === 'open' ? '✅ Open' : s === 'closed' ? '🔒 Closed' : '🎉 Holiday'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {ovStatus === 'open' && (
          <>
            <Text style={styles.catLabel}>Max Vehicles This Day (optional)</Text>
            <TextInput
              style={styles.fInput}
              value={ovMaxSlots}
              onChangeText={setOvMaxSlots}
              placeholder={`Leave blank to use default (${schedMaxPerDay})`}
              keyboardType="number-pad"
            />
          </>
        )}

        <Text style={styles.catLabel}>Notice Message (optional)</Text>
        <TextInput
          style={[styles.fInput, styles.multiline]}
          value={ovMessage}
          onChangeText={setOvMessage}
          placeholder="e.g. Half day only — closing at 1pm for Vesak"
          multiline
          numberOfLines={2}
        />

        {ovMessage.length > 0 && (
          <>
            <Text style={styles.catLabel}>Message Colour</Text>
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

        <TouchableOpacity
          style={[styles.submitServiceBtn, savingOverride && styles.submitServiceBtnDisabled]}
          onPress={handleSaveOverride}
          disabled={savingOverride}
        >
          {savingOverride
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitServiceBtnText}>Save Override</Text>
          }
        </TouchableOpacity>

        {editingOverride.existing && (
          <TouchableOpacity
            style={[styles.removeOverrideBtn, savingOverride && styles.submitServiceBtnDisabled]}
            onPress={handleRemoveOverride}
            disabled={savingOverride}
          >
            <Text style={styles.removeOverrideBtnText}>Remove Override (use default)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    )
  }

  // ── Normal garage view ───────────────────────────────────────────────────
  const showForm = !garage || editing

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{garage ? garage.name : 'Garage'}</Text>
        {onNotifPress && (
          <TouchableOpacity style={styles.bellBtn} onPress={onNotifPress}>
            <Text style={styles.bellIcon}>🔔</Text>
            {notifUnread && <View style={styles.bellDot} />}
          </TouchableOpacity>
        )}
      </View>

      {garage && !editing && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'profile' && styles.tabActive]}
            onPress={() => setTab('profile')}
          >
            <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'schedule' && styles.tabActive]}
            onPress={() => setTab('schedule')}
          >
            <Text style={[styles.tabText, tab === 'schedule' && styles.tabTextActive]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'bookings' && styles.tabActive]}
            onPress={() => setTab('bookings')}
          >
            <Text style={[styles.tabText, tab === 'bookings' && styles.tabTextActive]}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'calendar' && styles.tabActive]}
            onPress={() => setTab('calendar')}
          >
            <Text style={[styles.tabText, tab === 'calendar' && styles.tabTextActive]}>Calendar</Text>
          </TouchableOpacity>
        </View>
      )}

      {(tab === 'profile' || !garage) && (
        <ScrollView contentContainerStyle={styles.content}>
          {garage && !editing && (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.garageName}>{garage.name}</Text>
                <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                  <Text style={styles.badgeText}>
                    {garage.verified ? '✅ Verified Garage' : '⚠️ Unverified'}
                  </Text>
                </View>
                {garage.address && <Text style={styles.detail}>📍 {garage.address}</Text>}
                {garage.brNumber
                  ? <Text style={styles.detail}>🏢 BR: {garage.brNumber}</Text>
                  : <Text style={styles.detailMuted}>No BR number added — add one to get verified</Text>
                }
              </View>

              {!garage.verified && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>How to get Verified</Text>
                  <Text style={styles.infoText}>
                    Add your Business Registration (BR) number and our team will verify your garage.
                    Verified garages earn more trust from vehicle owners.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setName(garage.name)
                  setAddress(garage.address || '')
                  setBrNumber(garage.brNumber || '')
                  setEditing(true)
                }}
              >
                <Text style={styles.editBtnText}>Edit Garage Details</Text>
              </TouchableOpacity>
            </>
          )}

          {showForm && (
            <>
              <Text style={styles.formTitle}>{garage ? 'Edit Garage' : 'Register Your Garage'}</Text>
              <Text style={styles.formSubtitleSmall}>
                {garage
                  ? 'Update your garage details below.'
                  : 'Set up your garage profile so vehicle owners can find and share records with you.'}
              </Text>

              <Text style={styles.label}>Garage Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Silva Auto Service" />

              <Text style={styles.label}>Address (optional)</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 45/A Kandy Road, Kelaniya" />

              <Text style={styles.label}>BR Number (optional)</Text>
              <TextInput style={styles.input} value={brNumber} onChangeText={setBrNumber} placeholder="e.g. PV 00123456" autoCapitalize="characters" />

              <View style={styles.brNote}>
                <Text style={styles.brNoteText}>
                  Adding your BR number earns a ✅ Verified badge, building trust with vehicle owners.
                </Text>
              </View>

              {editing && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={garage ? handleUpdate : handleRegister}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>{garage ? 'Save Changes' : 'Register Garage'}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {tab === 'schedule' && garage && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* ── Work days ── */}
          <Text style={styles.schedSection}>Working Days</Text>
          <View style={styles.dayRow}>
            {[
              { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
              { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
            ].map(({ d, label }) => {
              const on = schedWorkDays.includes(d)
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, on && styles.dayBtnOn]}
                  onPress={() => setSchedWorkDays(prev =>
                    on ? prev.filter(x => x !== d) : [...prev, d]
                  )}
                >
                  <Text style={[styles.dayBtnText, on && styles.dayBtnTextOn]}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ── Max per day ── */}
          <Text style={styles.schedSection}>Max Vehicles Per Day</Text>
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
          <Text style={styles.schedSection}>Time Slots</Text>
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
              <Text style={styles.addSlotBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingSchedule && styles.saveBtnDisabled]}
            onPress={handleSaveSchedule}
            disabled={savingSchedule}
          >
            {savingSchedule
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Schedule Settings</Text>
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
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} style={styles.calDow}>{d}</Text>
            ))}
          </View>

          {overridesLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#1a73e8" />
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
              <Text style={styles.calLegendText}>Custom notice</Text>
            </View>
            <View style={styles.calLegendItem}>
              <Text style={styles.calLegendIcon}>✕</Text>
              <Text style={styles.calLegendText}>Closed</Text>
            </View>
            <View style={styles.calLegendItem}>
              <Text style={styles.calLegendIcon}>★</Text>
              <Text style={styles.calLegendText}>Holiday</Text>
            </View>
          </View>
          <Text style={styles.calTip}>Tap any future date to set or edit an override.</Text>
        </ScrollView>
      )}

      {tab === 'bookings' && garage && (
        <ScrollView contentContainerStyle={styles.content}>
          {bookingsLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : bookings.length === 0 ? (
            <View style={styles.emptyShares}>
              <Text style={styles.emptySharesTitle}>No bookings yet</Text>
              <Text style={styles.emptySharesText}>
                When vehicle owners book a service appointment, they will appear here.
              </Text>
            </View>
          ) : bookings.map(booking => {
            const d = new Date(booking.date)
            const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
            const isPending = booking.status === 'pending'
            const isConfirmed = booking.status === 'confirmed'
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
                style={[
                  styles.bookingCard,
                  isPending && styles.bookingCardPending,
                  isConfirmed && styles.bookingCardConfirmed,
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
                      isPending ? styles.bookingBadgePending : styles.bookingBadgeConfirmed,
                    ]}>
                      <Text style={styles.bookingBadgeText}>
                        {isPending ? 'Pending' : 'Confirmed'}
                      </Text>
                    </View>
                    {attachedShare && (
                      <Text style={styles.shareAttachedTag}>📎 History attached</Text>
                    )}
                  </View>
                </View>

                <View style={styles.bookingMeta}>
                  <Text style={styles.bookingDate}>📅 {dateStr}</Text>
                  {bAny.slotLabel && (
                    <Text style={styles.bookingSlot}>⏰ {bAny.slotLabel}</Text>
                  )}
                  <Text style={styles.bookingOwner}>Owner: {booking.ownerPhone}</Text>
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
                  <TouchableOpacity
                    style={[styles.confirmBookingBtn, confirmingId === booking.id && styles.confirmBookingBtnDisabled]}
                    onPress={(e) => { e.stopPropagation?.(); handleConfirmBooking(booking.id) }}
                    disabled={confirmingId === booking.id}
                  >
                    {confirmingId === booking.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmBookingBtnText}>Confirm Appointment</Text>
                    }
                  </TouchableOpacity>
                )}

                {isConfirmed && !attachedShare && !isExpanded && (
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>✓ Confirmed — tap to submit service</Text>
                  </View>
                )}

                {/* ── Expanded: confirmed without share → show submit button ── */}
                {isExpanded && isConfirmed && !attachedShare && (
                  <View style={styles.inlineShareSection}>
                    <Text style={styles.inlineShareTitle}>No service history was attached to this booking.</Text>
                    {alreadySubmitted ? (
                      <View style={styles.submittedBadge}>
                        <Text style={styles.submittedText}>✓ Service submitted — awaiting owner approval</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.openSubmitBtn}
                        onPress={(e) => { e.stopPropagation?.(); openSubmitFormFromBooking(booking) }}
                      >
                        <Text style={styles.openSubmitBtnText}>Submit Completed Service</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* ── Expanded: shared records + submit ── */}
                {isExpanded && attachedShare && (
                  <View style={styles.inlineShareSection}>
                    <Text style={styles.inlineShareTitle}>
                      📋 Shared Service History ({attachedShare.records.length} records)
                    </Text>

                    {/* Vehicle profile */}
                    <View style={styles.inlineVehicleRow}>
                      <View style={styles.inlineVehicleItem}>
                        <Text style={styles.inlineVehicleLabel}>Fuel Type</Text>
                        <Text style={styles.inlineVehicleValue}>{attachedShare.vehicle.fuelType}</Text>
                      </View>
                      <View style={styles.inlineVehicleItem}>
                        <Text style={styles.inlineVehicleLabel}>Mileage</Text>
                        <Text style={styles.inlineVehicleValue}>{attachedShare.vehicle.mileage.toLocaleString()} km</Text>
                      </View>
                      {attachedShare.avgFuelEfficiency != null && (
                        <View style={styles.inlineVehicleItem}>
                          <Text style={styles.inlineVehicleLabel}>Avg Economy</Text>
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
                          <Text style={styles.submittedText}>✓ Service submitted — awaiting owner approval</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.openSubmitBtn}
                          onPress={() => openSubmitForm(attachedShare)}
                        >
                          <Text style={styles.openSubmitBtnText}>Submit Completed Service</Text>
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
                    💬 Messages with Owner {expandedMessagesSet.has(booking.id) ? '▲' : '▼'}
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
                      <ActivityIndicator size="small" color="#1a73e8" style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {(bookingNotesMap[booking.id] || []).length === 0 ? (
                          <Text style={styles.noNotes}>No messages yet — start the conversation below</Text>
                        ) : (bookingNotesMap[booking.id] || []).map(note => (
                          <View
                            key={note.id}
                            style={[
                              styles.noteItem,
                              note.senderPhone === booking.ownerPhone && styles.noteItemThem,
                            ]}
                          >
                            <Text style={styles.noteSender}>
                              {note.senderPhone === booking.ownerPhone ? 'Owner' : 'You (Garage)'}
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
                            placeholder="Type a message to the owner..."
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

                {!isExpanded && (
                  <Text style={styles.expandHint}>
                    {attachedShare
                      ? 'Tap to view shared history & submit service'
                      : isConfirmed
                        ? 'Tap to submit completed service'
                        : 'Tap to expand'}
                  </Text>
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
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} style={styles.calDow}>{d}</Text>
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

                  let cellBg = '#fff'
                  if (override?.status === 'closed' || override?.status === 'holiday') {
                    cellBg = '#fce4ec'
                  } else if (fillRatio >= 1) {
                    cellBg = '#ffebee'
                  } else if (fillRatio > 0) {
                    cellBg = '#fff3e0'
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
                      <Text style={[styles.calDayNum, isSelected && { color: '#1a73e8' }]}>{day}</Text>
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
              <Text style={styles.calLegendText}>Partial</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ffcdd2' }]} />
              <Text style={styles.calLegendText}>Full</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: '#e53935' }]} />
              <Text style={styles.calLegendText}>Notice</Text>
            </View>
          </View>
          <Text style={styles.calTip}>Tap a date to see bookings for that day.</Text>

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
                  <Text style={styles.calDayClosedMsg}>Closed this day</Text>
                )}
                {override?.status === 'holiday' && (
                  <Text style={styles.calDayClosedMsg}>Holiday — {override.message || 'no description'}</Text>
                )}

                {dayBookings.length === 0 ? (
                  <Text style={styles.calDayEmpty}>No bookings on this day.</Text>
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
                          <Text style={styles.bookingBadgeText}>{b.status}</Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Submission form
  formContent: { padding: 20, paddingBottom: 56 },
  formTopRow: { marginTop: 48, marginBottom: 8 },
  formTitle: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  formSubtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  formSubtitleSmall: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  vehicleBanner: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 16, marginBottom: 20,
  },
  vehicleBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  vehicleBannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  vehicleBannerMileage: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1.5,
    borderColor: '#ddd', backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  check: { fontSize: 13, color: '#fff' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  brandsSection: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: '#e8f0fe',
  },
  brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 2 },
  brandsSectionSub: { fontSize: 12, color: '#888', marginBottom: 12 },
  brandRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 14, marginTop: 14 },
  brandItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  brandChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18, borderWidth: 1.5,
    borderColor: '#e0e0e0', backgroundColor: '#f9f9f9',
  },
  brandChipSelected: { backgroundColor: '#34a853', borderColor: '#34a853' },
  brandChipText: { fontSize: 12, color: '#555' },
  brandChipTextSelected: { color: '#fff', fontWeight: '600' },
  fInput: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  summary: { backgroundColor: '#e6f4ea', borderRadius: 12, padding: 16, marginTop: 20 },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
  summaryLine: { fontSize: 13, color: '#333', marginBottom: 4, lineHeight: 20 },
  submitServiceBtn: {
    backgroundColor: '#2e7d32', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  submitServiceBtnDisabled: { opacity: 0.6 },
  submitServiceBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Normal garage view
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600', marginBottom: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  bellBtn: { padding: 4, position: 'relative' },
  bellIcon: { fontSize: 22 },
  bellDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#e53935', borderWidth: 1.5, borderColor: '#fff',
  },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a73e8' },
  content: { padding: 20, paddingBottom: 48 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  garageName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14 },
  badgeVerified: { backgroundColor: '#e6f4ea' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 14, color: '#555', marginBottom: 6 },
  detailMuted: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  infoBox: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#333', lineHeight: 20 },
  editBtn: {
    borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
  },
  brNote: { backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginTop: 14 },
  brNoteText: { fontSize: 13, color: '#1a73e8', lineHeight: 19 },
  cancelBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  cancelBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyShares: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptySharesTitle: { fontSize: 17, fontWeight: '700', color: '#555', marginBottom: 10 },
  emptySharesText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  shareCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  shareCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  shareVehicle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  shareReg: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  shareRight: { alignItems: 'flex-end' },
  shareRecordCount: { fontSize: 13, fontWeight: '700', color: '#1a73e8' },
  shareMileage: { fontSize: 12, color: '#888', marginTop: 2 },
  shareDate: { fontSize: 12, color: '#aaa', marginBottom: 6 },
  expandHint: { fontSize: 11, color: '#bbb', marginTop: 4 },
  shareRecords: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  sharedRecord: { marginBottom: 12 },
  sharedRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sharedRecordDate: { fontSize: 12, color: '#888', fontWeight: '600' },
  sharedRecordCost: { fontSize: 12, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: { backgroundColor: '#f0f4ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#333' },
  sharedRecordMileage: { fontSize: 11, color: '#aaa' },
  collapseHint: { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'center' },
  profileSection: { backgroundColor: '#f0f6ff', borderRadius: 10, padding: 14, marginBottom: 14 },
  profileSectionTitle: { fontSize: 12, fontWeight: '700', color: '#1a73e8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileItem: { width: '47%' },
  profileLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 2 },
  profileValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  profileValueHighlight: { fontSize: 14, color: '#1a73e8', fontWeight: '800' },
  recordsSectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  submitArea: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingTop: 14 },
  submittedBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, alignItems: 'center' },
  submittedText: { fontSize: 14, color: '#2e7d32', fontWeight: '700' },
  openSubmitBtn: { backgroundColor: '#2e7d32', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  openSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Booking cards
  bookingCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  bookingVehicle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  bookingReg: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  bookingBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  bookingBadgePending: { backgroundColor: '#fff8e1' },
  bookingBadgeConfirmed: { backgroundColor: '#e6f4ea' },
  bookingBadgeText: { fontSize: 12, fontWeight: '700', color: '#555' },
  bookingMeta: { gap: 3, marginBottom: 10 },
  bookingDate: { fontSize: 14, fontWeight: '600', color: '#333' },
  bookingOwner: { fontSize: 13, color: '#888' },
  bookingMileage: { fontSize: 13, color: '#888' },
  bookingNotes: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 12, lineHeight: 18 },
  confirmBookingBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  confirmBookingBtnDisabled: { opacity: 0.6 },
  confirmBookingBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  confirmedBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, alignItems: 'center' },
  confirmedText: { fontSize: 13, color: '#2e7d32', fontWeight: '700' },
  bookingSlot: { fontSize: 13, color: '#555' },
  bookingNotesUrgent: { color: '#e53935', fontWeight: '700' },

  // Override editor
  overrideDateBanner: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 16, marginBottom: 8,
  },
  overrideDateText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff',
  },
  statusBtnActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
  statusBtnTextActive: { color: '#1a1a1a' },
  colorRow: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 4 },
  colorBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  colorBtnSelected: { borderWidth: 3, borderColor: '#1a1a1a' },
  colorBtnCheck: { color: '#fff', fontSize: 18, fontWeight: '900' },
  removeOverrideBtn: {
    borderWidth: 1.5, borderColor: '#e53935', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  removeOverrideBtnText: { fontSize: 15, color: '#e53935', fontWeight: '700' },

  // Schedule tab
  schedSection: {
    fontSize: 12, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd',
  },
  dayBtnOn: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  dayBtnText: { fontSize: 11, fontWeight: '700', color: '#888' },
  dayBtnTextOn: { color: '#fff' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center',
  },
  counterBtnText: { fontSize: 22, fontWeight: '700', color: '#1a73e8' },
  counterValue: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', minWidth: 40, textAlign: 'center' },
  slotChip: {
    backgroundColor: '#e8f0fe', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  slotChipText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  addSlotRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addSlotInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#ddd',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
  },
  addSlotBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  addSlotBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Calendar
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 28, marginBottom: 16,
  },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center',
  },
  calNavText: { fontSize: 20, fontWeight: '700', color: '#1a73e8' },
  calMonthLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  calDowRow: { flexDirection: 'row', marginBottom: 4 },
  calDow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#888' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  calCellPast: { opacity: 0.35 },
  calDayNum: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  calDayNumPast: { color: '#bbb' },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  calClosed: { fontSize: 10, color: '#e53935', fontWeight: '900', marginTop: 1 },
  calHoliday: { fontSize: 10, color: '#e91e63', fontWeight: '900', marginTop: 1 },
  calLegend: { flexDirection: 'row', gap: 16, marginTop: 14, justifyContent: 'center' },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendIcon: { fontSize: 10, color: '#555', fontWeight: '700' },
  calLegendText: { fontSize: 11, color: '#888' },
  calTip: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  // Booking card color-coding by status
  bookingCardPending: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  bookingCardConfirmed: { borderLeftWidth: 4, borderLeftColor: '#34a853' },

  // Notes / message thread in booking card
  notesSection: {
    marginTop: 14, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingTop: 12,
  },
  notesSectionTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 10 },
  noNotes: { fontSize: 12, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 },
  noteItem: {
    backgroundColor: '#e8f0fe', borderRadius: 8, padding: 10, marginBottom: 6,
    alignSelf: 'flex-end', maxWidth: '85%',
  },
  noteItemThem: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  noteSender: { fontSize: 10, color: '#888', marginBottom: 2, fontWeight: '600' },
  noteText: { fontSize: 13, color: '#1a1a1a', lineHeight: 18 },
  noteTime: { fontSize: 10, color: '#aaa', marginTop: 3, alignSelf: 'flex-end' },
  noteInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  noteInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, borderWidth: 1, borderColor: '#e0e0e0',
  },
  noteSendBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  noteSendBtnDisabled: { opacity: 0.4 },
  noteSendBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  messagesToggleBtn: {
    marginTop: 10, paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: '#f0f4ff', borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  messagesToggleBtnText: { fontSize: 13, color: '#1a73e8', fontWeight: '700', flex: 1 },
  msgDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#e53935',
  },
  shareAttachedTag: { fontSize: 11, color: '#1a73e8', fontWeight: '600' },

  // Inline shared records inside booking card
  inlineShareSection: {
    marginTop: 14, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingTop: 12,
  },
  inlineShareTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 10 },
  inlineVehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  inlineVehicleItem: {
    backgroundColor: '#f0f4ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: '30%',
  },
  inlineVehicleLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  inlineVehicleValue: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  inlineRecord: { marginBottom: 10, backgroundColor: '#fafafa', borderRadius: 8, padding: 10 },
  inlineRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  inlineRecordDate: { fontSize: 11, color: '#888', fontWeight: '600' },
  inlineRecordCost: { fontSize: 11, color: '#1a73e8', fontWeight: '700' },
  inlineRecordMileage: { fontSize: 10, color: '#aaa', marginTop: 4 },

  // Calendar tab — booking density
  calCellSelected: { borderWidth: 2, borderColor: '#1a73e8', borderRadius: 8 },
  calBookingCount: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  calBookingCountPartial: { color: '#E65100' },
  calBookingCountFull: { color: '#c62828' },

  // Calendar day detail panel
  calDayDetail: {
    marginTop: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  calDayDetailDate: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  calDayMessage: { fontSize: 13, color: '#e53935', fontWeight: '600', marginBottom: 8, lineHeight: 18 },
  calDayClosedMsg: { fontSize: 13, color: '#e53935', fontWeight: '700', marginBottom: 8 },
  calDayEmpty: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingVertical: 12 },
  calDayBookingCard: {
    backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#FF9800',
  },
  calDayBookingConfirmed: { borderLeftColor: '#34a853' },
  calDayBookingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  calDayBookingVehicle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  calDaySlot: { fontSize: 12, color: '#555', marginBottom: 3 },
  calDayNotes: { fontSize: 12, color: '#555', fontStyle: 'italic' },
})
