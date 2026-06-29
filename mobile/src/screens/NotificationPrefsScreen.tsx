import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

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
    key: 'insurance_reminder',
    title: 'Insurance Reminders',
    description: 'Alerts when vehicle insurance expiry is approaching',
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
    insurance_reminder: true,
    booking: true,
    transfer: true,
    submission: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

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
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
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
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={prefs[pref.key] ?? true}
                    onValueChange={(v) => handleToggle(pref.key, v)}
                    trackColor={{ false: colors.borderMid, true: '#90caf9' }}
                    thumbColor={prefs[pref.key] ? colors.primary : colors.surfaceAlt}
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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    backBtn: { marginTop: 8, marginBottom: 4, alignSelf: 'flex-start' },
    backBtnText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    title: { fontSize: 26, fontWeight: '700', color: c.text, marginTop: 16, marginBottom: 4 },
    subtitle: { fontSize: 13, color: c.textMuted, marginBottom: 28 },
    card: {
      backgroundColor: c.surface, borderRadius: 14,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 18, gap: 12,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 3 },
    rowDesc: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
    switchWrapper: { width: 52, alignItems: 'center' },
    noteBox: {
      backgroundColor: c.primaryTint, borderRadius: 10, padding: 14, marginTop: 24,
    },
    noteText: { fontSize: 12, color: c.primaryTintText, lineHeight: 18 },
  })
}
