import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  onBack: () => void
}

type Garage = {
  id: string
  name: string
  address: string | null
  brNumber: string | null
  verified: boolean
  createdAt: string
}

export default function GarageScreen({ token, onBack }: Props) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [brNumber, setBrNumber] = useState('')

  useEffect(() => {
    api.getGarage(token)
      .then(data => {
        setGarage(data)
        setName(data.name)
        setAddress(data.address || '')
        setBrNumber(data.brNumber || '')
      })
      .catch(e => {
        if (!e.message.includes('No garage')) {
          Alert.alert('Error', e.message)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your garage name.')
      return
    }
    setSaving(true)
    try {
      const data = await api.registerGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your garage name.')
      return
    }
    setSaving(true)
    try {
      const data = await api.updateGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    )
  }

  const showForm = !garage || editing

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Profile view */}
      {garage && !editing && (
        <>
          <View style={styles.profileCard}>
            <Text style={styles.garageName}>{garage.name}</Text>
            <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
              <Text style={styles.badgeText}>
                {garage.verified ? '✅ Verified Garage' : '⚠️ Unverified'}
              </Text>
            </View>
            {garage.address && (
              <Text style={styles.detail}>📍 {garage.address}</Text>
            )}
            {garage.brNumber && (
              <Text style={styles.detail}>🏢 BR: {garage.brNumber}</Text>
            )}
            {!garage.brNumber && (
              <Text style={styles.detailMuted}>No BR number added — add one to get verified</Text>
            )}
          </View>

          {!garage.verified && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How to get Verified</Text>
              <Text style={styles.infoText}>
                Add your Business Registration (BR) number and our team will verify your garage. Verified garages earn more trust from vehicle owners sharing their service history.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              setName(garage.name)
              setAddress(garage.address || '')
              setBrNumber(garage.brNumber || '')
              setEditing(true)
            }}
          >
            <Text style={styles.editBtnText}>Edit Garage Details</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Registration / Edit form */}
      {showForm && (
        <>
          <Text style={styles.title}>{garage ? 'Edit Garage' : 'Register Your Garage'}</Text>
          <Text style={styles.subtitle}>
            {garage
              ? 'Update your garage details below.'
              : 'Set up your garage profile so vehicle owners can find and share records with you.'}
          </Text>

          <Text style={styles.label}>Garage Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Silva Auto Service"
          />

          <Text style={styles.label}>Address (optional)</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 45/A Kandy Road, Kelaniya"
          />

          <Text style={styles.label}>Business Registration (BR) Number (optional)</Text>
          <TextInput
            style={styles.input}
            value={brNumber}
            onChangeText={setBrNumber}
            placeholder="e.g. PV 00123456"
            autoCapitalize="characters"
          />

          <View style={styles.brNote}>
            <Text style={styles.brNoteText}>
              Adding your BR number earns a ✅ Verified badge, which builds trust with vehicle owners who share their service history with you.
            </Text>
          </View>

          {editing && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={garage ? handleUpdate : handleRegister}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>{garage ? 'Save Changes' : 'Register Garage'}</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topRow: { marginTop: 48, marginBottom: 16 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  garageName: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  badgeVerified: { backgroundColor: '#e6f4ea' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 14, color: '#555', marginBottom: 6 },
  detailMuted: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  infoBox: {
    backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#333', lineHeight: 20 },
  editBtn: {
    borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  brNote: {
    backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginTop: 14,
  },
  brNoteText: { fontSize: 13, color: '#1a73e8', lineHeight: 19 },
  cancelBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  cancelBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
