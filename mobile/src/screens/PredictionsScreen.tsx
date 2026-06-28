import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator,
  TextInput, Alert,
} from 'react-native'
import { api } from '../config/api'
import { ITEM_BRANDS } from '../constants/serviceData'

type ExtraFieldConfig = {
  key: string
  label: string
  type: 'chips' | 'text' | 'number'
  options?: string[]
  placeholder?: string
}

// Extra structured fields shown in the setup card per service type
const SETUP_EXTRA_FIELDS: Record<string, ExtraFieldConfig[]> = {
  'Oil Change': [
    { key: 'oilGrade', label: 'Oil Grade', type: 'chips', options: ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', '20W-50'] },
    { key: 'oilType',  label: 'Oil Type',  type: 'chips', options: ['Mineral', 'Semi-synthetic', 'Full synthetic'] },
  ],
  'Tyre Change': [
    { key: 'tyreSize',    label: 'Tyre Size',      type: 'text',  placeholder: 'e.g. 185/65R15' },
    { key: 'tyresChanged', label: 'Tyres Replaced', type: 'chips', options: ['1', '2', '4'] },
  ],
  'AC Gas Refill': [
    { key: 'refrigerantType', label: 'Refrigerant Type', type: 'chips', options: ['R134a', 'R1234yf', 'R22'] },
    { key: 'quantityGrams',   label: 'Quantity',          type: 'number', placeholder: 'grams, e.g. 500' },
  ],
  'Brake Fluid': [
    { key: 'fluidType', label: 'Fluid Type', type: 'chips', options: ['DOT 3', 'DOT 4', 'DOT 5.1'] },
  ],
  'Coolant Flush': [
    { key: 'coolantType', label: 'Coolant Type', type: 'chips', options: ['Green (Conventional)', 'Red/Pink (Long-life)', 'Blue (OAT)', 'HOAT'] },
  ],
  'Transmission Oil (Auto)': [
    { key: 'fluidType', label: 'Fluid Type', type: 'chips', options: ['ATF', 'CVT Fluid', 'DCT Fluid'] },
  ],
  'Gear Oil (Manual)': [
    { key: 'gearOilGrade', label: 'Oil Grade', type: 'chips', options: ['75W-90', '80W-90', '85W-90', 'GL-4', 'GL-5'] },
  ],
}

// Maps the first keyword of a prediction to { structuredKey, brandLookupKey }
// structuredKey = the field name stored in structuredData JSON
// brandLookupKey = the key in ITEM_BRANDS to pull the chip list from
const SETUP_BRAND_MAP: Record<string, { structuredKey: string; brandLookupKey: string }> = {
  'Oil Change':               { structuredKey: 'oilBrand',  brandLookupKey: 'Oil Change' },
  'Timing Belt':              { structuredKey: 'brandName', brandLookupKey: 'Timing Belt' },
  'Drive Belts':              { structuredKey: 'brandName', brandLookupKey: 'Drive Belts' },
  'Coolant Flush':            { structuredKey: 'brandName', brandLookupKey: 'Coolant Flush' },
  'Brake Pads (Front)':       { structuredKey: 'brandName', brandLookupKey: 'Brake Pads (Front)' },
  'Brake Fluid':              { structuredKey: 'brandName', brandLookupKey: 'Brake Fluid' },
  'Transmission Oil (Auto)':  { structuredKey: 'brandName', brandLookupKey: 'Transmission Oil (Auto)' },
  'Gear Oil (Manual)':        { structuredKey: 'brandName', brandLookupKey: 'Gear Oil (Manual)' },
  'Power Steering Fluid':     { structuredKey: 'brandName', brandLookupKey: 'Power Steering Fluid' },
  'Battery':                  { structuredKey: 'brandName', brandLookupKey: 'Battery' },
  'AC Filter':                { structuredKey: 'brandName', brandLookupKey: 'AC Filter' },
  'Air Filter':               { structuredKey: 'brandName', brandLookupKey: 'Air Filter' },
  'Fuel Filter':              { structuredKey: 'brandName', brandLookupKey: 'Fuel Filter' },
  'Spark Plugs':              { structuredKey: 'brandName', brandLookupKey: 'Spark Plugs' },
  'Glow Plugs':               { structuredKey: 'brandName', brandLookupKey: 'Glow Plugs (Diesel)' },
  'Shock Absorbers':          { structuredKey: 'brandName', brandLookupKey: 'Shock Absorbers (Front)' },
  'Water Pump':               { structuredKey: 'brandName', brandLookupKey: 'Water Pump' },
  'Chain & Sprocket':         { structuredKey: 'brandName', brandLookupKey: 'Chain & Sprocket' },
  'Chain Lubrication':        { structuredKey: 'brandName', brandLookupKey: 'Chain & Sprocket' },
  'Tyre Change':              { structuredKey: 'tyreBrand', brandLookupKey: 'Tyre Change' },
}

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

type Tab = 'services' | 'setup'

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  currentMileage: number
  initialTab?: Tab
  onBack: () => void
}

