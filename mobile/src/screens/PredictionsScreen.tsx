import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator,
  TextInput, Alert,
} from 'react-native'
import { api } from '../config/api'

type Prediction = {
  id: string
  name: string
  source: string
  keywords: string[]
  status: 'overdue' | 'due_soon' | 'ok' | 'no_data'
  lastDoneKm: number | null
  lastDoneDate: string | null
  dueAtKm: number | null
  remainingKm: number | null
  dueAtDate: string | null
  remainingDays: number | null
}

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  currentMileage: number
  onBack: () => void
}

const STATUS_CONFIG = {
  overdue:  { color: '#c62828', bg: '#fff5f5', badge: '⚠️ Overdue',   badgeColor: '#c62828', badgeBg: '#fdecea' },
  due_soon: { color: '#e65100', bg: '#fff8f0', badge: '🔔 Due Soon',  badgeColor: '#e65100', badgeBg: '#fff3e0' },
  ok:       { color: '#2e7d32', bg: '#fff',    badge: '✓ OK',          badgeColor: '#2e7d32', badgeBg: '#f1f8e9' },
  no_data:  { color: '#999',    bg: '#fff',    badge: '? No Record',   badgeColor: '#777',    badgeBg: '#f5f5f5' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function kmStr(km: number) {
  return km.toLocaleString() + ' km'
}

type SetupEntry = { date: string; mileage: string }

export default function PredictionsScreen({ token, vehicleId, vehicleName, currentMileage, onBack }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [setupEntries, setSetupEntries] = useState<Record<string, SetupEntry>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getPredictions(token, vehicleId)
      setPredictions(data)
    } catch (e) {
      // silently fail — empty list shown
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const urgent = predictions.filter(p => p.status === 'overdue' || p.status === 'due_soon')
  const ok = predictions.filter(p => p.status === 'ok')
  const noData = predictions.filter(p => p.status === 'no_data')

  const getEntry = (id: string): SetupEntry =>
    setupEntries[id] || { date: '', mileage: '' }

  const setEntry = (id: string, field: keyof SetupEntry, value: string) => {
    setSetupEntries(prev => ({
      ...prev,
      [id]: { ...getEntry(id), [field]: value },
    }))
  }

  const handleSave = async (p: Prediction) => {
    const entry = getEntry(p.id)
    const raw = entry.date.trim()
    if (!raw) {
      Alert.alert('Date required', 'Please enter the month and year, e.g. 06/2023')
      return
    }
    const parts = raw.split('/')
    if (parts.length !== 2) {
      Alert.alert('Invalid format', 'Please use MM/YYYY format, e.g. 06/2023')
      return
    }
    const month = parseInt(parts[0], 10)
    const year = parseInt(parts[1], 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1990 || year > currentYear) {
      Alert.alert('Invalid date', `Month must be 01–12 and year must be 1990–${currentYear}`)
      return
    }

    const isoDate = new Date(year, month - 1, 15).toISOString()
    const mileageNum = entry.mileage.trim() ? parseInt(entry.mileage, 10) : undefined

    setSavingId(p.id)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description: p.keywords[0],
        mileage: mileageNum,
        notes: 'Added via Prediction Setup',
      })
      await load()
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const renderCard = (p: Prediction) => {
    const cfg = STATUS_CONFIG[p.status]

    let distanceLine = ''
    if (p.remainingKm !== null) {
      if (p.remainingKm < 0) {
        distanceLine = `Overdue by ${kmStr(Math.abs(p.remainingKm))}`
      } else {
        distanceLine = `Due in ${kmStr(p.remainingKm)}`
        if (p.dueAtKm) distanceLine += ` (at ${kmStr(p.dueAtKm)})`
      }
    }

    let timeLine = ''
    if (p.remainingDays !== null) {
      if (p.remainingDays < 0) {
        timeLine = `${Math.abs(p.remainingDays)} days overdue`
      } else if (p.remainingDays === 0) {
        timeLine = 'Due today'
      } else {
        timeLine = `${p.remainingDays} days remaining`
        if (p.dueAtDate) timeLine += ` (by ${formatDate(p.dueAtDate)})`
      }
    }

    let lastLine = ''
    if (p.lastDoneDate && p.lastDoneKm) {
      lastLine = `Last done: ${formatDate(p.lastDoneDate)} at ${kmStr(p.lastDoneKm)}`
    } else if (p.lastDoneDate) {
      lastLine = `Last done: ${formatDate(p.lastDoneDate)}`
    }

    return (
      <View key={p.id} style={[styles.card, { borderLeftColor: cfg.color, backgroundColor: cfg.bg }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{p.name}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
            <Text style={[styles.badgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
          </View>
        </View>

        {distanceLine !== '' && (
          <Text style={[styles.distanceLine, { color: cfg.color }]}>{distanceLine}</Text>
        )}
        {timeLine !== '' && (
          <Text style={styles.timeLine}>{timeLine}</Text>
        )}
        {lastLine !== '' && (
          <Text style={styles.lastLine}>{lastLine}</Text>
        )}
        <Text style={styles.source}>{p.source}</Text>
      </View>
    )
  }

  const renderSetupCard = (p: Prediction) => {
    const entry = getEntry(p.id)
    const isSaving = savingId === p.id

    return (
      <View key={p.id} style={styles.setupCard}>
        <View style={styles.setupHeader}>
          <Text style={styles.setupName}>{p.name}</Text>
          <View style={styles.setupBadge}>
            <Text style={styles.setupBadgeText}>? Setup</Text>
          </View>
        </View>
        <Text style={styles.setupQuestion}>When was this last done?</Text>

        <View style={styles.setupFields}>
          <View style={[styles.setupField, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.setupFieldLabel}>Month / Year</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="06/2023"
              placeholderTextColor="#bbb"
              value={entry.date}
              onChangeText={t => setEntry(p.id, 'date', t)}
              keyboardType="numbers-and-punctuation"
              maxLength={7}
            />
          </View>
          <View style={[styles.setupField, { flex: 1 }]}>
            <Text style={styles.setupFieldLabel}>Odometer km (opt.)</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="e.g. 54000"
              placeholderTextColor="#bbb"
              value={entry.mileage}
              onChangeText={t => setEntry(p.id, 'mileage', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.setupSaveBtn, isSaving && { opacity: 0.6 }]}
          onPress={() => handleSave(p)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.setupSaveBtnText}>Save & Start Predicting →</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.setupSource}>{p.source}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Services</Text>
      </View>

      <View style={styles.mileageBanner}>
        <Text style={styles.mileageLabel}>Current mileage</Text>
        <Text style={styles.mileageValue}>{currentMileage.toLocaleString()} km</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#1a73e8" />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={styles.scrollContent}
        >
          {predictions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No predictions yet</Text>
              <Text style={styles.emptyBody}>Add service records to your vehicle history to unlock service predictions.</Text>
            </View>
          )}

          {urgent.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>Needs Attention</Text>
              {urgent.map(renderCard)}
            </View>
          )}

          {ok.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>On Track</Text>
              {ok.map(renderCard)}
            </View>
          )}

          {noData.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>Set Up Predictions</Text>
              <View style={styles.setupBanner}>
                <Text style={styles.setupBannerText}>
                  These items have no history yet. Enter when you last had each one done — even an estimate unlocks predictions immediately.
                </Text>
              </View>
              {noData.map(renderSetupCard)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },

  mileageBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a73e8', paddingHorizontal: 20, paddingVertical: 10,
  },
  mileageLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  mileageValue: { fontSize: 16, color: '#fff', fontWeight: '800' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#888',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8, marginLeft: 2,
  },

  card: {
    borderRadius: 12, borderLeftWidth: 4,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  distanceLine: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  timeLine: { fontSize: 13, color: '#555', marginBottom: 4 },
  lastLine: { fontSize: 12, color: '#777', marginBottom: 4 },
  source: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  // Setup section
  setupBanner: {
    backgroundColor: '#e8f0fe', borderRadius: 10, padding: 12,
    marginBottom: 12,
  },
  setupBannerText: { fontSize: 13, color: '#1a3a6b', lineHeight: 19 },

  setupCard: {
    backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4,
    borderLeftColor: '#9e9e9e', padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  setupName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  setupBadge: { backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  setupBadgeText: { fontSize: 11, fontWeight: '700', color: '#777' },

  setupQuestion: { fontSize: 13, color: '#555', marginBottom: 10 },

  setupFields: { flexDirection: 'row', marginBottom: 12 },
  setupField: {},
  setupFieldLabel: { fontSize: 11, color: '#999', fontWeight: '600', marginBottom: 4 },
  setupInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: '#1a1a1a', backgroundColor: '#fafafa',
  },

  setupSaveBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', marginBottom: 10,
  },
  setupSaveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  setupSource: { fontSize: 11, color: '#bbb', fontStyle: 'italic' },
})
