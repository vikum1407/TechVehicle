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

type SharedRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type IncomingShare = {
  id: string
  createdAt: string
  vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    mileage: number
  }
  records: SharedRecord[]
}

type Tab = 'profile' | 'shared'

export default function GarageScreen({ token, onBack }: Props) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('profile')
  const [shares, setShares] = useState<IncomingShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [expandedShare, setExpandedShare] = useState<string | null>(null)

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
        if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadShares = async () => {
    setSharesLoading(true)
    try {
      const data = await api.getIncomingShares(token)
      setShares(data)
    } catch (e: any) {
      if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
    } finally {
      setSharesLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'shared' && garage) loadShares()
  }, [tab, garage])

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
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
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const parseServices = (desc: string) =>
    desc.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  const showForm = !garage || editing

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{garage ? garage.name : 'Register Garage'}</Text>
      </View>

      {/* Tabs — only show if garage exists */}
      {garage && !editing && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'profile' && styles.tabActive]}
            onPress={() => setTab('profile')}
          >
            <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'shared' && styles.tabActive]}
            onPress={() => setTab('shared')}
          >
            <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared With Me</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile tab */}
      {(tab === 'profile' || !garage) && (
        <ScrollView contentContainerStyle={styles.content}>
          {garage && !editing && (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.garageName}>{garage.name}</Text>
                <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                  <Text style={styles.badgeText}>
                    {garage.verified ? '✅ Verified Garage' : '⚠️ Unverified'}
                  </Text>
                </View>
                {garage.address && <Text style={styles.detail}>📍 {garage.address}</Text>}
                {garage.brNumber
                  ? <Text style={styles.detail}>🏢 BR: {garage.brNumber}</Text>
                  : <Text style={styles.detailMuted}>No BR number added — add one to get verified</Text>
                }
              </View>

              {!garage.verified && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>How to get Verified</Text>
                  <Text style={styles.infoText}>
                    Add your Business Registration (BR) number and our team will verify your garage.
                    Verified garages earn more trust from vehicle owners.
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

          {showForm && (
            <>
              <Text style={styles.formTitle}>{garage ? 'Edit Garage' : 'Register Your Garage'}</Text>
              <Text style={styles.formSubtitle}>
                {garage
                  ? 'Update your garage details below.'
                  : 'Set up your garage profile so vehicle owners can find and share records with you.'}
              </Text>

              <Text style={styles.label}>Garage Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Silva Auto Service" />

              <Text style={styles.label}>Address (optional)</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 45/A Kandy Road, Kelaniya" />

              <Text style={styles.label}>BR Number (optional)</Text>
              <TextInput style={styles.input} value={brNumber} onChangeText={setBrNumber} placeholder="e.g. PV 00123456" autoCapitalize="characters" />

              <View style={styles.brNote}>
                <Text style={styles.brNoteText}>
                  Adding your BR number earns a ✅ Verified badge, building trust with vehicle owners.
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
      )}

      {/* Shared With Me tab */}
      {tab === 'shared' && garage && (
        <ScrollView contentContainerStyle={styles.content}>
          {sharesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : shares.length === 0 ? (
            <View style={styles.emptyShares}>
              <Text style={styles.emptySharesTitle}>No shared records yet</Text>
              <Text style={styles.emptySharesText}>
                When vehicle owners share their service history with your garage, it will appear here.
              </Text>
            </View>
          ) : shares.map(share => {
            const isExpanded = expandedShare === share.id
            return (
              <TouchableOpacity
                key={share.id}
                style={styles.shareCard}
                onPress={() => setExpandedShare(isExpanded ? null : share.id)}
                activeOpacity={0.8}
              >
                <View style={styles.shareCardTop}>
                  <View>
                    <Text style={styles.shareVehicle}>
                      {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
                    </Text>
                    <Text style={styles.shareReg}>{share.vehicle.registrationNo}</Text>
                  </View>
                  <View style={styles.shareRight}>
                    <Text style={styles.shareRecordCount}>{share.records.length} records</Text>
                    <Text style={styles.shareMileage}>{share.vehicle.mileage.toLocaleString()} km</Text>
                  </View>
                </View>
                <Text style={styles.shareDate}>Shared {formatDate(share.createdAt)}</Text>

                {isExpanded && (
                  <View style={styles.shareRecords}>
                    {share.records.map(r => {
                      const services = parseServices(r.description)
                      return (
                        <View key={r.id} style={styles.sharedRecord}>
                          <View style={styles.sharedRecordTop}>
                            <Text style={styles.sharedRecordDate}>{formatDate(r.date)}</Text>
                            {r.cost != null && (
                              <Text style={styles.sharedRecordCost}>LKR {r.cost.toLocaleString()}</Text>
                            )}
                          </View>
                          <View style={styles.tagRow}>
                            {services.slice(0, 3).map((s, i) => (
                              <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{s}</Text>
                              </View>
                            ))}
                            {services.length > 3 && (
                              <View style={styles.tagMore}>
                                <Text style={styles.tagMoreText}>+{services.length - 3}</Text>
                              </View>
                            )}
                          </View>
                          {r.mileage && <Text style={styles.sharedRecordMileage}>{r.mileage.toLocaleString()} km</Text>}
                        </View>
                      )
                    })}
                    <Text style={styles.collapseHint}>Tap to collapse</Text>
                  </View>
                )}

                {!isExpanded && (
                  <Text style={styles.expandHint}>Tap to see shared records</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a73e8' },
  content: { padding: 20, paddingBottom: 48 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  garageName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14 },
  badgeVerified: { backgroundColor: '#e6f4ea' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 14, color: '#555', marginBottom: 6 },
  detailMuted: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  infoBox: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#333', lineHeight: 20 },
  editBtn: {
    borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '700' },
  formTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  formSubtitle: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
  },
  brNote: { backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginTop: 14 },
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
  emptyShares: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptySharesTitle: { fontSize: 17, fontWeight: '700', color: '#555', marginBottom: 10 },
  emptySharesText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  shareCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  shareCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  shareVehicle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  shareReg: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  shareRight: { alignItems: 'flex-end' },
  shareRecordCount: { fontSize: 13, fontWeight: '700', color: '#1a73e8' },
  shareMileage: { fontSize: 12, color: '#888', marginTop: 2 },
  shareDate: { fontSize: 12, color: '#aaa', marginBottom: 6 },
  expandHint: { fontSize: 11, color: '#bbb', marginTop: 4 },
  shareRecords: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  sharedRecord: { marginBottom: 12 },
  sharedRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sharedRecordDate: { fontSize: 12, color: '#888', fontWeight: '600' },
  sharedRecordCost: { fontSize: 12, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: { backgroundColor: '#f0f4ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#333' },
  tagMore: { backgroundColor: '#e8f0fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagMoreText: { fontSize: 12, color: '#1a73e8', fontWeight: '600' },
  sharedRecordMileage: { fontSize: 11, color: '#aaa' },
  collapseHint: { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'center' },
})
