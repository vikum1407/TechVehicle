import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  onVehicleAdded: () => void
  onBack: () => void
}

const MAKES = ['Toyota', 'Honda', 'Nissan', 'Suzuki', 'Mitsubishi', 'Perodua', 'Bajaj', 'TVS', 'Hero', 'Other']
const FUEL_TYPES = ['Petrol 92', 'Petrol 95', 'Diesel', 'Electric']
const CURRENT_YEAR = new Date().getFullYear()

export default function AddVehicleScreen({ token, onVehicleAdded, onBack }: Props) {
  const [registrationNo, setRegistrationNo] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [mileage, setMileage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!registrationNo || !make || !model || !year || !fuelType || !mileage) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    const yearNum = parseInt(year)
    if (yearNum < 1980 || yearNum > CURRENT_YEAR) {
      Alert.alert('Invalid year', `Year must be between 1980 and ${CURRENT_YEAR}.`)
      return
    }

    setLoading(true)
    try {
      await api.addVehicle(token, {
        registrationNo,
        make,
        model,
        year: yearNum,
        fuelType,
        mileage: parseInt(mileage),
      })
      onVehicleAdded()
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
      <Text style={styles.subtitle}>Enter your vehicle details</Text>

      <Text style={styles.label}>Registration Number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. WP CAB-1234"
        value={registrationNo}
        onChangeText={setRegistrationNo}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Make</Text>
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

      <Text style={styles.label}>Model</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Corolla, Vezel, Alto"
        value={model}
        onChangeText={setModel}
      />

      <Text style={styles.label}>Year</Text>
      <TextInput
        style={styles.input}
        placeholder={`e.g. ${CURRENT_YEAR - 5}`}
        keyboardType="number-pad"
        maxLength={4}
        value={year}
        onChangeText={setYear}
      />

      <Text style={styles.label}>Fuel Type</Text>
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

      <Text style={styles.label}>Current Mileage (km)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 45000"
        keyboardType="number-pad"
        value={mileage}
        onChangeText={setMileage}
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
  subtitle: { fontSize: 14, color: '#888', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
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
