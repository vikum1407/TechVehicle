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
import { useTranslation } from '../i18n/LanguageContext'

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

export default function LogFuelScreen({ token, vehicleId, currentMileage, onLogged, onBack }: Props) {
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState(String(currentMileage))
  const [litres, setLitres] = useState('')
  const [cost, setCost] = useState('')
  const [fullTank, setFullTank] = useState(true)
  const [station, setStation] = useState('')
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const mileageNum = mileage ? parseInt(mileage) : 0
  const isHistorical = mileageNum > 0 && mileageNum < currentMileage
  const kmSinceLast = mileageNum > currentMileage ? mileageNum - currentMileage : null

  const kmPerLitre = kmSinceLast && litres && parseFloat(litres) > 0
    ? (kmSinceLast / parseFloat(litres)).toFixed(1)
    : null

  const handleSubmit = async () => {
    if (!mileage || mileageNum <= 0) {
      Alert.alert(t('logFuel.enterMileage.title'), t('logFuel.enterMileage.message'))
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert(t('logFuel.invalidDate.title'), t('logFuel.invalidDate.message'))
      return
    }

    setLoading(true)
    try {
      await api.addFuelLog(token, vehicleId, {
        date: isoDate,
        mileage: mileageNum,
        litres: litres ? parseFloat(litres) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        fullTank,
        station: station.trim() || undefined,
      })
      onLogged(mileageNum)
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title={t('logFuel.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t('logFuel.lastRecorded', { mileage: currentMileage.toLocaleString() })}</Text>

      <FormField
        label={t('logFuel.odometerReading')}
        required
        value={mileage}
        onChangeText={setMileage}
        keyboardType="number-pad"
        placeholder={t('logFuel.currentOdometerReading')}
      />

      {isHistorical && (
        <View style={styles.historicalNote}>
          <Text style={styles.historicalNoteText}>
            {t('logFuel.historicalNote', { mileage: currentMileage.toLocaleString() })}
          </Text>
        </View>
      )}
      {kmSinceLast != null && (
        <View style={styles.insight}>
          <Text style={styles.insightText}>
            {t('logFuel.kmSinceLastFillup', { km: kmSinceLast.toLocaleString() })}
            {kmPerLitre ? `  ·  ${kmPerLitre} km/L` : ''}
          </Text>
        </View>
      )}

      <FormField
        label={t('logFuel.litresFilled')}
        value={litres}
        onChangeText={setLitres}
        keyboardType="decimal-pad"
        placeholder="e.g. 35.5"
      />

      <FormField
        label={t('logFuel.totalCost')}
        value={cost}
        onChangeText={setCost}
        keyboardType="number-pad"
        placeholder="e.g. 9800"
      />

      <Text style={styles.label}>{t('logFuel.tank')}</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, fullTank && styles.toggleBtnActive]}
          onPress={() => setFullTank(true)}
        >
          <Text style={[styles.toggleText, fullTank && styles.toggleTextActive]}>{t('logFuel.fullTank')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !fullTank && styles.toggleBtnActive]}
          onPress={() => setFullTank(false)}
        >
          <Text style={[styles.toggleText, !fullTank && styles.toggleTextActive]}>{t('logFuel.partial')}</Text>
        </TouchableOpacity>
      </View>

      <DateField label={t('common.date')} value={date} onChange={setDate} maximumDate={new Date()} />

      <FormField
        label={t('logFuel.fuelStation')}
        value={station}
        onChangeText={setStation}
        placeholder="e.g. Ceylon Petroleum, IOC"
      />

      <Button title={t('logFuel.saveFillup')} onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 24 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 20 },
    historicalNote: {
      backgroundColor: '#fff8e1', borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
      borderLeftWidth: 3, borderLeftColor: '#f9a825',
    },
    historicalNoteText: { fontSize: 12, color: '#795548', fontWeight: '600' },
    insight: {
      backgroundColor: '#e8f5e9', borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
    },
    insightText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
    toggleRow: { flexDirection: 'row', gap: 12 },
    toggleBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.borderMid,
      backgroundColor: c.surface, alignItems: 'center',
    },
    toggleBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    toggleText: { fontSize: 14, color: c.textSub, fontWeight: '600' },
    toggleTextActive: { color: '#fff', fontWeight: '700' },
  })
}
