import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native'
import { api } from '../config/api'

type Prediction = {
  id: string
  name: string
  source: string
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

export default function PredictionsScreen({ token, vehicleId, vehicleName, currentMileage, onBack }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

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
    } else if (p.status === 'no_data') {
      lastLine = 'No record found — add your service history to unlock this prediction'
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
              <Text style={styles.sectionLabel}>No History Found</Text>
              <Text style={styles.sectionNote}>
                Add past service records to enable predictions for these items.
              </Text>
              {noData.map(renderCard)}
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
  sectionNote: {
    fontSize: 13, color: '#999', marginBottom: 8, marginLeft: 2,
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
})
