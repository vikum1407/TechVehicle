import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  currentMileage: number
  onLogged: (newMileage: number) => void
  onBack: () => void
}

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

export default function TripLogScreen({ token, vehicleId, currentMileage, onLogged, onBack }: Props) {
  const [date, setDate] = useState(today())
  const [startKm, setStartKm] = useState(String(currentMileage))
  const [endKm, setEndKm] = useState('')
  const [litres, setLitres] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [earnings, setEarnings] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const startNum = parseInt(startKm) || 0
  const endNum = parseInt(endKm) || 0
  const kmDriven = endNum > startNum ? endNum - startNum : null
  const litresNum = parseFloat(litres) || 0
  const fuelCostNum = parseFloat(fuelCost) || 0

  const costPerKm = kmDriven && fuelCostNum > 0 ? (fuelCostNum / kmDriven).toFixed(1) : null
  const kmPerLitre = kmDriven && litresNum > 0 ? (kmDriven / litresNum).toFixed(1) : null
  const earningsNum = parseFloat(earnings) || 0
  const profit = earningsNum > 0 && fuelCostNum > 0 ? earningsNum - fuelCostNum : null

  const handleSave = async () => {
    if (!endKm || endNum <= 0) {
      Alert.alert('Enter end odometer', 'Please enter the odometer reading at end of day.')
      return
    }
    if (endNum < startNum) {
      Alert.alert('Check odometer', 'End odometer cannot be less than start odometer.')
      return
    }
    if (endNum < currentMileage) {
      Alert.alert('Check odometer', `Odometer reading cannot be less than current mileage (${currentMileage.toLocaleString()} km).`)
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter date as DD/MM/YYYY.')
      return
    }

    setLoading(true)
    try {
      await api.addFuelLog(token, vehicleId, {
        date: isoDate,
        mileage: endNum,
        litres: litresNum > 0 ? litresNum : undefined,
        cost: fuelCostNum > 0 ? fuelCostNum : undefined,
        fullTank: false,
        station: notes.trim() || undefined,
      })
      onLogged(endNum)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>🛺 Daily Trip Log</Text>
      <Text style={styles.subtitle}>Log today's run — odometer, fuel & earnings</Text>

      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
        placeholderTextColor="#bbb"
      />

      <Text style={styles.label}>Start Odometer (km)</Text>
      <TextInput
        style={styles.input}
        value={startKm}
        onChangeText={setStartKm}
        keyboardType="number-pad"
        placeholder="e.g. 142000"
        placeholderTextColor="#bbb"
      />

      <Text style={styles.label}>End Odometer (km) *</Text>
      <TextInput
        style={styles.input}
        value={endKm}
        onChangeText={setEndKm}
        keyboardType="number-pad"
        placeholder="e.g. 142180"
        placeholderTextColor="#bbb"
      />

      {kmDriven !== null && (
        <View style={styles.kmCard}>
          <Text style={styles.kmCardLabel}>KM driven today</Text>
          <Text style={styles.kmCardValue}>{kmDriven.toLocaleString()} km</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fuel (optional)</Text>
      </View>

      <Text style={styles.label}>Litres filled</Text>
      <TextInput
        style={styles.input}
        value={litres}
        onChangeText={setLitres}
        keyboardType="decimal-pad"
        placeholder="e.g. 3.5"
        placeholderTextColor="#bbb"
      />

      <Text style={styles.label}>Fuel Cost (LKR)</Text>
      <TextInput
        style={styles.input}
        value={fuelCost}
        onChangeText={setFuelCost}
        keyboardType="number-pad"
        placeholder="e.g. 840"
        placeholderTextColor="#bbb"
      />

      {(costPerKm || kmPerLitre) && (
        <View style={styles.statsRow}>
          {kmPerLitre && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{kmPerLitre}</Text>
              <Text style={styles.statLabel}>km/L</Text>
            </View>
          )}
          {costPerKm && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>LKR {costPerKm}</Text>
              <Text style={styles.statLabel}>fuel/km</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Earnings (optional)</Text>
      </View>

      <Text style={styles.label}>Today's earnings (LKR)</Text>
      <TextInput
        style={styles.input}
        value={earnings}
        onChangeText={setEarnings}
        keyboardType="number-pad"
        placeholder="e.g. 4500"
        placeholderTextColor="#bbb"
      />

      {profit !== null && (
        <View style={[styles.profitCard, profit >= 0 ? styles.profitCardGreen : styles.profitCardRed]}>
          <Text style={styles.profitLabel}>After fuel cost</Text>
          <Text style={[styles.profitValue, profit >= 0 ? styles.profitPos : styles.profitNeg]}>
            LKR {profit.toLocaleString()}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="e.g. route, extra runs, repairs..."
        placeholderTextColor="#bbb"
      />

      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save Trip Log</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 60 },
  topRow: { marginTop: 48, marginBottom: 8 },
  backText: { fontSize: 15, color: '#e65100', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  kmCard: {
    backgroundColor: '#fff3e0', borderRadius: 10, marginTop: 10,
    padding: 14, borderLeftWidth: 4, borderLeftColor: '#e65100',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  kmCardLabel: { fontSize: 13, color: '#bf360c', fontWeight: '600' },
  kmCardValue: { fontSize: 20, fontWeight: '800', color: '#e65100' },
  sectionHeader: {
    marginTop: 28, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: {
    flex: 1, backgroundColor: '#e8f5e9', borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: '#2e7d32',
  },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1b5e20' },
  statLabel: { fontSize: 11, color: '#388e3c', fontWeight: '600', marginTop: 2 },
  profitCard: {
    borderRadius: 10, marginTop: 10, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  profitCardGreen: { backgroundColor: '#e8f5e9', borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  profitCardRed: { backgroundColor: '#ffebee', borderLeftWidth: 4, borderLeftColor: '#c62828' },
  profitLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  profitValue: { fontSize: 18, fontWeight: '800' },
  profitPos: { color: '#2e7d32' },
  profitNeg: { color: '#c62828' },
  saveBtn: {
    backgroundColor: '#e65100', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
