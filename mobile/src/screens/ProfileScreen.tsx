import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  phoneNumber: string
  userType: 'owner' | 'garage'
  onBack: () => void
  onLogout: () => void
}

const PREFS = [
  { key: 'service_due', title: 'Service Due Alerts', desc: 'Notify when a service is due or overdue based on mileage' },
  { key: 'booking',     title: 'Booking Notifications', desc: 'Confirmed, updated, or new messages on a booking' },
  { key: 'transfer',    title: 'Transfer Notifications', desc: 'Vehicle transfer initiated or completed' },
  { key: 'submission',  title: 'Service Submissions', desc: 'Garage submits a completed service record' },
]

export default function ProfileScreen({ token, phoneNumber, userType, onBack, onLogout }: Props) {
  const [stats, setStats] = useState<{ vehicleCount: number; serviceCount: number; fuelCount: number; expenseCount: number } | null>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    service_due: true, booking: true, transfer: true, submission: true,
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api.getAccountStats(token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false))

    api.getNotificationPrefs(token)
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setLoadingPrefs(false))
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

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ])
  }

  const initials = phoneNumber.slice(-4)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Avatar + identity */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.phone}>{phoneNumber}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {userType === 'garage' ? '🔧 Garage / Service Center' : '🚗 Vehicle Owner'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Account Summary</Text>
      {loadingStats ? (
        <ActivityIndicator color="#1a73e8" style={{ marginVertical: 16 }} />
      ) : stats ? (
        <View style={styles.statsGrid}>
          <StatCard value={stats.vehicleCount} label="Vehicles" icon="🚗" />
          <StatCard value={stats.serviceCount} label="Service Records" icon="🔧" />
          <StatCard value={stats.fuelCount}    label="Fuel Logs" icon="⛽" />
          <StatCard value={stats.expenseCount} label="Expenses" icon="💰" />
        </View>
      ) : null}

      {/* Notification prefs */}
      <Text style={styles.sectionTitle}>Notification Preferences</Text>
      {loadingPrefs ? (
        <ActivityIndicator color="#1a73e8" style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.card}>
          {PREFS.map((pref, i) => (
            <View key={pref.key} style={[styles.prefRow, i < PREFS.length - 1 && styles.prefRowBorder]}>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>{pref.title}</Text>
                <Text style={styles.prefDesc}>{pref.desc}</Text>
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
          Push notifications require an EAS build. In Expo Go, notifications show only while the app is open.
        </Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TechVehicle · v1.0.0</Text>
    </ScrollView>
  )
}

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16,
    paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { width: 60 },
  backBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  phone: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  roleBadge: {
    backgroundColor: '#e8f0fe', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  roleBadgeText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 20, marginBottom: 8, paddingHorizontal: 16,
  },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16,
  },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  prefText: { flex: 1 },
  prefTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 3 },
  prefDesc: { fontSize: 12, color: '#888', lineHeight: 17 },
  switchWrapper: { width: 52, alignItems: 'center' },

  noteBox: {
    backgroundColor: '#e8f0fe', borderRadius: 10, margin: 16, marginTop: 12, padding: 14,
  },
  noteText: { fontSize: 12, color: '#1a73e8', lineHeight: 18 },

  logoutBtn: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e53935',
    paddingVertical: 15, alignItems: 'center',
  },
  logoutBtnText: { fontSize: 15, color: '#e53935', fontWeight: '700' },

  version: { textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 20 },
})
