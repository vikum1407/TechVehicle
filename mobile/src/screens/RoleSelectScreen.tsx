import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  onSelected: (userType: 'owner' | 'garage') => void
}

export default function RoleSelectScreen({ token, onSelected }: Props) {
  const [selected, setSelected] = useState<'owner' | 'garage' | null>(null)
  const [saving, setSaving] = useState(false)

  const handleContinue = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.setUserType(token, selected)
      onSelected(selected)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.appName}>TechVehicle</Text>
        <Text style={styles.title}>How will you use the app?</Text>
        <Text style={styles.subtitle}>
          Choose your primary role. You can always use both features after setup.
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, selected === 'owner' && styles.cardSelected]}
          onPress={() => setSelected('owner')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🚗</Text>
          <Text style={[styles.cardTitle, selected === 'owner' && styles.cardTitleSelected]}>
            Vehicle Owner
          </Text>
          <Text style={[styles.cardDesc, selected === 'owner' && styles.cardDescSelected]}>
            Track your vehicles, log service history, manage expenses and book garage appointments.
          </Text>
          {selected === 'owner' && (
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓ Selected</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, selected === 'garage' && styles.cardSelected]}
          onPress={() => setSelected('garage')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🏭</Text>
          <Text style={[styles.cardTitle, selected === 'garage' && styles.cardTitleSelected]}>
            Garage / Service Center
          </Text>
          <Text style={[styles.cardDesc, selected === 'garage' && styles.cardDescSelected]}>
            Manage your garage, receive bookings, submit service records to customers — and track your own personal vehicles too.
          </Text>
          {selected === 'garage' && (
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓ Selected</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, (!selected || saving) && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!selected || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.continueBtnText}>Continue →</Text>
        }
      </TouchableOpacity>

      <Text style={styles.note}>
        You can access all features after setup. This setting can be changed in your profile.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff',
    paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40,
    justifyContent: 'space-between',
  },
  top: { marginBottom: 8 },
  appName: {
    fontSize: 14, fontWeight: '700', color: '#1a73e8',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 10, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#888', lineHeight: 22 },

  cards: { gap: 16, flex: 1, justifyContent: 'center' },
  card: {
    borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 18,
    padding: 24, backgroundColor: '#fff',
  },
  cardSelected: { borderColor: '#1a73e8', backgroundColor: '#f0f4ff' },
  cardIcon: { fontSize: 36, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  cardTitleSelected: { color: '#1a73e8' },
  cardDesc: { fontSize: 14, color: '#888', lineHeight: 20 },
  cardDescSelected: { color: '#555' },
  checkBadge: {
    marginTop: 14, alignSelf: 'flex-start',
    backgroundColor: '#1a73e8', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  checkText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  continueBtn: {
    backgroundColor: '#1a73e8', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  note: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 16, lineHeight: 18 },
})
