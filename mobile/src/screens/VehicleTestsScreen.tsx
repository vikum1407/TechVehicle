import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'
import { parseDMY } from '../constants/serviceData'

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  currentMileage: number
  onBack: () => void
}

type Tab = 'emission' | 'alignment'

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
  structuredData: any
}

function todayDMY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function parseMMYYYY(s: string): string | null {
  const parts = s.split('/')
  if (parts.length !== 2) return null
  const [m, y] = parts
  if (!m || !y || y.length !== 4) return null
  const date = new Date(Number(y), Number(m), 0)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function fmtDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return isoDate
  }
}

export default function VehicleTestsScreen({ token, vehicleId, vehicleName, currentMileage, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('emission')
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  // Emission form
  const [eResult, setEResult] = useState<'Pass' | 'Fail' | ''>('')
  const [eDate, setEDate] = useState(todayDMY())
  const [eMileage, setEMileage] = useState(String(currentMileage))
  const [eCo, setECo] = useState('')
  const [eHc, setEHc] = useState('')
  const [eCo2, setECo2] = useState('')
  const [eLambda, setELambda] = useState('')
  const [eStation, setEStation] = useState('')
  const [eCost, setECost] = useState('')
  const [eNextExpiry, setENextExpiry] = useState('')
  const [eSaving, setESaving] = useState(false)

  // Alignment form
  const [aDate, setADate] = useState(todayDMY())
  const [aMileage, setAMileage] = useState(String(currentMileage))
  const [aAxle, setAAxle] = useState<'Front' | 'Rear' | 'Both' | ''>('')
  const [aCost, setACost] = useState('')
  const [aSaving, setASaving] = useState(false)

  const loadRecords = useCallback(async () => {
    try {
      setLoadingRecords(true)
      const data = await api.getServiceRecords(token, vehicleId)
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      // history just won't show
    } finally {
      setLoadingRecords(false)
    }
  }, [token, vehicleId])

  useEffect(() => { loadRecords() }, [loadRecords])

  const emissionHistory = records
    .filter(r => r.description.toLowerCase().includes('emission test'))
    .slice(0, 5)

  const alignmentHistory = records
    .filter(r => r.description.toLowerCase().includes('wheel alignment'))
    .slice(0, 5)

  // Tyre life prediction from alignment frequency since last tyre change
  const tyrePrediction = (() => {
    const tyreChanges = records
      .filter(r => r.description.toLowerCase().includes('tyre change'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const lastTyre = tyreChanges[0]
    if (!lastTyre) return null

    const sinceDate = new Date(lastTyre.date)
    const alignmentsSince = records.filter(r =>
      r.description.toLowerCase().includes('wheel alignment') &&
      new Date(r.date) > sinceDate
    )

    const lastTyreKm = lastTyre.mileage
    const kmSince = lastTyreKm !== null ? currentMileage - lastTyreKm : null

    let multiplier = 1.0
    let freqNote = 'no alignment data — using 40,000 km baseline'
    if (kmSince !== null && kmSince > 0 && alignmentsSince.length > 0) {
      const per10k = (alignmentsSince.length / kmSince) * 10000
      if (per10k <= 0.5)      { multiplier = 1.2; freqNote = 'low alignment frequency — good roads' }
      else if (per10k <= 1.0) { multiplier = 1.0; freqNote = 'normal alignment frequency' }
      else if (per10k <= 2.0) { multiplier = 0.8; freqNote = 'high alignment frequency — rough roads or wear' }
      else                    { multiplier = 0.65; freqNote = 'very high frequency — inspect suspension' }
    } else if (alignmentsSince.length > 0) {
      freqNote = `${alignmentsSince.length} alignment${alignmentsSince.length > 1 ? 's' : ''} since last tyre change`
    }

    const BASE = 40000
    const predictedLife = Math.round(BASE * multiplier)
    const dueAtKm = lastTyreKm !== null ? lastTyreKm + predictedLife : null
    const remainingKm = dueAtKm !== null ? dueAtKm - currentMileage : null

    return {
      lastTyreDate: fmtDate(lastTyre.date),
      lastTyreKm,
      alignmentCount: alignmentsSince.length,
      freqNote,
      predictedLife,
      dueAtKm,
      remainingKm,
    }
  })()

  const saveEmissionTest = async () => {
    if (!eResult) { Alert.alert('Required', 'Please select Pass or Fail'); return }
    const isoDate = parseDMY(eDate)
    if (!isoDate) { Alert.alert('Invalid date', 'Use DD/MM/YYYY format'); return }

    let nextExpiryISO: string | undefined
    if (eNextExpiry.trim()) {
      const parsed = parseMMYYYY(eNextExpiry.trim())
      if (!parsed) { Alert.alert('Invalid expiry', 'Use MM/YYYY format — e.g. 06/2027'); return }
      nextExpiryISO = parsed
    }

    const mileageNum = eMileage ? parseInt(eMileage) : null

    const doSave = async () => {
      setESaving(true)
      try {
        await api.logEmissionTest(token, vehicleId, {
          date: isoDate,
          mileage: mileageNum ?? undefined,
          result: eResult,
          co: eCo || undefined,
          hc: eHc || undefined,
          co2: eCo2 || undefined,
          lambda: eLambda || undefined,
          station: eStation || undefined,
          cost: eCost ? parseFloat(eCost) : undefined,
          nextExpiryDate: nextExpiryISO,
        })
        if (nextExpiryISO) {
          await api.updateVehicleExpiry(token, vehicleId, { emissionTestExpiry: nextExpiryISO })
        }
        Alert.alert('Saved', 'Emission test recorded.')
        setEResult(''); setEDate(todayDMY()); setEMileage(String(currentMileage))
        setECo(''); setEHc(''); setECo2(''); setELambda('')
        setEStation(''); setECost(''); setENextExpiry('')
        loadRecords()
      } catch (e: any) {
        Alert.alert('Error', e.message)
      } finally {
        setESaving(false)
      }
    }

    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        'Check mileage',
        `${mileageNum.toLocaleString()} km is higher than current recorded mileage. Correct?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes, save', onPress: doSave }]
      )
      return
    }
    await doSave()
  }

  const saveAlignment = async () => {
    const isoDate = parseDMY(aDate)
    if (!isoDate) { Alert.alert('Invalid date', 'Use DD/MM/YYYY format'); return }

    const mileageNum = aMileage ? parseInt(aMileage) : null

    const doSave = async () => {
      setASaving(true)
      try {
        const structuredData = aAxle
          ? { 'Wheel Alignment': { axle: aAxle } }
          : undefined
        await api.addServiceRecord(token, vehicleId, {
          date: isoDate,
          description: 'Wheel Alignment',
          mileage: mileageNum ?? undefined,
          cost: aCost ? parseFloat(aCost) : undefined,
          structuredData,
        })
        Alert.alert('Saved', 'Wheel alignment recorded.')
        setADate(todayDMY()); setAMileage(String(currentMileage)); setAAxle(''); setACost('')
        loadRecords()
      } catch (e: any) {
        Alert.alert('Error', e.message)
      } finally {
        setASaving(false)
      }
    }

    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        'Check mileage',
        `${mileageNum.toLocaleString()} km is higher than current recorded mileage. Correct?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes, save', onPress: doSave }]
      )
      return
    }
    await doSave()
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Vehicle Tests</Text>
        <Text style={s.sub}>{vehicleName}</Text>
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'emission' && s.tabActive]}
          onPress={() => setActiveTab('emission')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'emission' && s.tabTextActive]}>💨 Carbon Emission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'alignment' && s.tabActive]}
          onPress={() => setActiveTab('alignment')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'alignment' && s.tabTextActive]}>🔧 Wheel Alignment</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

        {activeTab === 'emission' ? (
          <>
            <Text style={s.sectionTitle}>Log Emission / Carbon Test</Text>

            <Text style={s.label}>Test Result <Text style={s.req}>*</Text></Text>
            <View style={s.chipRow}>
              {(['Pass', 'Fail'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, eResult === opt && (opt === 'Pass' ? s.chipPass : s.chipFail)]}
                  onPress={() => setEResult(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, eResult === opt && s.chipTextSel]}>
                    {opt === 'Pass' ? '✓ Pass' : '✗ Fail'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Test Date</Text>
                <TextInput
                  style={s.input} value={eDate} onChangeText={setEDate}
                  placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Mileage (km)</Text>
                <TextInput
                  style={s.input} value={eMileage} onChangeText={setEMileage}
                  placeholder="e.g. 45000" keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={s.subSectionLabel}>Readings from test certificate (optional)</Text>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>CO %</Text>
                <TextInput style={s.input} value={eCo} onChangeText={setECo} placeholder="e.g. 0.8" keyboardType="decimal-pad" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>HC ppm</Text>
                <TextInput style={s.input} value={eHc} onChangeText={setEHc} placeholder="e.g. 120" keyboardType="number-pad" />
              </View>
            </View>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>CO₂ %</Text>
                <TextInput style={s.input} value={eCo2} onChangeText={setECo2} placeholder="e.g. 14.2" keyboardType="decimal-pad" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Lambda</Text>
                <TextInput style={s.input} value={eLambda} onChangeText={setELambda} placeholder="e.g. 1.01" keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={s.label}>Testing Station (optional)</Text>
            <TextInput style={s.input} value={eStation} onChangeText={setEStation} placeholder="e.g. Werahera Testing Station" />

            <Text style={s.label}>Cost (LKR, optional)</Text>
            <TextInput style={s.input} value={eCost} onChangeText={setECost} placeholder="e.g. 2500" keyboardType="number-pad" />

            <View style={s.reminderCard}>
              <Text style={s.reminderTitle}>Set Renewal Reminder</Text>
              <Text style={s.reminderSub}>We'll remind you 1 month before expiry, every 3 days until renewed.</Text>
              <Text style={s.label}>Next Expiry Date (MM/YYYY)</Text>
              <TextInput
                style={s.input} value={eNextExpiry} onChangeText={setENextExpiry}
                placeholder="e.g. 06/2027" keyboardType="numbers-and-punctuation"
              />
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={saveEmissionTest} disabled={eSaving} activeOpacity={0.8}>
              {eSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Emission Test</Text>}
            </TouchableOpacity>

            {emissionHistory.length > 0 && (
              <>
                <Text style={s.historyTitle}>Recent Tests</Text>
                {emissionHistory.map(r => {
                  const sd = r.structuredData?.['Emission Test / Carbon Test'] || {}
                  const pass = sd.result === 'Pass'
                  return (
                    <View key={r.id} style={[s.histCard, { borderLeftColor: pass ? '#2e7d32' : '#c62828' }]}>
                      <View style={s.histRow}>
                        <Text style={[s.histResult, { color: pass ? '#2e7d32' : '#c62828' }]}>
                          {pass ? '✓ Pass' : '✗ Fail'}
                        </Text>
                        <Text style={s.histDate}>{fmtDate(r.date)}</Text>
                        {r.mileage != null && <Text style={s.histMeta}>{r.mileage.toLocaleString()} km</Text>}
                      </View>
                      {(sd.co || sd.hc || sd.co2 || sd.lambda) && (
                        <Text style={s.histReadings}>
                          {[sd.co && `CO: ${sd.co}%`, sd.hc && `HC: ${sd.hc} ppm`, sd.co2 && `CO₂: ${sd.co2}%`, sd.lambda && `λ: ${sd.lambda}`].filter(Boolean).join('  ·  ')}
                        </Text>
                      )}
                      {sd.station && <Text style={s.histMeta}>{sd.station}</Text>}
                      {r.cost != null && <Text style={s.histCost}>LKR {r.cost.toLocaleString()}</Text>}
                    </View>
                  )
                })}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={s.sectionTitle}>Log Wheel Alignment</Text>

            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Date</Text>
                <TextInput
                  style={s.input} value={aDate} onChangeText={setADate}
                  placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Mileage (km)</Text>
                <TextInput
                  style={s.input} value={aMileage} onChangeText={setAMileage}
                  placeholder="e.g. 45000" keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={s.label}>Axle Aligned (optional)</Text>
            <View style={s.chipRow}>
              {(['Front', 'Rear', 'Both'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, aAxle === opt && s.chipSel]}
                  onPress={() => setAAxle(aAxle === opt ? '' : opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, aAxle === opt && s.chipTextSel]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Cost (LKR, optional)</Text>
            <TextInput style={s.input} value={aCost} onChangeText={setACost} placeholder="e.g. 1500" keyboardType="number-pad" />

            <TouchableOpacity style={s.saveBtn} onPress={saveAlignment} disabled={aSaving} activeOpacity={0.8}>
              {aSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Alignment Record</Text>}
            </TouchableOpacity>

            {tyrePrediction ? (
              <View style={s.predCard}>
                <Text style={s.predTitle}>Tyre Life Prediction</Text>
                <Text style={s.predNote}>
                  {tyrePrediction.alignmentCount > 0
                    ? `${tyrePrediction.alignmentCount} alignment${tyrePrediction.alignmentCount > 1 ? 's' : ''} since your last tyre change (${tyrePrediction.lastTyreDate}) — ${tyrePrediction.freqNote}.`
                    : `Based on your last tyre change (${tyrePrediction.lastTyreDate}). Log alignments to refine this prediction.`
                  }
                </Text>
                <View style={s.predRow}>
                  <View style={s.predStat}>
                    <Text style={s.predStatVal}>{tyrePrediction.predictedLife.toLocaleString()} km</Text>
                    <Text style={s.predStatLabel}>Predicted life</Text>
                  </View>
                  {tyrePrediction.dueAtKm != null && (
                    <View style={s.predStat}>
                      <Text style={s.predStatVal}>{tyrePrediction.dueAtKm.toLocaleString()} km</Text>
                      <Text style={s.predStatLabel}>Change due at</Text>
                    </View>
                  )}
                  {tyrePrediction.remainingKm != null && (
                    <View style={s.predStat}>
                      <Text style={[
                        s.predStatVal,
                        tyrePrediction.remainingKm < 0 ? { color: '#c62828' } : tyrePrediction.remainingKm <= 3000 ? { color: '#e65100' } : {},
                      ]}>
                        {tyrePrediction.remainingKm < 0
                          ? `${Math.abs(tyrePrediction.remainingKm).toLocaleString()} km overdue`
                          : `${tyrePrediction.remainingKm.toLocaleString()} km left`
                        }
                      </Text>
                      <Text style={s.predStatLabel}>Remaining</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.predHint}>
                <Text style={s.predHintText}>
                  💡 Log a Tyre Change in your service records to unlock a personalised tyre life prediction based on your alignment history.
                </Text>
              </View>
            )}

            {alignmentHistory.length > 0 && (
              <>
                <Text style={s.historyTitle}>Recent Alignments</Text>
                {alignmentHistory.map(r => {
                  const sd = r.structuredData?.['Wheel Alignment'] || {}
                  return (
                    <View key={r.id} style={[s.histCard, { borderLeftColor: '#1a73e8' }]}>
                      <View style={s.histRow}>
                        <Text style={s.histLabel}>Wheel Alignment</Text>
                        <Text style={s.histDate}>{fmtDate(r.date)}</Text>
                        {r.mileage != null && <Text style={s.histMeta}>{r.mileage.toLocaleString()} km</Text>}
                      </View>
                      {sd.axle && <Text style={s.histMeta}>Axle: {sd.axle}</Text>}
                      {r.cost != null && <Text style={s.histCost}>LKR {r.cost.toLocaleString()}</Text>}
                    </View>
                  )
                })}
              </>
            )}

            {!loadingRecords && alignmentHistory.length === 0 && (
              <Text style={s.emptyNote}>No alignment records yet. Log your first one above.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  header: { backgroundColor: '#fff', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e8eaf0' },
  back: { color: '#1a73e8', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8eaf0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#1a73e8' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a2e', marginBottom: 16 },
  subSectionLabel: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginTop: 20, marginBottom: 2 },

  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  req: { color: '#e53935' },
  input: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1a1a2e',
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff',
  },
  chipSel: { backgroundColor: '#e8f0fe', borderColor: '#1a73e8' },
  chipPass: { backgroundColor: '#e6f4ea', borderColor: '#2e7d32' },
  chipFail: { backgroundColor: '#fce8e6', borderColor: '#c62828' },
  chipText: { fontSize: 14, color: '#666', fontWeight: '600' },
  chipTextSel: { color: '#1a1a2e' },

  reminderCard: {
    backgroundColor: '#e8f0fe', borderRadius: 14, padding: 16,
    marginTop: 24, borderWidth: 1, borderColor: '#c5d8fd',
  },
  reminderTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 4 },
  reminderSub: { fontSize: 12, color: '#555', marginBottom: 8 },

  saveBtn: {
    backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  historyTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 32, marginBottom: 12 },
  histCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderLeftWidth: 4, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  histRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  histResult: { fontSize: 14, fontWeight: '700' },
  histLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  histDate: { fontSize: 13, color: '#666' },
  histMeta: { fontSize: 12, color: '#888' },
  histReadings: { fontSize: 12, color: '#555', marginTop: 2 },
  histCost: { fontSize: 12, color: '#1a73e8', fontWeight: '600', marginTop: 4 },

  predCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 24, borderWidth: 1, borderColor: '#e0e0e0',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  predTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  predNote: { fontSize: 12, color: '#666', marginBottom: 14, lineHeight: 18 },
  predRow: { flexDirection: 'row', justifyContent: 'space-around' },
  predStat: { alignItems: 'center', flex: 1 },
  predStatVal: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', textAlign: 'center' },
  predStatLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },

  predHint: {
    backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: '#c5d8fd',
  },
  predHintText: { fontSize: 13, color: '#3c4bdc', lineHeight: 20 },

  emptyNote: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 24 },
})
