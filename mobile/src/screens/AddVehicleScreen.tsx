import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'
import { VEHICLE_TYPE_OPTIONS } from '../constants/serviceData'

type Props = {
  token: string
  onVehicleAdded: (vehicle: { id: string; registrationNo: string; make: string; model: string; year: number; fuelType: string; vehicleType: string | null; mileage: number }) => void
  onBack: () => void
}

const MAKES = ['Toyota', 'Honda', 'Nissan', 'Suzuki', 'Mitsubishi', 'Perodua', 'Bajaj', 'TVS', 'Hero', 'Other']
const FUEL_TYPES = ['Petrol 92', 'Petrol 95', 'Diesel', 'Electric']
const OWNER_COUNT_OPTIONS = [
  { label: '1st Owner', value: 1 },
  { label: '2nd Owner', value: 2 },
  { label: '3rd+ Owner', value: 3 },
]
const CURRENT_YEAR = new Date().getFullYear()

const parseDate = (str: string): string | null => {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const parsed = new Date(`${y}-${m}-${d}`)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function AddVehicleScreen({ token, onVehicleAdded, onBack }: Props) {
  const [registrationNo, setRegistrationNo] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [mileage, setMileage] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [ownerCount, setOwnerCount] = useState<number | null>(null)
  const [vehicleNotes, setVehicleNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!registrationNo || !make || !model || !year || !fuelType || !vehicleType || !mileage) {
      Alert.alert('Missing fields', 'Please fill in all required fields including Vehicle Type.')
      return
    }
    const yearNum = parseInt(year)
    if (yearNum < 1960 || yearNum > CURRENT_YEAR) {
      Alert.alert('Invalid year', `Year must be between 1960 and ${CURRENT_YEAR}.`)
      return
    }
    let parsedPurchaseDate: string | undefined
    if (purchaseDate.trim()) {
      const iso = parseDate(purchaseDate.trim())
      if (!iso) { Alert.alert('Invalid date', 'Purchase date must be DD/MM/YYYY.'); return }
      parsedPurchaseDate = iso
    }

    setLoading(true)
    try {
      const newVehicle = await api.addVehicle(token, {
        registrationNo,
        make,
        model,
        year: yearNum,
        fuelType,
        vehicleType: vehicleType || undefined,
        mileage: parseInt(mileage),
        purchaseDate: parsedPurchaseDate,
        ownerCount: ownerCount ?? undefined,
        vehicleNotes: vehicleNotes.trim() || undefined,
      })
      // Always pass vehicleType from local state — API response may omit it if DB hasn't been pushed yet
      onVehicleAdded({ ...newVehicle, vehicleType: vehicleType || null })
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Add Vehicle</Text>
      <Text style={styles.subtitle}>Fields marked * are required</Text>

      <Text style={styles.label}>Registration Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. WP CAB-1234"
        value={registrationNo}
        onChangeText={setRegistrationNo}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Make *</Text>
      <View style={styles.optionRow}>
        {MAKES.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, make === m && styles.chipSelected]}
            onPress={() => setMake(m)}
          >
            <Text style={[styles.chipText, make === m && styles.chipTextSelected]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Model *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Corolla, Vezel, Alto"
        value={model}
        onChangeText={setModel}
      />

      <Text style={styles.label}>Year *</Text>
      <TextInput
        style={styles.input}
        placeholder={`e.g. ${CURRENT_YEAR - 5}`}
        keyboardType="number-pad"
        maxLength={4}
        value={year}
        onChangeText={setYear}
      />

      <Text style={styles.label}>Fuel Type *</Text>
      <View style={styles.optionRow}>
        {FUEL_TYPES.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, fuelType === f && styles.chipSelected]}
            onPress={() => setFuelType(f)}
          >
            <Text style={[styles.chipText, fuelType === f && styles.chipTextSelected]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Vehicle Type *</Text>
      <View style={styles.optionRow}>
        {VEHICLE_TYPE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, vehicleType === opt.value && styles.chipSelected]}
            onPress={() => setVehicleType(opt.value)}
          >
            <Text style={[styles.chipText, vehicleType === opt.value && styles.chipTextSelected]}>
              {opt.icon} {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Current Mileage (km) *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 45000"
        keyboardType="number-pad"
        value={mileage}
        onChangeText={setMileage}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Optional Details</Text>

      <Text style={styles.label}>Purchase Date</Text>
      <TextInput
        style={styles.input}
        placeholder="DD/MM/YYYY"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Owner History</Text>
      <View style={styles.optionRow}>
        {OWNER_COUNT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, ownerCount === o.value && styles.chipSelected]}
            onPress={() => setOwnerCount(o.value)}
          >
            <Text style={[styles.chipText, ownerCount === o.value && styles.chipTextSelected]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes about this vehicle</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any notes about condition, modifications, known issues..."
        value={vehicleNotes}
        onChangeText={setVehicleNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save Vehicle</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { marginTop: 8, marginBottom: 4, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, marginTop: 16 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  divider: { height: 1, backgroundColor: '#e8e8e8', marginTop: 28, marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#e0e0e0', backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
