import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  onRecordAdded: () => void
  onBack: () => void
}

const SERVICE_CATEGORIES = [
  {
    title: 'Engine',
    items: ['Oil Change', 'Oil Filter', 'Air Filter', 'Fuel Filter', 'Spark Plugs', 'Timing Belt', 'Timing Belt Kit', 'Coolant Flush', 'Engine Flush'],
  },
  {
    title: 'Brakes',
    items: ['Brake Pads (Front)', 'Brake Pads (Rear)', 'Brake Discs (Front)', 'Brake Discs (Rear)', 'Brake Fluid', 'Brake Drums'],
  },
  {
    title: 'Transmission',
    items: ['Gear Oil', 'Transmission Service', 'Clutch Plate', 'Clutch Kit'],
  },
  {
    title: 'Suspension',
    items: ['Shock Absorbers (Front)', 'Shock Absorbers (Rear)', 'CV Joint', 'CV Boot', 'Wheel Alignment', 'Wheel Balancing', 'Tyre Rotation'],
  },
  {
    title: 'Electrical',
    items: ['Battery', 'Alternator', 'Starter Motor'],
  },
  {
    title: 'AC & Comfort',
    items: ['AC Service', 'AC Filter', 'Cabin Filter', 'Wiper Blades'],
  },
  {
    title: 'General',
    items: ['Full Service', 'Body Work', 'Wash & Polish', 'General Repair', 'Inspection'],
  },
]

const BRANDS = ['Castrol', 'Mobil', 'Shell', 'Total', 'Motul', 'Denso', 'NGK', 'Bosch', 'Toyota OEM', 'Honda OEM', '3M']

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function AddServiceRecordScreen({ token, vehicleId, onRecordAdded, onBack }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [brand, setBrand] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleService = (item: string) => {
    setSelected(prev =>
      prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]
    )
  }

  const parseDate = (str: string): string | null => {
    const parts = str.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts
    const parsed = new Date(`${y}-${m}-${d}`)
    if (isNaN(parsed.getTime())) return null
    return parsed.toISOString()
  }

  const handleSubmit = async () => {
    const allServices = [...selected, ...(otherText.trim() ? [otherText.trim()] : [])]
    if (allServices.length === 0) {
      Alert.alert('Select a service', 'Please select at least one service or type in the Other field.')
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }

    const description = allServices.join(', ')
    const finalBrand = customBrand.trim() || brand

    setLoading(true)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description,
        mileage: mileage ? parseInt(mileage) : undefined,
        brand: finalBrand || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
      })
      onRecordAdded()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Add Service Record</Text>
      <Text style={styles.subtitle}>Tap everything that was done</Text>

      {SERVICE_CATEGORIES.map(cat => (
        <View key={cat.title}>
          <Text style={styles.catLabel}>{cat.title}</Text>
          <View style={styles.chipRow}>
            {cat.items.map(item => {
              const isSelected = selected.includes(item)
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleService(item)}
                  activeOpacity={0.7}
                >
                  {isSelected && <Text style={styles.checkmark}>✓ </Text>}
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ))}

      <Text style={styles.catLabel}>Other (type anything not listed)</Text>
      <TextInput
        style={styles.input}
        value={otherText}
        onChangeText={setOtherText}
        placeholder="e.g. Radiator flush, Turbo service..."
      />

      <Text style={styles.catLabel}>Part Brand</Text>
      <View style={styles.chipRow}>
        {BRANDS.map(b => (
          <TouchableOpacity
            key={b}
            style={[styles.chip, brand === b && styles.chipSelected]}
            onPress={() => { setBrand(b); setCustomBrand('') }}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, brand === b && styles.chipTextSelected]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        value={customBrand}
        onChangeText={text => { setCustomBrand(text); setBrand('') }}
        placeholder="Or type a brand..."
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.catLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.catLabel}>Mileage (km)</Text>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text style={styles.catLabel}>Cost (LKR)</Text>
      <TextInput
        style={styles.input}
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4500"
        keyboardType="number-pad"
      />

      <Text style={styles.catLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        multiline
        numberOfLines={2}
      />

      {selected.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Selected services:</Text>
          <Text style={styles.summaryText}>{selected.join(' · ')}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save Record</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 48 },
  topRow: { marginTop: 48, marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1.5,
    borderColor: '#ddd', backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  checkmark: { fontSize: 13, color: '#fff' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  summary: {
    backgroundColor: '#e8f0fe', borderRadius: 10,
    padding: 14, marginTop: 20,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#1a73e8', marginBottom: 4 },
  summaryText: { fontSize: 13, color: '#333', lineHeight: 20 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
