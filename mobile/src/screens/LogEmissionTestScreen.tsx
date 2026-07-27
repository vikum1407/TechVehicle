import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import DateField from '../components/DateField'
import Button from '../components/Button'

type Props = {
  token: string
  vehicleId: string
  currentMileage: number
  onSaved: () => void
  onBack: () => void
}

function todayDMY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function parseDMY(s: string): string | null {
  const parts = s.trim().split('/')
  if (parts.length !== 3) return null
  const [dStr, mStr, yStr] = parts
  const d = parseInt(dStr, 10), m = parseInt(mStr, 10), y = parseInt(yStr, 10)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  if (yStr.length !== 4) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  if (y < 1990 || y > new Date().getFullYear()) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  if (date > new Date()) return null
  return date.toISOString()
}

function parseMMYYYY(s: string): string | null {
  const parts = s.split('/')
  if (parts.length !== 2) return null
  const [m, y] = parts
  if (!m || !y || y.length !== 4) return null
  const date = new Date(Number(y), Number(m), 0)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

export default function LogEmissionTestScreen({ token, vehicleId, currentMileage, onSaved, onBack }: Props) {
  const [date, setDate] = useState(todayDMY())
  const [mileage, setMileage] = useState(String(currentMileage))
  const [result, setResult] = useState<'Pass' | 'Fail' | ''>('')
  const [co, setCo] = useState('')
  const [hc, setHc] = useState('')
  const [co2, setCo2] = useState('')
  const [lambda, setLambda] = useState('')
  const [station, setStation] = useState('')
  const [cost, setCost] = useState('')
  const [nextExpiry, setNextExpiry] = useState('')
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const s = useMemo(() => makeStyles(colors), [colors])

  const handleSave = async () => {
    if (!result) { Alert.alert('Required', 'Please select Pass or Fail'); return }
    const isoDate = parseDMY(date)
    if (!isoDate) { Alert.alert('Invalid date', 'Use DD/MM/YYYY format'); return }

    let nextExpiryISO: string | undefined
    if (nextExpiry.trim()) {
      const parsed = parseMMYYYY(nextExpiry.trim())
      if (!parsed) { Alert.alert('Invalid expiry date', 'Use MM/YYYY format (e.g. 06/2026)'); return }
      nextExpiryISO = parsed
    }

    const mileageNum = mileage ? parseInt(mileage) : null

    const performSave = async () => {
      setLoading(true)
      try {
        await api.logEmissionTest(token, vehicleId, {
          date: isoDate,
          mileage: mileageNum ?? undefined,
          result,
          co: co || undefined,
          hc: hc || undefined,
          co2: co2 || undefined,
          lambda: lambda || undefined,
          station: station || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          nextExpiryDate: nextExpiryISO,
        })
        if (nextExpiryISO) {
          await api.updateVehicleExpiry(token, vehicleId, { emissionTestExpiry: nextExpiryISO })
        }
        Alert.alert('Saved', 'Emission test recorded.')
        onSaved()
      } catch (e: any) {
        Alert.alert('Error', e.message)
      } finally {
        setLoading(false)
      }
    }

    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        'Check mileage',
        `The mileage entered (${mileageNum.toLocaleString()} km) is higher than the vehicle's current recorded mileage of ${currentMileage.toLocaleString()} km. Is this correct?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, save', onPress: performSave },
        ]
      )
      return
    }

    await performSave()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={s.container}>
    <ScreenHeader title="Log Emission Test" subtitle="Carbon / emission test results and renewal date" onBack={onBack} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      <Text style={s.label}>Test Result <Text style={s.req}>*</Text></Text>
      <View style={s.chipRow}>
        {(['Pass', 'Fail'] as const).map(opt => (
          <TouchableOpacity
            key={opt}
            style={[s.chip, result === opt && (opt === 'Pass' ? s.chipPass : s.chipFail)]}
            onPress={() => setResult(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, result === opt && s.chipTextSel]}>
              {opt === 'Pass' ? '✓ Pass' : '✗ Fail'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.row}>
        <View style={s.half}>
          <DateField label="Test Date" value={date} onChange={setDate} maximumDate={new Date()} />
        </View>
        <View style={s.half}>
          <FormField label="Mileage (km)" value={mileage} onChangeText={setMileage} placeholder="e.g. 45000" keyboardType="number-pad" />
        </View>
      </View>

      <Text style={s.sectionLabel}>Readings (optional — from test certificate)</Text>
      <View style={s.row}>
        <View style={s.half}>
          <FormField label="CO %" value={co} onChangeText={setCo} placeholder="e.g. 0.8" keyboardType="decimal-pad" />
        </View>
        <View style={s.half}>
          <FormField label="HC ppm" value={hc} onChangeText={setHc} placeholder="e.g. 120" keyboardType="number-pad" />
        </View>
      </View>
      <View style={s.row}>
        <View style={s.half}>
          <FormField label="CO₂ %" value={co2} onChangeText={setCo2} placeholder="e.g. 14.2" keyboardType="decimal-pad" />
        </View>
        <View style={s.half}>
          <FormField label="Lambda" value={lambda} onChangeText={setLambda} placeholder="e.g. 1.01" keyboardType="decimal-pad" />
        </View>
      </View>

      <FormField label="Testing Station (optional)" value={station} onChangeText={setStation} placeholder="e.g. Werahera Testing Station" />

      <FormField label="Cost (LKR, optional)" value={cost} onChangeText={setCost} placeholder="e.g. 2500" keyboardType="number-pad" />

      <View style={s.reminderCard}>
        <Text style={s.reminderTitle}>Set Renewal Reminder</Text>
        <Text style={s.reminderSub}>We'll remind you 1 month before expiry, every 3 days until renewed.</Text>
        <FormField
          label="Next Expiry Date (MM/YYYY)"
          value={nextExpiry}
          onChangeText={setNextExpiry}
          placeholder="e.g. 06/2027"
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={s.saveBtnWrap}>
        <Button title="Save Emission Test" onPress={handleSave} loading={loading} />
      </View>
    </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 48 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 6, marginTop: 14 },
    req: { color: c.error },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: c.primary, marginTop: 20, marginBottom: 2 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    chipRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    chip: {
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    chipPass: { backgroundColor: c.success, borderColor: c.success },
    chipFail: { backgroundColor: c.error, borderColor: c.error },
    chipText: { fontSize: 15, color: c.textSub, fontWeight: '600' },
    chipTextSel: { color: '#fff', fontWeight: '700' },
    reminderCard: {
      backgroundColor: c.primaryTint, borderRadius: 14, padding: 16,
      marginTop: 24, borderWidth: 1, borderColor: c.primaryTintText + '44',
    },
    reminderTitle: { fontSize: 15, fontWeight: '700', color: c.primaryTintText, marginBottom: 4 },
    reminderSub: { fontSize: 12, color: c.textSub, marginBottom: 8 },
    saveBtnWrap: { marginTop: 28 },
  })
}
