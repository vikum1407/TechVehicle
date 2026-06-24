import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, FlatList
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  onBack: () => void
  onShared: () => void
}

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type GarageResult = {
  id: string
  name: string
  address: string | null
  verified: boolean
}

type Step = 'selectServiceType' | 'selectRecords' | 'selectGarage' | 'confirm'

const SERVICE_TYPE_OPTIONS = [
  { key: 'full', label: 'Full Service', icon: '🔧', desc: 'Complete maintenance visit' },
  { key: 'between', label: 'Between Service', icon: '⚡', desc: 'Repair or check-up between scheduled services' },
  { key: 'third_party', label: 'Third-Party Service', icon: '🏭', desc: 'Work done by an external/third-party provider' },
]

export default function ShareScreen({ token, vehicleId, onBack, onShared }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('selectServiceType')
  const [serviceType, setServiceType] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [garageResults, setGarageResults] = useState<GarageResult[]>([])
  const [selectedGarage, setSelectedGarage] = useState<GarageResult | null>(null)

  useEffect(() => {
    api.getServiceRecords(token, vehicleId)
      .then(setRecords)
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggleRecord = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSearch = async (text: string) => {
    setSearchText(text)
    if (text.length < 2) { setGarageResults([]); return }
    setSearching(true)
    try {
      const results = await api.searchGarages(token, text)
      setGarageResults(results)
    } catch {
      setGarageResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleShare = async () => {
    if (!selectedGarage) return
    setSending(true)
    try {
      await api.createShare(token, {
        vehicleId,
        garageId: selectedGarage.id,
        recordIds: Array.from(selectedIds),
        serviceType: serviceType || undefined,
      })
      Alert.alert(
        'Shared',
        `${selectedIds.size} record${selectedIds.size > 1 ? 's' : ''} shared with ${selectedGarage.name}.`,
        [{ text: 'OK', onPress: onShared }]
      )
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const parseServices = (description: string) => {
    return description.split(',').map(s => s.trim()).filter(Boolean)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (step === 'selectServiceType') onBack()
          else if (step === 'selectRecords') setStep('selectServiceType')
          else if (step === 'selectGarage') setStep('selectRecords')
          else if (step === 'confirm') setStep('selectGarage')
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Records</Text>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step !== 'selectServiceType' && styles.stepDotDone]} />
          <View style={[styles.stepLine, ['selectGarage', 'confirm'].includes(step) && styles.stepLineDone]} />
          <View style={[styles.stepDot, ['selectGarage', 'confirm'].includes(step) && styles.stepDotDone]} />
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineDone]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotDone]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>
      </View>

      {/* Step 0: Select service type */}
      {step === 'selectServiceType' && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>Type of Visit</Text>
          <Text style={styles.stepSub}>What kind of service is this visit for?</Text>
          {SERVICE_TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.serviceTypeCard, serviceType === opt.key && styles.serviceTypeCardSelected]}
              onPress={() => setServiceType(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceTypeIcon}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceTypeLabel, serviceType === opt.key && styles.serviceTypeLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.serviceTypeDesc}>{opt.desc}</Text>
              </View>
              {serviceType === opt.key && <Text style={styles.serviceTypeCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.nextBtn, !serviceType && styles.nextBtnDisabled]}
            onPress={() => serviceType && setStep('selectRecords')}
            disabled={!serviceType}
          >
            <Text style={styles.nextBtnText}>Next — Select Records</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1: Select records */}
      {step === 'selectRecords' && (
        <>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Select Records to Share</Text>
            <Text style={styles.stepSub}>Choose which service records the garage can see</Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>No service records yet.</Text>
            ) : records.map(record => {
              const services = parseServices(record.description)
              const isSelected = selectedIds.has(record.id)
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.recordCard, isSelected && styles.recordCardSelected]}
                  onPress={() => toggleRecord(record.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.recordTop}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                    {record.cost != null && (
                      <Text style={styles.recordCost}>LKR {record.cost.toLocaleString()}</Text>
                    )}
                  </View>
                  <View style={styles.tagRow}>
                    {services.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText} numberOfLines={1}>{s}</Text>
                      </View>
                    ))}
                    {services.length > 3 && (
                      <View style={styles.tagMore}>
                        <Text style={styles.tagMoreText}>+{services.length - 3}</Text>
                      </View>
                    )}
                  </View>
                  {record.mileage && (
                    <Text style={styles.recordMileage}>{record.mileage.toLocaleString()} km</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, selectedIds.size === 0 && styles.nextBtnDisabled]}
              onPress={() => setStep('selectGarage')}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.nextBtnText}>
                Next — {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''} Selected
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Step 2: Select garage */}
      {step === 'selectGarage' && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>Find a Garage</Text>
          <Text style={styles.stepSub}>Search by garage name</Text>

          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={handleSearch}
            placeholder="Type garage name..."
            autoFocus
          />

          {searching && <ActivityIndicator style={{ marginTop: 16 }} color="#1a73e8" />}

          {garageResults.map(g => (
            <TouchableOpacity
              key={g.id}
              style={[styles.garageCard, selectedGarage?.id === g.id && styles.garageCardSelected]}
              onPress={() => setSelectedGarage(g)}
            >
              <View style={styles.garageRow}>
                <Text style={styles.garageName}>{g.name}</Text>
                {g.verified && <Text style={styles.verifiedBadge}>✅</Text>}
              </View>
              {g.address && <Text style={styles.garageAddress}>{g.address}</Text>}
            </TouchableOpacity>
          ))}

          {searchText.length >= 2 && !searching && garageResults.length === 0 && (
            <Text style={styles.noResults}>No garages found for "{searchText}"</Text>
          )}

          {selectedGarage && (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('confirm')}>
              <Text style={styles.nextBtnText}>Next — Share with {selectedGarage.name}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedGarage && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>Confirm Share</Text>
          <Text style={styles.stepSub}>Review before sending</Text>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Sharing with</Text>
            <Text style={styles.confirmGarage}>{selectedGarage.name}</Text>
            {selectedGarage.verified && <Text style={styles.verifiedText}>✅ Verified Garage</Text>}
            {selectedGarage.address && (
              <Text style={styles.confirmAddress}>📍 {selectedGarage.address}</Text>
            )}
          </View>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>{selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} will be shared</Text>
            {records
              .filter(r => selectedIds.has(r.id))
              .map(r => (
                <View key={r.id} style={styles.confirmRecord}>
                  <Text style={styles.confirmRecordDate}>{formatDate(r.date)}</Text>
                  <Text style={styles.confirmRecordDesc} numberOfLines={1}>
                    {parseServices(r.description).slice(0, 2).join(', ')}
                    {parseServices(r.description).length > 2 ? '...' : ''}
                  </Text>
                </View>
              ))
            }
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              The garage will see a read-only view of these records only. They cannot edit or delete your history.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.shareBtn, sending && styles.nextBtnDisabled]}
            onPress={handleShare}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.shareBtnText}>Share Records</Text>
            }
          </TouchableOpacity>
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
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a73e8' },
  stepDotDone: { backgroundColor: '#34a853' },
  stepDotActive: { backgroundColor: '#1a73e8' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#34a853' },
  stepHeader: { padding: 20, paddingBottom: 8 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  stepSub: { fontSize: 13, color: '#888' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  recordCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  recordCardSelected: { borderColor: '#1a73e8', backgroundColor: '#f0f6ff' },
  recordTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recordDate: { flex: 1, fontSize: 13, color: '#555', fontWeight: '600' },
  recordCost: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  tag: { backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#333' },
  tagMore: { backgroundColor: '#e8f0fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagMoreText: { fontSize: 12, color: '#1a73e8', fontWeight: '600' },
  recordMileage: { fontSize: 11, color: '#aaa' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  nextBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0',
    marginBottom: 12, marginTop: 16,
  },
  garageCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  garageCardSelected: { borderColor: '#1a73e8', backgroundColor: '#f0f6ff' },
  garageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  garageName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  verifiedBadge: { fontSize: 16 },
  garageAddress: { fontSize: 13, color: '#888' },
  noResults: { color: '#888', textAlign: 'center', marginTop: 24 },
  confirmCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  confirmLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6 },
  confirmGarage: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  verifiedText: { fontSize: 13, color: '#34a853', fontWeight: '600', marginBottom: 4 },
  confirmAddress: { fontSize: 13, color: '#888' },
  confirmRecord: {
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  confirmRecordDate: { fontSize: 12, color: '#888', marginBottom: 2 },
  confirmRecordDesc: { fontSize: 13, color: '#333', fontWeight: '500' },
  warningBox: {
    backgroundColor: '#fff8e1', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  warningText: { fontSize: 13, color: '#795548', lineHeight: 19 },
  shareBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  serviceTypeCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  serviceTypeCardSelected: { borderColor: '#1a73e8', backgroundColor: '#f0f6ff' },
  serviceTypeIcon: { fontSize: 26 },
  serviceTypeLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  serviceTypeLabelSelected: { color: '#1a73e8' },
  serviceTypeDesc: { fontSize: 12, color: '#888' },
  serviceTypeCheck: { fontSize: 18, color: '#1a73e8', fontWeight: '700' },
})