const STATUS_CONFIG = {
  overdue:  { color: '#c62828', bg: '#fff5f5', badge: '⚠️ Overdue',  badgeColor: '#c62828', badgeBg: '#fdecea' },
  due_soon: { color: '#e65100', bg: '#fff8f0', badge: '🔔 Due Soon', badgeColor: '#e65100', badgeBg: '#fff3e0' },
  ok:       { color: '#2e7d32', bg: '#fff',    badge: '✓ OK',         badgeColor: '#2e7d32', badgeBg: '#f1f8e9' },
  no_data:  { color: '#999',    bg: '#fff',    badge: '? No Record',  badgeColor: '#777',    badgeBg: '#f5f5f5' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function kmStr(km: number) {
  return km.toLocaleString() + ' km'
}

type SetupEntry = { date: string; mileage: string; brand: string; extras: Record<string, string> }

export default function PredictionsScreen({ token, vehicleId, vehicleName, currentMileage, initialTab = 'services', onBack }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [setupEntries, setSetupEntries] = useState<Record<string, SetupEntry>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // Allow parent to switch tab via prop change (e.g. from notification)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getPredictions(token, vehicleId)
      setPredictions(data)
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const urgent  = predictions.filter(p => p.status === 'overdue' || p.status === 'due_soon')
  const ok      = predictions.filter(p => p.status === 'ok')
  const noData  = predictions.filter(p => p.status === 'no_data')

  const getEntry = (id: string): SetupEntry => setupEntries[id] || { date: '', mileage: '', brand: '', extras: {} }
  const setEntry = (id: string, field: 'date' | 'mileage' | 'brand', value: string) =>
    setSetupEntries(prev => ({ ...prev, [id]: { ...getEntry(id), [field]: value } }))
  const setExtra = (id: string, key: string, value: string) =>
    setSetupEntries(prev => ({ ...prev, [id]: { ...getEntry(id), extras: { ...getEntry(id).extras, [key]: value } } }))

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
    const year  = parseInt(parts[1], 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1990 || year > currentYear) {
      Alert.alert('Invalid date', `Month must be 01–12 and year must be 1990–${currentYear}`)
      return
    }

    const isoDate    = new Date(year, month - 1, 15).toISOString()
    const mileageNum = entry.mileage.trim() ? parseInt(entry.mileage, 10) : undefined

    const brandConfig  = SETUP_BRAND_MAP[p.keywords[0]]
    const extraFields  = SETUP_EXTRA_FIELDS[p.keywords[0]] || []
    const structured: Record<string, string | number> = {}
    if (brandConfig && entry.brand) structured[brandConfig.structuredKey] = entry.brand
    for (const ef of extraFields) {
      const val = (entry.extras || {})[ef.key]
      if (val) structured[ef.key] = ef.type === 'number' ? Number(val) : val
    }
    const structuredData = Object.keys(structured).length > 0
      ? { [p.keywords[0]]: structured }
      : undefined

    setSavingId(p.id)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description: p.keywords[0],
        mileage: mileageNum,
        notes: 'Added via Prediction Setup',
        structuredData,
      })
      await load()
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const renderServiceCard = (p: Prediction) => {
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
        {distanceLine !== '' && <Text style={[styles.distanceLine, { color: cfg.color }]}>{distanceLine}</Text>}
        {timeLine      !== '' && <Text style={styles.timeLine}>{timeLine}</Text>}
        {lastLine      !== '' && <Text style={styles.lastLine}>{lastLine}</Text>}
        <Text style={styles.source}>{p.source}</Text>
      </View>
    )
  }

  const renderSetupCard = (p: Prediction) => {
    const entry       = getEntry(p.id)
    const isSaving    = savingId === p.id
    const brandConfig  = SETUP_BRAND_MAP[p.keywords[0]]
    const brandOptions = brandConfig ? ITEM_BRANDS[brandConfig.brandLookupKey] : undefined
    const extraFields  = SETUP_EXTRA_FIELDS[p.keywords[0]] || []

    return (
      <View key={p.id} style={styles.setupCard}>
        <View style={styles.setupCardHeader}>
          <Text style={styles.setupCardName}>{p.name}</Text>
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

        {brandOptions && brandOptions.length > 0 && (
          <View style={styles.brandSection}>
            <Text style={styles.setupFieldLabel}>Brand Used (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow}>
              {brandOptions.map(brand => (
                <TouchableOpacity
                  key={brand}
                  style={[styles.brandChip, entry.brand === brand && styles.brandChipSelected]}
                  onPress={() => setEntry(p.id, 'brand', entry.brand === brand ? '' : brand)}
                >
                  <Text style={[styles.brandChipText, entry.brand === brand && styles.brandChipTextSelected]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {extraFields.map(ef => (
          <View key={ef.key} style={styles.brandSection}>
            <Text style={styles.setupFieldLabel}>{ef.label} (optional)</Text>
            {ef.type === 'chips' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow}>
                {(ef.options || []).map(opt => {
                  const selected = (entry.extras[ef.key] || '') === opt
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.brandChip, selected && styles.brandChipSelected]}
                      onPress={() => setExtra(p.id, ef.key, selected ? '' : opt)}
                    >
                      <Text style={[styles.brandChipText, selected && styles.brandChipTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            ) : (
              <TextInput
                style={styles.setupInput}
                placeholder={ef.placeholder || ''}
                placeholderTextColor="#bbb"
                value={entry.extras[ef.key] || ''}
                onChangeText={v => setExtra(p.id, ef.key, ef.type === 'number' ? v.replace(/[^0-9]/g, '') : v)}
                keyboardType={ef.type === 'number' ? 'number-pad' : 'default'}
              />
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.setupSaveBtn, isSaving && { opacity: 0.6 }]}
          onPress={() => handleSave(p)}
          disabled={isSaving}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.setupSaveBtnText}>Save & Start Predicting →</Text>
          }
        </TouchableOpacity>

        <Text style={styles.setupSource}>{p.source}</Text>
      </View>
    )
  }

  const tabBar = (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'services' && styles.tabBtnActive]}
        onPress={() => setActiveTab('services')}
      >
        <Text style={[styles.tabBtnText, activeTab === 'services' && styles.tabBtnTextActive]}>
          Upcoming Services
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'setup' && styles.tabBtnActive]}
        onPress={() => setActiveTab('setup')}
      >
        <Text style={[styles.tabBtnText, activeTab === 'setup' && styles.tabBtnTextActive]}>
          Set Up
        </Text>
        {noData.length > 0 && (
          <View style={[styles.tabBadge, activeTab === 'setup' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'setup' && styles.tabBadgeTextActive]}>
              {noData.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )

  const servicesContent = (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Setup nudge banner — shown on services tab when items need setup */}
      {noData.length > 0 && (
        <TouchableOpacity style={styles.setupNudge} onPress={() => setActiveTab('setup')} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupNudgeTitle}>
              {noData.length} item{noData.length > 1 ? 's' : ''} waiting for your history
            </Text>
            <Text style={styles.setupNudgeBody}>
              Add when these were last done to unlock more predictions
            </Text>
          </View>
          <Text style={styles.setupNudgeArrow}>→</Text>
        </TouchableOpacity>
      )}

      {urgent.length === 0 && ok.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No tracked services yet</Text>
          <Text style={styles.emptyBody}>
            Add service records or use the Set Up tab to enter when services were last done.
          </Text>
        </View>
      )}

      {urgent.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>Needs Attention</Text>
          {urgent.map(renderServiceCard)}
        </View>
      )}

      {ok.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>On Track</Text>
          {ok.map(renderServiceCard)}
        </View>
      )}
    </ScrollView>
  )

  const setupContent = (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={styles.scrollContent}
    >
      {noData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>All set!</Text>
          <Text style={styles.emptyBody}>
            All service items have history. Check the Upcoming Services tab for predictions.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.setupBanner}>
            <Text style={styles.setupBannerTitle}>Set up your predictions</Text>
            <Text style={styles.setupBannerBody}>
              Tell us when each service was last done — even an approximate month and year is enough. This data never changes unless you add a new service record.
            </Text>
          </View>
          {noData.map(renderSetupCard)}
        </>
      )}
    </ScrollView>
  )

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

      {tabBar}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#1a73e8" />
      ) : (
        activeTab === 'services' ? servicesContent : setupContent
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

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
    gap: 6,
  },
  tabBtnActive: { borderBottomColor: '#1a73e8' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabBtnTextActive: { color: '#1a73e8' },
  tabBadge: {
    backgroundColor: '#e0e0e0', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: { backgroundColor: '#1a73e8' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#555' },
  tabBadgeTextActive: { color: '#fff' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Setup nudge on services tab
  setupNudge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff8e1', borderRadius: 12,
    borderLeftWidth: 4, borderLeftColor: '#f9a825',
    padding: 12, marginBottom: 14,
  },
  setupNudgeTitle: { fontSize: 14, fontWeight: '700', color: '#5d4037', marginBottom: 2 },
  setupNudgeBody: { fontSize: 12, color: '#795548' },
  setupNudgeArrow: { fontSize: 18, color: '#f9a825', marginLeft: 8, fontWeight: '700' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#888',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 8, marginLeft: 2,
  },

  // Prediction card
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

  // Setup tab
  setupBanner: {
    backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, marginBottom: 14,
  },
  setupBannerTitle: { fontSize: 15, fontWeight: '700', color: '#1a3a6b', marginBottom: 4 },
  setupBannerBody: { fontSize: 13, color: '#1a3a6b', lineHeight: 19 },

  setupCard: {
    backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4,
    borderLeftColor: '#9e9e9e', padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  setupCardHeader: { marginBottom: 8 },
  setupCardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

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

  brandSection: { marginBottom: 12 },
  brandRow: { marginTop: 6 },
  brandChip: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
    backgroundColor: '#fafafa',
  },
  brandChipSelected: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  brandChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  brandChipTextSelected: { color: '#1a73e8', fontWeight: '700' },
})
