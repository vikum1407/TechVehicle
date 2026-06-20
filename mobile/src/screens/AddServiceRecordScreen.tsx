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

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function AddServiceRecordScreen({ token, vehicleId, onRecordAdded, onBack }: Props) {
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [mileage, setMileage] = useState('')
  const [parts, setParts] = useState('')
  const [brand, setBrand] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const parseDate = (str: string): string | null => {
    const parts = str.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts
    const parsed = new Date(`${y}-${m}-${d}`)
    if (isNaN(parsed.getTime())) return null
    return parsed.toISOString()
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe what was done.')
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }

    setLoading(true)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description: description.trim(),
        mileage: mileage ? parseInt(mileage) : undefined,
        parts: parts.trim() || undefined,
        brand: brand.trim() || undefined,
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
      <Text style={styles.subtitle}>Log what was done to your vehicle</Text>

      <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>What was done <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Engine oil change, Brake pad replacement"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Mileage at service (km) <Text style={styles.optional}>optional</Text></Text>
      <TextInput
        style={styles.input}
        value={mileage}
        onChangeText={setMileage}
        placeholder="e.g. 45000"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Parts replaced <Text style={styles.optional}>optional</Text></Text>
      <TextInput
        style={styles.input}
        value={parts}
        onChangeText={setParts}
        placeholder="e.g. Engine oil, Oil filter"
      />

      <Text style={styles.label}>Part brand <Text style={styles.optional}>optional</Text></Text>
      <TextInput
        style={styles.input}
        value={brand}
        onChangeText={setBrand}
        placeholder="e.g. Castrol, Denso, NGK"
      />

      <Text style={styles.label}>Cost (LKR) <Text style={styles.optional}>optional</Text></Text>
      <TextInput
        style={styles.input}
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4500"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Notes <Text style={styles.optional}>optional</Text></Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        multiline
        numberOfLines={2}
      />

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
  content: { padding: 24, paddingBottom: 48 },
  topRow: { marginTop: 16, marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, marginTop: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  required: { color: '#e53935' },
  optional: { color: '#aaa', fontWeight: '400' },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
