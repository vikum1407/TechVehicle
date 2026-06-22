import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'

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
  remaining: number
  available: boolean
}

export default function BookingScreen({ token, vehicle, onBack, onBooked }: Props) {
  const [step, setStep] = useState<'search' | 'dates' | 'confirm'>('search')

  // Step 1 — search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GarageResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedGarage, setSelectedGarage] = useState<GarageResult | null>(null)

  // Step 2 — dates
  const [dates, setDates] = useState<DateSlot[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<DateSlot | null>(null)

  // Step 3 — confirm
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)

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
      const data = await api.getAvailabilityDates(token, garage.id)
      setDates(data.dates)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setDatesLoading(false)
    }
  }

  const handleSelectDate = (slot: DateSlot) => {
    if (!slot.available) return
    setSelectedDate(slot)
    setStep('confirm')
  }

  const handleConfirmBooking = async () => {
    if (!selectedGarage || !selectedDate) return
    setBooking(true)
    try {
      await api.createBooking(token, {
        vehicleId: vehicle.id,
        garageId: selectedGarage.id,
        date: selectedDate.date,
        notes: notes.trim() || undefined,
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Service</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Vehicle banner */}
          <View style={styles.vehicleBanner}>
            <Text style={styles.vehicleBannerReg}>{vehicle.registrationNo}</Text>
            <Text style={styles.vehicleBannerName}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
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
              style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
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
    )
  }

  // ── Step 2: Pick a date ────────────────────────────────────────────────────
  if (step === 'dates') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setStep('search'); setSelectedDate(null) }} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pick a Date</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.selectedGarageBanner}>
            <Text style={styles.selectedGarageName}>{selectedGarage?.name}</Text>
            {selectedGarage?.verified && <Text style={styles.verifiedLabel}>✅ Verified</Text>}
          </View>

          <Text style={styles.sectionLabel}>Available in the next 14 days</Text>

          {datesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : (
            <View style={styles.dateGrid}>
              {dates.map(slot => (
                <TouchableOpacity
                  key={slot.date}
                  style={[
                    styles.dateCell,
                    slot.available && styles.dateCellAvailable,
                    !slot.isWorkDay && styles.dateCellOff,
                    slot.isWorkDay && !slot.available && styles.dateCellFull,
                  ]}
                  onPress={() => handleSelectDate(slot)}
                  disabled={!slot.available}
                  activeOpacity={slot.available ? 0.7 : 1}
                >
                  <Text style={[styles.dateDayName, !slot.isWorkDay && styles.dateDayNameOff]}>
                    {slot.dayName}
                  </Text>
                  <Text style={[styles.dateDayNum, slot.available && styles.dateDayNumAvailable]}>
                    {slot.dayNum}
                  </Text>
                  <Text style={[styles.dateMonth, !slot.isWorkDay && styles.dateMonthOff]}>
                    {slot.month}
                  </Text>
                  {slot.isWorkDay && (
                    <Text style={[
                      styles.dateSlots,
                      slot.available ? styles.dateSlotsAvail : styles.dateSlotsFull,
                    ]}>
                      {slot.available ? `${slot.remaining} left` : 'Full'}
                    </Text>
                  )}
                  {!slot.isWorkDay && (
                    <Text style={styles.dateClosed}>Closed</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  // ── Step 3: Confirm ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setStep('dates'); setSelectedDate(null) }} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vehicle</Text>
            <Text style={styles.summaryValue}>{vehicle.registrationNo}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}></Text>
            <Text style={styles.summaryValueSub}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Garage</Text>
            <Text style={styles.summaryValue}>{selectedGarage?.name}</Text>
          </View>
          {selectedGarage?.address && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}></Text>
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
        </View>

        <Text style={styles.sectionLabel}>Notes for Garage (optional)</Text>
        <TextInput
          style={[styles.searchInput, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Oil change + tyre check, please call before starting work"
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.confirmBtn, booking && styles.confirmBtnDisabled]}
          onPress={handleConfirmBooking}
          disabled={booking}
        >
          {booking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>Confirm Booking</Text>
          }
        </TouchableOpacity>

        <Text style={styles.confirmNote}>
          Your request will be sent to the garage. They'll confirm or suggest an alternative.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  content: { padding: 16, paddingBottom: 40 },

  vehicleBanner: {
    backgroundColor: '#1a73e8', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  vehicleBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  vehicleBannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  vehicleBannerMileage: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#555',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#ddd',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1a1a1a',
  },
  searchBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },

  garageCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    elevation: 2,
  },
  garageCardLeft: { flex: 1 },
  garageCardRight: { alignItems: 'flex-end', gap: 6 },
  garageName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  garageAddress: { fontSize: 13, color: '#888' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeVerified: { backgroundColor: '#e8f5e9' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  selectText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },

  selectedGarageBanner: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  selectedGarageName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  verifiedLabel: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },

  dateGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  dateCell: {
    width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0',
  },
  dateCellAvailable: { borderColor: '#1a73e8', backgroundColor: '#f0f4ff' },
  dateCellOff: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0' },
  dateCellFull: { backgroundColor: '#fff5f5', borderColor: '#ffcdd2' },

  dateDayName: { fontSize: 11, fontWeight: '600', color: '#888', marginBottom: 4 },
  dateDayNameOff: { color: '#bbb' },
  dateDayNum: { fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 2 },
  dateDayNumAvailable: { color: '#1a73e8' },
  dateMonth: { fontSize: 11, color: '#888', marginBottom: 4 },
  dateMonthOff: { color: '#bbb' },
  dateSlots: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  dateSlotsAvail: { color: '#34a853' },
  dateSlotsFull: { color: '#e53935' },
  dateClosed: { fontSize: 10, color: '#bbb', fontWeight: '600', marginTop: 2 },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1a73e8', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textAlign: 'right', flex: 1, marginLeft: 12 },
  summaryValueSub: { fontSize: 13, color: '#666', textAlign: 'right', flex: 1, marginLeft: 12 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },

  notesInput: { flex: 0, height: 90, textAlignVertical: 'top', marginBottom: 20 },

  confirmBtn: {
    backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  confirmNote: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },
})
