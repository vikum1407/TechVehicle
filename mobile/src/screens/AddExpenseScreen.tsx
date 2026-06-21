import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  onExpenseAdded: () => void
  onBack: () => void
}

const CATEGORIES = [
  { label: 'Insurance', icon: '🛡️' },
  { label: 'Revenue Licence', icon: '📋' },
  { label: 'Emission Test', icon: '💨' },
  { label: 'Fine / Penalty', icon: '🚨' },
  { label: 'Parking', icon: '🅿️' },
  { label: 'Toll', icon: '🛣️' },
  { label: 'Accessories', icon: '🔩' },
  { label: 'Washing', icon: '🚿' },
  { label: 'Other', icon: '📝' },
]

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const parseDate = (str: string): string | null => {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const parsed = new Date(`${y}-${m}-${d}`)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function AddExpenseScreen({ token, vehicleId, onExpenseAdded, onBack }: Props) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Select category', 'Please select an expense category.')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter amount', 'Please enter the expense amount.')
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter date as DD/MM/YYYY.')
      return
    }

    setLoading(true)
    try {
      await api.addExpense(token, vehicleId, {
        date: isoDate,
        category,
        amount: parseFloat(amount),
        description: description.trim() || undefined,
        mileage: mileage ? parseInt(mileage) : undefined,
        notes: notes.trim() || undefined,
      })
      onExpenseAdded()
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

      <Text style={styles.title}>Add Expense</Text>
      <Text style={styles.subtitle}>Track all vehicle-related costs</Text>

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.categoryCard, category === cat.label && styles.categoryCardSelected]}
            onPress={() => setCategory(cat.label)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, category === cat.label && styles.categoryLabelSelected]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Amount (LKR) *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="e.g. 45000"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Annual insurance renewal — Union Assurance"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Mileage (km)</Text>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            keyboardType="number-pad"
            placeholder="optional"
          />
        </View>
      </View>

      <Text style={styles.label}>Notes (optional)</Text>
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
          : <Text style={styles.buttonText}>Save Expense</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  topRow: { marginTop: 48, marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 10, marginTop: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e0e0e0',
  },
  categoryCardSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  categoryIcon: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 11, color: '#555', fontWeight: '600', textAlign: 'center' },
  categoryLabelSelected: { color: '#fff' },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
