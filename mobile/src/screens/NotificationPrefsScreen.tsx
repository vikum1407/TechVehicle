import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  onBack: () => void
}

const PREFS = [
  {
    key: 'service_due',
    title: 'Service Due Alerts',
    description: 'Notify when a service is due or overdue based on your mileage',
  },
  {
    key: 'mileage_reminder',
    title: 'Mileage Update Nudges',
    description: 'Weekly reminder to log a fuel fill-up when no mileage has been recorded',
  },
  {
    key: 'renewal',
    title: 'Renewal Reminders',
    description: 'Alerts when Revenue Licence or Emission Test expiry is approaching',
  },
  {
    key: 'booking',
    title: 'Booking Notifications',
    description: 'Notify when a booking is confirmed, updated, or you receive a message',
  },
  {
    key: 'transfer',
    title: 'Transfer Notifications',
    description: 'Notify when a vehicle transfer is initiated or completed',
  },
  {
    key: 'submission',
    title: 'Service Submission Alerts',
    description: 'Notify when a garage submits a completed service record',
  },
]

export default function NotificationPrefsScreen({ token, onBack }: Props) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    service_due: true,
    mileage_reminder: true,
    renewal: true,
    booking: true,
    transfer: true,
    submission: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api.getNotificationPrefs(token)
      .then(setPrefs)
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: string, value: boolean) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSaving(key)
    try {
      await api.saveNotificationPrefs(token, updated)
    } catch (e: any) {
      setPrefs(prefs)
      Alert.alert('Error', e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Notification Settings</Text>
      <Text style={styles.subtitle}>Choose which notifications you want to receive</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
      ) : (
        <View style={styles.card}>
          {PREFS.map((pref, index) => (
            <View
              key={pref.key}
              style={[styles.row, index < PREFS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{pref.title}</Text>
                <Text style={styles.rowDesc}>{pref.description}</Text>
              </View>
              <View style={styles.switchWrapper}>
                {saving === pref.key ? (
                  <ActivityIndicator size="small" color="#1a73e8" />
                ) : (
                  <Switch
                    value={prefs[pref.key] ?? true}
                    onValueChange={(v) => handleToggle(pref.key, v)}
                    trackColor={{ false: '#e0e0e0', true: '#90caf9' }}
                    thumbColor={prefs[pref.key] ? '#1a73e8' : '#f5f5f5'}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Push notifications require the app to be installed via an EAS build.
          In Expo Go, notifications appear only while the app is open.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { marginTop: 8, marginBottom: 4, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginTop: 16, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 28 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 18, gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 3 },
  rowDesc: { fontSize: 12, color: '#888', lineHeight: 17 },
  switchWrapper: { width: 52, alignItems: 'center' },
  noteBox: {
    backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginTop: 24,
  },
  noteText: { fontSize: 12, color: '#1a73e8', lineHeight: 18 },
})
