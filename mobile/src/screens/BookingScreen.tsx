import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import Button from '../components/Button'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  mileage: number
}

type Props = {
  token: string
  vehicle: Vehicle
  onBack: () => void
  onBooked: () => void
}

type GarageResult = {
  id: string
  name: string
  address: string | null
  verified: boolean
}

type DateSlot = {
  date: string
  dayName: string
  dayNum: number
  month: string
  isWorkDay: boolean
  status: string
  available: boolean
  remaining: number
  message: string | null
  messageColor: string | null
  slots: { label: string; booked: number; available: boolean }[]
}

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type Step = 'search' | 'dates' | 'slots' | 'confirm'

export default function BookingScreen({ token, vehicle, onBack, onBooked }: Props) {
  const [step, setStep] = useState<Step>('search')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GarageResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedGarage, setSelectedGarage] = useState<GarageResult | null>(null)

  const [dates, setDates] = useState<DateSlot[]>([])
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<DateSlot | null>(null)

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [serviceType, setServiceType] = useState<'full' | 'between' | 'third_party' | ''>('')
  const [notes, setNotes] = useState('')
  const [noteType, setNoteType] = useState<'normal' | 'urgent'>('normal')
  const [booking, setBooking] = useState(false)

  // Share history state
  const [shareEnabled, setShareEnabled] = useState(false)
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set())
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  // Load service records when entering confirm step
  useEffect(() => {
    if (step === 'confirm') {
      setRecordsLoading(true)
      api.getServiceRecords(token, vehicle.id)
        .then((records: ServiceRecord[]) => {
          setServiceRecords(records)
          // Pre-select latest 3
          const latest = records.slice(0, 3).map((r: ServiceRecord) => r.id)
          setSelectedRecordIds(new Set(latest))
        })
        .catch(() => {})
        .finally(() => setRecordsLoading(false))
    }
  }, [step])

  const toggleRecord = (id: string) => {
    setSelectedRecordIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const results = await api.searchGarages(token, searchQuery.trim())
      setSearchResults(results)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectGarage = async (garage: GarageResult) => {
    setSelectedGarage(garage)
    setStep('dates')
    setDatesLoading(true)
    try {
      const data = await api.getAvailabilityDates(token, garage.id, 14)
      setDates(data.dates)
      setTimeSlots(data.timeSlots || [])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setDatesLoading(false)
    }
  }

  const handleSelectDate = (slot: DateSlot) => {
    if (!slot.available) return
    setSelectedDate(slot)
    setSelectedSlot(null)
    if (timeSlots.length > 0) {
      setStep('slots')
    } else {
      setStep('confirm')
    }
  }

  const handleSelectSlot = (label: string) => {
    setSelectedSlot(label)
    setStep('confirm')
  }

  const handleConfirmBooking = async () => {
    if (!selectedGarage || !selectedDate) return
    setBooking(true)
    try {
      let shareSessionId: string | undefined

      if (shareEnabled && selectedRecordIds.size > 0) {
        const share = await api.createShare(token, {
          vehicleId: vehicle.id,
          garageId: selectedGarage.id,
          recordIds: Array.from(selectedRecordIds),
          serviceType: serviceType || undefined,
        })
        shareSessionId = share.id
      }

      await api.createBooking(token, {
        vehicleId: vehicle.id,
        garageId: selectedGarage.id,
        date: selectedDate.date,
        slotLabel: selectedSlot || undefined,
        notes: notes.trim() || undefined,
        noteType,
        shareSessionId,
        serviceType: serviceType || undefined,
      })
      Alert.alert(
        'Booking Sent',
        `Your booking request has been sent to ${selectedGarage.name}. They will confirm shortly.`,
        [{ text: 'OK', onPress: onBooked }]
      )
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setBooking(false)
    }
  }

  // ── Step 1: Search garage ──────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <ScreenHeader title="Book Service" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.vehicleBanner}>
            <Text style={styles.vehicleBannerReg}>{vehicle.registrationNo}</Text>
            <Text style={styles.vehicleBannerName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            <Text style={styles.vehicleBannerMileage}>{vehicle.mileage.toLocaleString()} km</Text>
          </View>

          <Text style={styles.sectionLabel}>Find a Garage</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by garage name..."
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchBtn, searching && styles.btnDisabled]}
              onPress={handleSearch}
              disabled={searching}
            >
              {searching
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.searchBtnText}>Search</Text>
              }
            </TouchableOpacity>
          </View>

          {searchResults.length === 0 && !searching && searchQuery.length > 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No garages found</Text>
              <Text style={styles.emptyText}>Try a different name or check the spelling.</Text>
            </View>
          )}

          {searchResults.map(garage => (
            <TouchableOpacity
              key={garage.id}
              style={styles.garageCard}
              onPress={() => handleSelectGarage(garage)}
              activeOpacity={0.8}
            >
              <View style={styles.garageCardLeft}>
                <Text style={styles.garageName}>{garage.name}</Text>
                {garage.address && <Text style={styles.garageAddress}>{garage.address}</Text>}
              </View>
              <View style={styles.garageCardRight}>
                <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                  <Text style={styles.badgeText}>{garage.verified ? '✅ Verified' : '⚠️ Unverified'}</Text>
                </View>
                <Text style={styles.selectText}>Select →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Step 2: Pick a date ────────────────────────────────────────────────────
  if (step === 'dates') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <ScreenHeader title="Pick a Date" onBack={() => setStep('search')} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.selectedGarageBanner}>
            <Text style={styles.selectedGarageName}>{selectedGarage?.name}</Text>
            {selectedGarage?.verified && <Text style={styles.verifiedLabel}>✅ Verified</Text>}
          </View>

          <Text style={styles.sectionLabel}>Available in the next 14 days</Text>

          {datesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
          ) : (
            <View style={styles.dateGrid}>
              {(() => {
                const todayStr = new Date().toISOString().split('T')[0]
                return dates.map(slot => {
                const hasMsg = !!slot.message
                const msgColor = slot.messageColor || colors.orange
                const isToday = slot.date === todayStr
                return (
                  <TouchableOpacity
                    key={slot.date}
                    style={[
                      styles.dateCell,
                      slot.available && styles.dateCellAvailable,
                      slot.status === 'closed' && styles.dateCellOff,
                      slot.status === 'holiday' && styles.dateCellHoliday,
                      slot.isWorkDay && !slot.available && slot.status === 'open' && styles.dateCellFull,
                      hasMsg && slot.available && { borderColor: msgColor, borderWidth: 2 },
                      isToday && styles.dateCellToday,
                    ]}
                    onPress={() => handleSelectDate(slot)}
                    disabled={!slot.available}
                    activeOpacity={slot.available ? 0.7 : 1}
                  >
                    <Text style={[styles.dateDayName, !slot.available && styles.dateDimText]}>
                      {slot.dayName}
                    </Text>
                    <View style={[styles.todayCircleWrap, isToday && styles.todayCircleWrapActive]}>
                      <Text style={[
                        styles.dateDayNum,
                        slot.available && styles.dateDayNumAvailable,
                        isToday && styles.dateDayNumToday,
                      ]}>
                        {slot.dayNum}
                      </Text>
                    </View>
                    <Text style={[styles.dateMonth, !slot.available && styles.dateDimText]}>
                      {slot.month}
                    </Text>
                    {slot.available && (
                      <Text style={styles.dateSlotsAvail}>{slot.remaining} left</Text>
                    )}
                    {slot.status === 'closed' && <Text style={styles.dateClosedText}>Closed</Text>}
                    {slot.status === 'holiday' && <Text style={styles.dateHolidayText}>Holiday</Text>}
                    {slot.isWorkDay && slot.status === 'open' && !slot.available && (
                      <Text style={styles.dateFullText}>Full</Text>
                    )}
                    {hasMsg && (
                      <View style={[styles.msgDot, { backgroundColor: msgColor }]} />
                    )}
                  </TouchableOpacity>
                )
              })})()}
            </View>
          )}

          {!datesLoading && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                <Text style={styles.legendText}>Full / Closed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.orange }]} />
                <Text style={styles.legendText}>Special notice</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Step 3: Pick a time slot ───────────────────────────────────────────────
  if (step === 'slots') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <ScreenHeader title="Pick a Time Slot" onBack={() => setStep('dates')} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.selectedGarageBanner}>
            <Text style={styles.selectedGarageName}>{selectedGarage?.name}</Text>
            <Text style={styles.selectedDateLabel}>
              {selectedDate?.dayName} {selectedDate?.dayNum} {selectedDate?.month}
            </Text>
          </View>

          {selectedDate?.message && (
            <View style={[styles.msgBanner, { borderLeftColor: selectedDate.messageColor || colors.orange }]}>
              <Text style={[styles.msgBannerText, { color: selectedDate.messageColor || colors.orange }]}>
                {selectedDate.message}
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Select a time slot</Text>
          {(selectedDate?.slots || []).map(slot => (
            <TouchableOpacity
              key={slot.label}
              style={[
                styles.slotCard,
                slot.available && slot.booked > 0 && styles.slotCardPartial,
                !slot.available && styles.slotCardUnavailable,
              ]}
              onPress={() => slot.available && handleSelectSlot(slot.label)}
              disabled={!slot.available}
              activeOpacity={slot.available ? 0.8 : 1}
            >
              <View>
                <Text style={[styles.slotLabel, !slot.available && styles.slotLabelDim]}>
                  {slot.label}
                </Text>
                {slot.available && slot.booked > 0 && (
                  <Text style={styles.slotBookedWarning}>Already Booked</Text>
                )}
              </View>
              {slot.available
                ? <Text style={[styles.slotSelectArrow, slot.booked > 0 && { color: colors.orange }]}>Select →</Text>
                : <Text style={styles.slotFullText}>Already Booked</Text>
              }
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Step 4: Confirm ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader
        title="Confirm Booking"
        onBack={() => setStep(timeSlots.length > 0 ? 'slots' : 'dates')}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {selectedDate?.message && (
          <View style={[styles.msgBanner, { borderLeftColor: selectedDate.messageColor || colors.orange }]}>
            <Text style={[styles.msgBannerText, { color: selectedDate.messageColor || colors.orange }]}>
              {selectedDate.message}
            </Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vehicle</Text>
            <Text style={styles.summaryValue}>{vehicle.registrationNo}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel} />
            <Text style={styles.summaryValueSub}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Garage</Text>
            <Text style={styles.summaryValue}>{selectedGarage?.name}</Text>
          </View>
          {selectedGarage?.address && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel} />
              <Text style={styles.summaryValueSub}>{selectedGarage.address}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryValue}>
              {selectedDate?.dayName} {selectedDate?.dayNum} {selectedDate?.month}
            </Text>
          </View>
          {selectedSlot && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time Slot</Text>
              <Text style={styles.summaryValue}>{selectedSlot}</Text>
            </View>
          )}
        </View>

        {/* ── Service type ── */}
        <Text style={styles.sectionLabel}>Type of Visit</Text>
        <View style={styles.serviceTypeRow}>
          {([
            { key: 'full', label: 'Full Service', icon: '🔧' },
            { key: 'between', label: 'Between Service', icon: '⚡' },
            { key: 'third_party', label: 'Third-Party', icon: '🏭' },
          ] as const).map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.serviceTypeBtn, serviceType === opt.key && styles.serviceTypeBtnActive]}
              onPress={() => setServiceType(serviceType === opt.key ? '' : opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceTypeIcon}>{opt.icon}</Text>
              <Text style={[styles.serviceTypeBtnText, serviceType === opt.key && styles.serviceTypeBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Share history section ── */}
        <Text style={styles.sectionLabel}>Share History with Garage</Text>

        <TouchableOpacity
          style={[styles.shareToggleCard, shareEnabled && styles.shareToggleCardOn]}
          onPress={() => setShareEnabled(prev => !prev)}
          activeOpacity={0.8}
        >
          <View style={styles.shareToggleLeft}>
            <Text style={styles.shareToggleIcon}>📋</Text>
            <View style={styles.shareToggleText}>
              <Text style={[styles.shareToggleTitle, shareEnabled && styles.shareToggleTitleOn]}>
                Attach recent service records
              </Text>
              <Text style={[styles.shareToggleDesc, shareEnabled && styles.shareToggleDescOn]}>
                Let the garage see your vehicle's service history
              </Text>
            </View>
          </View>
          <View style={[styles.togglePill, shareEnabled && styles.togglePillOn]}>
            <Text style={[styles.togglePillText, shareEnabled && styles.togglePillTextOn]}>{shareEnabled ? 'ON' : 'OFF'}</Text>
          </View>
        </TouchableOpacity>

        {shareEnabled && (
          <>
            {recordsLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
            ) : serviceRecords.length === 0 ? (
              <View style={styles.noRecordsBox}>
                <Text style={styles.noRecordsText}>No service records found for this vehicle.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.recordHint}>
                  Select records to share ({selectedRecordIds.size} selected):
                </Text>
                {serviceRecords.map(record => {
                  const selected = selectedRecordIds.has(record.id)
                  return (
                    <TouchableOpacity
                      key={record.id}
                      style={[styles.recordCard, selected && styles.recordCardOn]}
                      onPress={() => toggleRecord(record.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.recordCheck, selected && styles.recordCheckOn]}>
                        {selected && <Text style={styles.recordCheckMark}>✓</Text>}
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={[styles.recordDate, selected && styles.recordDateOn]}>
                          {new Date(record.date).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </Text>
                        <Text style={[styles.recordDesc, selected && styles.recordDescOn]} numberOfLines={1}>{record.description}</Text>
                        {record.mileage != null && (
                          <Text style={[styles.recordMileage, selected && styles.recordMileageOn]}>{record.mileage.toLocaleString()} km</Text>
                        )}
                      </View>
                      {record.cost != null && (
                        <Text style={[styles.recordCost, selected && styles.recordCostOn]}>LKR {record.cost.toLocaleString()}</Text>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ── Notes section ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Notes for Garage (optional)</Text>

        <View style={styles.noteTypeRow}>
          <TouchableOpacity
            style={[styles.noteTypeBtn, noteType === 'normal' && styles.noteTypeBtnActive]}
            onPress={() => setNoteType('normal')}
          >
            <Text style={[styles.noteTypeBtnText, noteType === 'normal' && styles.noteTypeBtnTextActive]}>
              Normal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.noteTypeBtn, noteType === 'urgent' && styles.noteTypeBtnUrgent]}
            onPress={() => setNoteType('urgent')}
          >
            <Text style={[styles.noteTypeBtnText, noteType === 'urgent' && styles.noteTypeBtnTextActive]}>
              🚨 Urgent
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.notesInput,
            noteType === 'urgent' && styles.notesInputUrgent,
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder={
            noteType === 'urgent'
              ? 'Describe the urgent issue...'
              : 'e.g. Oil change + brake check, please call before starting...'
          }
          multiline
          numberOfLines={3}
        />

        <View style={styles.confirmBtnWrap}>
          <Button title="Confirm Booking" onPress={handleConfirmBooking} loading={booking} />
        </View>

        <Text style={styles.confirmNote}>
          Your request will be sent to the garage. They'll confirm or suggest an alternative.
        </Text>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 40 },

    vehicleBanner: {
      backgroundColor: c.primary, borderRadius: 14, padding: 16, marginBottom: 20,
    },
    vehicleBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
    vehicleBannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
    vehicleBannerMileage: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: c.textSub,
      marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
    },

    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    searchInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: c.text, letterSpacing: 0,
    },
    searchBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 18, justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    emptyBox: { alignItems: 'center', marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: c.textBody, marginBottom: 6 },
    emptyText: { fontSize: 14, color: c.textMuted, textAlign: 'center' },

    garageCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    garageCardLeft: { flex: 1 },
    garageCardRight: { alignItems: 'flex-end', gap: 6 },
    garageName: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 3 },
    garageAddress: { fontSize: 13, color: c.textMuted },
    badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    badgeVerified: { backgroundColor: '#e8f5e9' },
    badgeUnverified: { backgroundColor: '#fff8e1' },
    badgeText: { fontSize: 12, fontWeight: '600' },
    selectText: { fontSize: 13, color: c.primary, fontWeight: '600' },

    selectedGarageBanner: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 20,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    selectedGarageName: { fontSize: 16, fontWeight: '700', color: c.text },
    selectedDateLabel: { fontSize: 14, color: c.primary, fontWeight: '600' },
    verifiedLabel: { fontSize: 13, color: c.success, fontWeight: '600' },

    dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    dateCell: {
      width: '30%', backgroundColor: c.surface, borderRadius: 12, padding: 10,
      alignItems: 'center', borderWidth: 1.5, borderColor: c.borderMid,
    },
    dateCellAvailable: { borderColor: c.primary, backgroundColor: c.primaryTint },
    dateCellOff: { backgroundColor: c.surfaceAlt, borderColor: c.borderMid },
    dateCellHoliday: { backgroundColor: '#fce4ec', borderColor: '#f48fb1' },
    dateCellFull: { backgroundColor: '#fff5f5', borderColor: '#ffcdd2' },
    dateDayName: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginBottom: 3 },
    dateDimText: { color: c.textFaint },
    dateDayNum: { fontSize: 20, fontWeight: '800', color: c.textSub, marginBottom: 2 },
    dateDayNumAvailable: { color: c.primary },
    dateMonth: { fontSize: 11, color: c.textMuted, marginBottom: 3 },
    dateSlotsAvail: { fontSize: 10, fontWeight: '700', color: c.success, marginTop: 2 },
    dateClosedText: { fontSize: 10, color: c.textFaint, fontWeight: '600', marginTop: 2 },
    dateHolidayText: { fontSize: 10, color: '#e91e63', fontWeight: '700', marginTop: 2 },
    dateFullText: { fontSize: 10, color: c.error, fontWeight: '700', marginTop: 2 },
    msgDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
    dateCellToday: { borderColor: '#FFC107', borderWidth: 2 },
    todayCircleWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    todayCircleWrapActive: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: '#FFC107', alignItems: 'center', justifyContent: 'center',
    },
    dateDayNumToday: { color: '#1a1a1a' },

    legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: c.textMuted },

    msgBanner: {
      backgroundColor: c.surface, borderRadius: 10, padding: 14, marginBottom: 16,
      borderLeftWidth: 4,
    },
    msgBannerText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },

    slotCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 18, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1.5, borderColor: c.primary,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    slotCardPartial: { borderColor: c.orange, backgroundColor: '#fff8f0' },
    slotCardUnavailable: { borderColor: c.borderMid, backgroundColor: c.surfaceAlt },
    slotLabel: { fontSize: 16, fontWeight: '700', color: c.text },
    slotLabelDim: { color: c.textFaint },
    slotBooked: { fontSize: 12, color: c.textFaint, marginTop: 3 },
    slotBookedWarning: { fontSize: 12, color: c.orange, fontWeight: '700', marginTop: 3 },
    slotSelectArrow: { fontSize: 14, color: c.primary, fontWeight: '700' },
    slotFullText: { fontSize: 13, color: c.error, fontWeight: '600' },

    summaryCard: {
      backgroundColor: c.surface, borderRadius: 16, padding: 20, marginBottom: 24,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    summaryTitle: { fontSize: 16, fontWeight: '700', color: c.primary, marginBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    summaryLabel: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
    summaryValue: { fontSize: 14, fontWeight: '700', color: c.text, textAlign: 'right', flex: 1, marginLeft: 12 },
    summaryValueSub: { fontSize: 13, color: c.textSub, textAlign: 'right', flex: 1, marginLeft: 12 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },

    shareToggleCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1.5, borderColor: c.borderMid,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    shareToggleCardOn: { borderColor: c.primary, backgroundColor: c.primary },
    shareToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    shareToggleIcon: { fontSize: 24 },
    shareToggleText: { flex: 1 },
    shareToggleTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    shareToggleTitleOn: { color: '#fff' },
    shareToggleDesc: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
    shareToggleDescOn: { color: 'rgba(255,255,255,0.8)' },
    togglePill: {
      backgroundColor: c.borderMid, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8,
    },
    togglePillOn: { backgroundColor: '#fff' },
    togglePillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    togglePillTextOn: { color: c.primary },

    noRecordsBox: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 16,
      alignItems: 'center', marginBottom: 12,
    },
    noRecordsText: { fontSize: 14, color: c.textMuted },

    recordHint: { fontSize: 13, color: c.textSub, marginBottom: 10, fontWeight: '500' },

    recordCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid,
      shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
    },
    recordCardOn: { borderColor: c.primary, backgroundColor: c.primary },
    recordCheck: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.borderStrong,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    recordCheckOn: { backgroundColor: c.primary, borderColor: '#fff' },
    recordCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
    recordInfo: { flex: 1 },
    recordDate: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
    recordDateOn: { color: 'rgba(255,255,255,0.8)' },
    recordDesc: { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 2 },
    recordDescOn: { color: '#fff' },
    recordMileage: { fontSize: 12, color: c.textSub },
    recordMileageOn: { color: 'rgba(255,255,255,0.75)' },
    recordCost: { fontSize: 13, fontWeight: '700', color: c.primary, marginLeft: 8 },
    recordCostOn: { color: '#fff' },

    noteTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    noteTypeBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    noteTypeBtnActive: { borderColor: c.primary, backgroundColor: c.primary },
    noteTypeBtnUrgent: { borderColor: c.error, backgroundColor: c.error },
    noteTypeBtnText: { fontSize: 14, fontWeight: '600', color: c.textMuted },
    noteTypeBtnTextActive: { color: '#fff', fontWeight: '700' },

    notesInput: {
      backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: c.text, letterSpacing: 0,
      height: 90, textAlignVertical: 'top', marginBottom: 20,
    },
    notesInputUrgent: { borderColor: c.error, borderWidth: 2 },

    confirmBtnWrap: { marginBottom: 12 },
    confirmNote: { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 18 },

    serviceTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    serviceTypeBtn: {
      flex: 1, backgroundColor: c.surface, borderRadius: 10, padding: 12,
      alignItems: 'center', borderWidth: 1.5, borderColor: c.borderMid,
    },
    serviceTypeBtnActive: { borderColor: c.primary, backgroundColor: c.primary },
    serviceTypeIcon: { fontSize: 20, marginBottom: 4 },
    serviceTypeBtnText: { fontSize: 11, fontWeight: '600', color: c.textMuted, textAlign: 'center' },
    serviceTypeBtnTextActive: { color: '#fff', fontWeight: '700' },
  })
}
