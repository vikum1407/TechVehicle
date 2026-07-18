import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import Button from '../components/Button'

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
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

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

  const endKmError = endKm && endNum < startNum ? 'End odometer cannot be less than start odometer' : undefined

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title="🛺 Daily Trip Log" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>Log today's run — odometer, fuel & earnings</Text>

      <FormField
        label="Date"
        value={date}
        onChangeText={setDate}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
      />

      <FormField
        label="Start Odometer (km)"
        value={startKm}
        onChangeText={setStartKm}
        keyboardType="number-pad"
        placeholder="e.g. 142000"
      />

      <FormField
        label="End Odometer (km)"
        required
        error={endKmError}
        value={endKm}
        onChangeText={setEndKm}
        keyboardType="number-pad"
        placeholder="e.g. 142180"
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

      <FormField
        label="Litres filled"
        value={litres}
        onChangeText={setLitres}
        keyboardType="decimal-pad"
        placeholder="e.g. 3.5"
      />

      <FormField
        label="Fuel Cost (LKR)"
        value={fuelCost}
        onChangeText={setFuelCost}
        keyboardType="number-pad"
        placeholder="e.g. 840"
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

      <FormField
        label="Today's earnings (LKR)"
        value={earnings}
        onChangeText={setEarnings}
        keyboardType="number-pad"
        placeholder="e.g. 4500"
      />

      {profit !== null && (
        <View style={[styles.profitCard, profit >= 0 ? styles.profitCardGreen : styles.profitCardRed]}>
          <Text style={styles.profitLabel}>After fuel cost</Text>
          <Text style={[styles.profitValue, profit >= 0 ? styles.profitPos : styles.profitNeg]}>
            LKR {profit.toLocaleString()}
          </Text>
        </View>
      )}

      <FormField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="e.g. route, extra runs, repairs..."
        style={styles.notesInput}
      />

      <View style={styles.saveNote}>
        <Text style={styles.saveNoteText}>
          ℹ️ This saves as a fuel log entry — find it later under Full History → Fuel. Earnings and profit shown above are for today's reference only and aren't saved.
        </Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <Button title="Save Trip Log" onPress={handleSave} loading={loading} />
      </View>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 60 },
    subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 24 },
    notesInput: { minHeight: 72, textAlignVertical: 'top' },
    saveNote: {
      backgroundColor: c.primaryTint, borderRadius: 10, padding: 12, marginTop: 20,
    },
    saveNoteText: { fontSize: 12, color: c.primaryTintText, lineHeight: 17 },
    kmCard: {
      backgroundColor: '#fff3e0', borderRadius: 10, marginTop: 10,
      padding: 14, borderLeftWidth: 4, borderLeftColor: '#e65100',
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    kmCardLabel: { fontSize: 13, color: '#bf360c', fontWeight: '600' },
    kmCardValue: { fontSize: 20, fontWeight: '800', color: '#e65100' },
    sectionHeader: {
      marginTop: 28, marginBottom: 4,
      borderBottomWidth: 1, borderBottomColor: c.borderMid, paddingBottom: 8,
    },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
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
    profitLabel: { fontSize: 13, color: c.textSub, fontWeight: '600' },
    profitValue: { fontSize: 18, fontWeight: '800' },
    profitPos: { color: '#2e7d32' },
    profitNeg: { color: '#c62828' },
  })
}
