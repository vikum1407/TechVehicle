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
  onBack: () => void
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

type Tab = 'profile' | 'schedule' | 'bookings' | 'shared'

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
  vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    mileage: number
  }
}

export default function GarageScreen({ token, onBack }: Props) {
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

  useEffect(() => {
    if (tab === 'shared' && garage) loadShares()
    if (tab === 'bookings' && garage) loadBookings()
    if (tab === 'schedule' && garage) { loadSchedule(); loadOverrides(calMonth) }
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
      await api.submitService(token, {
        shareSessionId: submittingShare.id,
        vehicleId: submittingShare.vehicleId,
        description,
        cost: subCost ? parseFloat(subCost) : undefined,
        notes: subNotes.trim() || undefined,
      })
      setSubmittedIds(prev => new Set(prev).add(submittingShare.id))
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
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{garage ? garage.name : 'Register Garage'}</Text>
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
            style={[styles.tab, tab === 'shared' && styles.tabActive]}
            onPress={() => setTab('shared')}
          >
            <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared</Text>
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
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View>
                    <Text style={styles.bookingVehicle}>
                      {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}
                    </Text>
                    <Text style={styles.bookingReg}>{booking.vehicle.registrationNo}</Text>
                  </View>
                  <View style={[
                    styles.bookingBadge,
                    isPending ? styles.bookingBadgePending : styles.bookingBadgeConfirmed,
                  ]}>
                    <Text style={styles.bookingBadgeText}>
                      {isPending ? 'Pending' : 'Confirmed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingMeta}>
                  <Text style={styles.bookingDate}>📅 {dateStr}</Text>
                  {(booking as any).slotLabel && (
                    <Text style={styles.bookingSlot}>⏰ {(booking as any).slotLabel}</Text>
                  )}
                  <Text style={styles.bookingOwner}>Owner: {booking.ownerPhone}</Text>
                  <Text style={styles.bookingMileage}>{booking.vehicle.mileage.toLocaleString()} km</Text>
                </View>

                {booking.notes ? (
                  <Text style={[
                    styles.bookingNotes,
                    (booking as any).noteType === 'urgent' && styles.bookingNotesUrgent,
                  ]}>
                    {(booking as any).noteType === 'urgent' ? '🚨 ' : ''}&ldquo;{booking.notes}&rdquo;
                  </Text>
                ) : null}

                {isPending && (
                  <TouchableOpacity
                    style={[styles.confirmBookingBtn, confirmingId === booking.id && styles.confirmBookingBtnDisabled]}
                    onPress={() => handleConfirmBooking(booking.id)}
                    disabled={confirmingId === booking.id}
                  >
                    {confirmingId === booking.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmBookingBtnText}>Confirm Appointment</Text>
                    }
                  </TouchableOpacity>
                )}

                {isConfirmed && (
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>✓ Appointment confirmed</Text>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {tab === 'shared' && garage && (
        <ScrollView contentContainerStyle={styles.content}>
          {sharesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : shares.length === 0 ? (
            <View style={styles.emptyShares}>
              <Text style={styles.emptySharesTitle}>No shared records yet</Text>
              <Text style={styles.emptySharesText}>
                When vehicle owners share their service history with your garage, it will appear here.
              </Text>
            </View>
          ) : shares.map(share => {
            const isExpanded = expandedShare === share.id
            return (
              <TouchableOpacity
                key={share.id}
                style={styles.shareCard}
                onPress={() => setExpandedShare(isExpanded ? null : share.id)}
                activeOpacity={0.8}
              >
                <View style={styles.shareCardTop}>
                  <View>
                    <Text style={styles.shareVehicle}>
                      {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
                    </Text>
                    <Text style={styles.shareReg}>{share.vehicle.registrationNo}</Text>
                  </View>
                  <View style={styles.shareRight}>
                    <Text style={styles.shareRecordCount}>{share.records.length} records</Text>
                    <Text style={styles.shareMileage}>{share.vehicle.mileage.toLocaleString()} km</Text>
                  </View>
                </View>
                <Text style={styles.shareDate}>Shared {formatDate(share.createdAt)}</Text>

                {isExpanded && (
                  <View style={styles.shareRecords}>
                    {/* Vehicle Profile */}
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>Vehicle Profile</Text>
                      <View style={styles.profileGrid}>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Registration</Text>
                          <Text style={styles.profileValueHighlight}>{share.vehicle.registrationNo}</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Fuel Type</Text>
                          <Text style={styles.profileValue}>{share.vehicle.fuelType}</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Current Mileage</Text>
                          <Text style={styles.profileValue}>{share.vehicle.mileage.toLocaleString()} km</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Fuel Economy</Text>
                          <Text style={styles.profileValue}>
                            {share.avgFuelEfficiency != null ? `${share.avgFuelEfficiency} km/L` : 'No data yet'}
                          </Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Owner Contact</Text>
                          <Text style={styles.profileValue}>{share.ownerPhone}</Text>
                        </View>
                        {share.totalServiceCost > 0 && (
                          <View style={styles.profileItem}>
                            <Text style={styles.profileLabel}>Total Service Cost</Text>
                            <Text style={styles.profileValue}>LKR {share.totalServiceCost.toLocaleString()}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Shared Records */}
                    <Text style={styles.recordsSectionTitle}>
                      Shared Service Records ({share.records.length})
                    </Text>
                    {share.records.map(r => {
                      const services = parseServices(r.description)
                      return (
                        <View key={r.id} style={styles.sharedRecord}>
                          <View style={styles.sharedRecordTop}>
                            <Text style={styles.sharedRecordDate}>{formatDate(r.date)}</Text>
                            {r.cost != null && (
                              <Text style={styles.sharedRecordCost}>LKR {r.cost.toLocaleString()}</Text>
                            )}
                          </View>
                          <View style={styles.tagRow}>
                            {services.map((s, i) => (
                              <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{s}</Text>
                              </View>
                            ))}
                          </View>
                          {r.mileage && <Text style={styles.sharedRecordMileage}>{r.mileage.toLocaleString()} km</Text>}
                        </View>
                      )
                    })}

                    {/* Submit button */}
                    <View style={styles.submitArea}>
                      {submittedIds.has(share.id) ? (
                        <View style={styles.submittedBadge}>
                          <Text style={styles.submittedText}>✓ Submitted to owner</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.openSubmitBtn}
                          onPress={() => openSubmitForm(share)}
                        >
                          <Text style={styles.openSubmitBtnText}>Submit Completed Service</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.collapseHint}>Tap card to collapse</Text>
                  </View>
                )}

                {!isExpanded && (
                  <Text style={styles.expandHint}>Tap to see shared records</Text>
                )}
              </TouchableOpacity>
            )
          })}
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
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
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
})
