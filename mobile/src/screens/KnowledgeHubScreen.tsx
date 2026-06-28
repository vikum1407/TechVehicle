import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, TextInput, Alert,
} from 'react-native'
import { api } from '../config/api'

type VehicleSpec = {
  id: string
  make: string
  model: string
  yearFrom: number
  yearTo: number | null
  fuelType: string
  engine?: string
  engineCapacityCC?: number
  // Oil
  oilGrade: string
  oilType: string
  oilCapacityL?: number
  oilChangeKm: number
  oilNote?: string
  // Tyres
  tyreSizeFront: string
  tyreSizeRear?: string
  // Timing
  timingType: 'belt' | 'chain' | 'gear-driven'
  timingBeltKm?: number
  // Coolant
  coolantType?: string
  coolantFlushIntervalKm?: number
  // Transmission
  transmissionFluidType?: string
  transmissionFluidIntervalKm?: number
  // Spark plugs
  sparkPlugType?: string
  sparkPlugIntervalKm?: number
  // Brake fluid
  brakeFluidType?: string
  brakeFluidIntervalDays?: number
  // Air filter
  airFilterIntervalKm?: number
  // Fuel economy
  fuelEconomyKmL?: number
  knownIssues: string[]
  notes?: string
}

type ServiceRecord = {
  description: string
  mileage: number | null
  date: string
  structuredData?: Record<string, any> | null
}

type Props = {
  token: string
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    mileage: number
    fuelType: string
  }
  onBack: () => void
}

type InsightResult = { status: 'ok' | 'warn' | 'info'; text: string }
type Tab = 'myVehicle' | 'search'

export default function KnowledgeHubScreen({ token, vehicle, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('myVehicle')
  const [spec, setSpec] = useState<VehicleSpec | null>(null)
  const [specLoading, setSpecLoading] = useState(true)
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [allSpecs, setAllSpecs] = useState<VehicleSpec[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => { loadMyVehicleSpec() }, [])
  useEffect(() => { if (tab === 'search' && allSpecs.length === 0) loadAllSpecs() }, [tab])

  const loadMyVehicleSpec = async () => {
    setSpecLoading(true)
    try {
      const [matchedSpec, recs] = await Promise.all([
        api.getVehicleKnowledgeMatch(vehicle.make, vehicle.model, vehicle.year),
        api.getServiceRecords(token, vehicle.id).catch(() => []),
      ])
      setSpec(matchedSpec)
      setRecords(recs)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSpecLoading(false)
    }
  }

  const loadAllSpecs = async () => {
    setSearchLoading(true)
    try {
      const data = await api.getVehicleKnowledgeAll()
      setAllSpecs(data)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSearchLoading(false)
    }
  }

  // ── Record helpers ─────────────────────────────────────────────────────────

  const getLastRecord = (keywords: string[]): ServiceRecord | undefined =>
    records.find(r => keywords.some(kw => r.description.toLowerCase().includes(kw.toLowerCase())))

  const getStructured = (record: ServiceRecord, key: string): Record<string, any> =>
    (record.structuredData as any)?.[key] || {}

  const daysSince = (dateStr: string): number =>
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)

  // ── Personalised insights ──────────────────────────────────────────────────

  const oilInsight = (): InsightResult | null => {
    if (!spec) return null
    const last = getLastRecord(['oil change'])
    if (!last) {
      return {
        status: 'info',
        text: `No oil change logged yet. Manufacturer recommends ${spec.oilGrade} ${spec.oilType}${spec.oilCapacityL ? ` (${spec.oilCapacityL}L)` : ''}.${spec.oilNote ? ` Note: ${spec.oilNote}` : ''}`,
      }
    }

    const sd = getStructured(last, 'Oil Change')
    const loggedGrade: string | null = sd.oilGrade || null
    const loggedType: string | null = sd.oilType || null
    const loggedBrand: string | null = sd.oilBrand || null

    // Interval check (secondary info if mileage available)
    let intervalNote = ''
    if (last.mileage) {
      const kmSince = vehicle.mileage - last.mileage
      if (kmSince > spec.oilChangeKm) {
        intervalNote = ` Oil change also OVERDUE by ${(kmSince - spec.oilChangeKm).toLocaleString()} km.`
      }
    }

    if (!loggedGrade && !loggedType) {
      const brandText = loggedBrand ? ` using ${loggedBrand}` : ''
      return {
        status: 'info',
        text: `Last oil change logged${brandText}. Log oil grade (e.g. ${spec.oilGrade}) in Prediction Setup to check against manufacturer spec.${intervalNote}`,
      }
    }

    const gradeMatches = loggedGrade ? loggedGrade.trim() === spec.oilGrade.trim() : true
    const typeMatches = loggedType && spec.oilType
      ? loggedType.toLowerCase() === spec.oilType.toLowerCase()
      : true

    if (!gradeMatches) {
      return {
        status: 'warn',
        text: `Using ${loggedGrade}${loggedType ? ` ${loggedType}` : ''} but ${spec.make} recommends ${spec.oilGrade} ${spec.oilType}. Wrong viscosity can accelerate engine wear.${intervalNote}`,
      }
    }
    if (!typeMatches) {
      return {
        status: 'warn',
        text: `Oil grade ${loggedGrade} matches ✓ but oil type (${loggedType}) differs from recommendation (${spec.oilType}). Consider switching.${intervalNote}`,
      }
    }
    return {
      status: 'ok',
      text: `Oil grade ${loggedGrade} ${loggedType} matches manufacturer spec ✓${intervalNote}`,
    }
  }

  const tyreInsight = (): InsightResult | null => {
    if (!spec) return null
    const last = getLastRecord(['tyre change'])
    if (!last) {
      return {
        status: 'info',
        text: `OEM tyre size: ${spec.tyreSizeFront}${spec.tyreSizeRear ? ` front / ${spec.tyreSizeRear} rear` : ''}. Log a tyre change to track km per set.`,
      }
    }
    const sd = getStructured(last, 'Tyre Change')
    const loggedSize: string | null = sd.tyreSize || null
    if (loggedSize) {
      const matches = loggedSize.trim() === spec.tyreSizeFront.trim()
      return {
        status: matches ? 'ok' : 'warn',
        text: matches
          ? `Tyre size ${loggedSize} matches OEM spec ✓`
          : `Your logged tyre size (${loggedSize}) differs from OEM spec (${spec.tyreSizeFront}). Verify with a tyre specialist.`,
      }
    }
    return {
      status: 'info',
      text: `OEM tyre size: ${spec.tyreSizeFront}${spec.tyreSizeRear ? ` front / ${spec.tyreSizeRear} rear` : ''}.`,
    }
  }

  const timingInsight = (): InsightResult | null => {
    if (!spec) return null
    if (spec.timingType === 'chain') return { status: 'ok', text: 'Chain-driven engine — no timing belt replacement needed ✓' }
    if (spec.timingType === 'gear-driven') return { status: 'ok', text: 'Gear-driven engine — no timing belt service needed ✓' }
    const last = getLastRecord(['timing belt', 'cam belt'])
    if (!last) {
      return {
        status: 'warn',
        text: `Timing belt engine — no replacement logged. Replace every ${spec.timingBeltKm?.toLocaleString() ?? '?'} km. Skipping this destroys the engine.`,
      }
    }
    const lastKm = last.mileage ?? 0
    const dueAt = lastKm + (spec.timingBeltKm ?? 60000)
    const remaining = dueAt - vehicle.mileage
    if (remaining < 0) return { status: 'warn', text: `Timing belt OVERDUE by ${Math.abs(remaining).toLocaleString()} km — replace immediately.` }
    if (remaining <= 10000) return { status: 'warn', text: `Timing belt due in ${remaining.toLocaleString()} km — schedule soon.` }
    return { status: 'ok', text: `Timing belt due in ${remaining.toLocaleString()} km ✓` }
  }

  const coolantInsight = (): InsightResult | null => {
    if (!spec?.coolantType) return null
    const last = getLastRecord(['coolant flush', 'coolant change', 'radiator flush'])
    if (!last) {
      const intervalText = spec.coolantFlushIntervalKm ? ` every ${spec.coolantFlushIntervalKm.toLocaleString()} km` : ''
      return { status: 'info', text: `No coolant service logged. Use ${spec.coolantType}${intervalText}. Wrong coolant can cause corrosion and overheating.` }
    }
    if (spec.coolantFlushIntervalKm && last.mileage) {
      const remaining = (last.mileage + spec.coolantFlushIntervalKm) - vehicle.mileage
      if (remaining < 0) return { status: 'warn', text: `Coolant flush OVERDUE by ${Math.abs(remaining).toLocaleString()} km. Use ${spec.coolantType}.` }
      if (remaining <= 20000) return { status: 'warn', text: `Coolant flush due in ${remaining.toLocaleString()} km. Use ${spec.coolantType}.` }
      return { status: 'ok', text: `Coolant flush due in ${remaining.toLocaleString()} km (${spec.coolantType}) ✓` }
    }
    return { status: 'ok', text: `Coolant service logged. Recommended type: ${spec.coolantType}.` }
  }

  const transmissionInsight = (): InsightResult | null => {
    if (!spec?.transmissionFluidType) return null
    const last = getLastRecord(['transmission oil', 'transmission fluid', 'cvt fluid', 'atf fluid', 'gear oil', 'gearbox oil'])
    if (!last) {
      const intervalText = spec.transmissionFluidIntervalKm
        ? ` every ${spec.transmissionFluidIntervalKm.toLocaleString()} km`
        : ''
      return {
        status: 'info',
        text: `No transmission fluid service logged. Recommended: ${spec.transmissionFluidType}${intervalText}. Skipping causes premature wear.`,
      }
    }
    if (spec.transmissionFluidIntervalKm && last.mileage) {
      const remaining = (last.mileage + spec.transmissionFluidIntervalKm) - vehicle.mileage
      if (remaining < 0) return { status: 'warn', text: `Transmission fluid OVERDUE by ${Math.abs(remaining).toLocaleString()} km. Use ${spec.transmissionFluidType}.` }
      if (remaining <= 10000) return { status: 'warn', text: `Transmission fluid due in ${remaining.toLocaleString()} km (${spec.transmissionFluidType}).` }
      return { status: 'ok', text: `Transmission fluid due in ${remaining.toLocaleString()} km (${spec.transmissionFluidType}) ✓` }
    }
    return { status: 'ok', text: `Transmission fluid serviced. Recommended: ${spec.transmissionFluidType}.` }
  }

  const sparkPlugInsight = (): InsightResult | null => {
    if (!spec?.sparkPlugIntervalKm || !spec?.sparkPlugType) return null
    // Skip for diesel (no spark plugs)
    if (vehicle.fuelType === 'diesel') return null
    const last = getLastRecord(['spark plug'])
    if (!last) {
      return {
        status: 'info',
        text: `No spark plug change logged. Type: ${spec.sparkPlugType}, replace every ${spec.sparkPlugIntervalKm.toLocaleString()} km.`,
      }
    }
    if (last.mileage) {
      const remaining = (last.mileage + spec.sparkPlugIntervalKm) - vehicle.mileage
      if (remaining < 0) return { status: 'warn', text: `Spark plugs OVERDUE by ${Math.abs(remaining).toLocaleString()} km — replace soon.` }
      if (remaining <= 15000) return { status: 'warn', text: `Spark plugs due in ${remaining.toLocaleString()} km (${spec.sparkPlugType}).` }
      return { status: 'ok', text: `Spark plugs due in ${remaining.toLocaleString()} km (${spec.sparkPlugType}) ✓` }
    }
    return { status: 'ok', text: `Spark plug change logged. Type: ${spec.sparkPlugType}.` }
  }

  const brakeFluidInsight = (): InsightResult | null => {
    if (!spec?.brakeFluidType || !spec?.brakeFluidIntervalDays) return null
    const last = getLastRecord(['brake fluid'])
    if (!last) {
      const years = Math.round(spec.brakeFluidIntervalDays / 365)
      return {
        status: 'info',
        text: `No brake fluid change logged. Use ${spec.brakeFluidType} — replace every ${years} years. Brake fluid absorbs moisture over time, reducing stopping power.`,
      }
    }
    const daysPassed = daysSince(last.date)
    const daysLeft = spec.brakeFluidIntervalDays - daysPassed
    const years = Math.round(spec.brakeFluidIntervalDays / 365)
    if (daysLeft < 0) return { status: 'warn', text: `Brake fluid OVERDUE by ${Math.abs(Math.round(daysLeft / 30))} months. Use ${spec.brakeFluidType} — old fluid absorbs moisture and can cause brake fade.` }
    if (daysLeft < 180) return { status: 'warn', text: `Brake fluid due for change within ${Math.round(daysLeft / 30)} months. Use ${spec.brakeFluidType}.` }
    return { status: 'ok', text: `Brake fluid (${spec.brakeFluidType}) within ${years}-year service interval ✓` }
  }

  // ── Computed insights list ─────────────────────────────────────────────────

  const insights: InsightResult[] = spec
    ? [
        oilInsight(),
        tyreInsight(),
        timingInsight(),
        coolantInsight(),
        transmissionInsight(),
        sparkPlugInsight(),
        brakeFluidInsight(),
      ].filter((i): i is InsightResult => i !== null)
    : []

  // ── Search filter ──────────────────────────────────────────────────────────

  const filteredSpecs = allSpecs.filter(s => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return s.make.toLowerCase().includes(q) || s.model.toLowerCase().includes(q)
  })

  // ── Render helpers ─────────────────────────────────────────────────────────

  const statusStyle = (status: 'ok' | 'warn' | 'info') =>
    status === 'ok' ? styles.insightOk : status === 'warn' ? styles.insightWarn : styles.insightInfo

  const statusIcon = (status: 'ok' | 'warn' | 'info') =>
    status === 'ok' ? '✓' : status === 'warn' ? '⚠' : 'ℹ'

  const renderSpecCard = (s: VehicleSpec, showIssues = true) => (
    <View style={styles.specCard}>
      <View style={styles.specCardHeader}>
        <Text style={styles.specCardTitle}>{s.make} {s.model}</Text>
        <Text style={styles.specCardYear}>{s.yearFrom}–{s.yearTo ?? 'present'}</Text>
      </View>
      {(s.engine || s.engineCapacityCC) && (
        <Text style={styles.specEngine}>
          {[s.engine, s.engineCapacityCC ? `${s.engineCapacityCC}cc` : null, s.fuelType].filter(Boolean).join(' · ')}
        </Text>
      )}

      {/* ── Oil & Tyres ── */}
      <Text style={styles.specSectionLabel}>Engine Oil</Text>
      <View style={styles.specGrid}>
        <SpecItem label="Grade" value={s.oilGrade} highlight />
        <SpecItem label="Type" value={s.oilType} />
        {s.oilCapacityL && <SpecItem label="Capacity" value={`${s.oilCapacityL}L`} />}
        <SpecItem label="Change Interval" value={`Every ${s.oilChangeKm.toLocaleString()} km`} />
      </View>
      {s.oilNote && (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>⚠ {s.oilNote}</Text>
        </View>
      )}

      <Text style={styles.specSectionLabel}>Tyres & Timing</Text>
      <View style={styles.specGrid}>
        <SpecItem label="Tyre Size" value={`${s.tyreSizeFront}${s.tyreSizeRear ? ` / ${s.tyreSizeRear}` : ''}`} />
        <SpecItem
          label="Timing"
          value={s.timingType === 'belt'
            ? `Belt — ${s.timingBeltKm?.toLocaleString()} km`
            : s.timingType === 'chain' ? 'Chain ✓' : 'Gear-driven ✓'}
          highlight={s.timingType === 'belt'}
        />
        {s.fuelEconomyKmL && <SpecItem label="Fuel Economy" value={`~${s.fuelEconomyKmL} km/L`} />}
      </View>

      {/* ── Service Intervals ── */}
      {(s.coolantType || s.transmissionFluidType || s.sparkPlugType || s.brakeFluidType || s.airFilterIntervalKm) && (
        <>
          <Text style={styles.specSectionLabel}>Service Intervals</Text>
          <View style={styles.specGrid}>
            {s.coolantType && (
              <SpecItem
                label="Coolant"
                value={`${s.coolantType}${s.coolantFlushIntervalKm ? ` / ${s.coolantFlushIntervalKm.toLocaleString()} km` : ''}`}
              />
            )}
            {s.transmissionFluidType && (
              <SpecItem
                label="Trans. Fluid"
                value={`${s.transmissionFluidType}${s.transmissionFluidIntervalKm ? ` / ${s.transmissionFluidIntervalKm.toLocaleString()} km` : ''}`}
              />
            )}
            {s.sparkPlugType && (
              <SpecItem
                label="Spark Plugs"
                value={`${s.sparkPlugType}${s.sparkPlugIntervalKm ? ` / ${s.sparkPlugIntervalKm.toLocaleString()} km` : ''}`}
              />
            )}
            {s.brakeFluidType && (
              <SpecItem
                label="Brake Fluid"
                value={`${s.brakeFluidType}${s.brakeFluidIntervalDays ? ` / ${Math.round(s.brakeFluidIntervalDays / 365)} yrs` : ''}`}
              />
            )}
            {s.airFilterIntervalKm && (
              <SpecItem label="Air Filter" value={`Every ${s.airFilterIntervalKm.toLocaleString()} km`} />
            )}
          </View>
        </>
      )}

      {s.notes && (
        <View style={styles.notesBox}>
          <Text style={styles.noteText}>📝 {s.notes}</Text>
        </View>
      )}

      {showIssues && s.knownIssues.length > 0 && (
        <View style={styles.issuesBox}>
          <Text style={styles.issuesTitle}>⚠ Known Issues in Sri Lanka</Text>
          {s.knownIssues.map((issue, i) => (
            <View key={i} style={styles.issueRow}>
              <Text style={styles.issueDot}>•</Text>
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )

  // ── Main render ────────────────────────────────────────────────────────────

  const warnCount = insights.filter(i => i.status === 'warn').length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knowledge Hub</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'myVehicle' && styles.tabActive]}
          onPress={() => setTab('myVehicle')}
        >
          <Text style={[styles.tabText, tab === 'myVehicle' && styles.tabTextActive]}>
            {warnCount > 0 ? `⚠ My Vehicle (${warnCount})` : '🚗 My Vehicle'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'search' && styles.tabActive]}
          onPress={() => setTab('search')}
        >
          <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>🔍 Manufacturer Specs</Text>
        </TouchableOpacity>
      </View>

      {/* ── MY VEHICLE TAB ─────────────────────────────────────────────── */}
      {tab === 'myVehicle' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.vehicleBanner}>
            <Text style={styles.vehicleBannerTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            <Text style={styles.vehicleBannerSub}>{vehicle.fuelType} · {vehicle.mileage.toLocaleString()} km</Text>
          </View>

          {specLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
          ) : !spec ? (
            <View style={styles.noSpec}>
              <Text style={styles.noSpecTitle}>No spec data yet for this vehicle</Text>
              <Text style={styles.noSpecSub}>
                We're building the database for top Sri Lanka vehicles. Check the Manufacturer Specs
                tab to browse what's available, or check back after an app update.
              </Text>
            </View>
          ) : (
            <>
              {insights.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Vehicle vs Manufacturer Recommendations</Text>
                  {insights.map((insight, i) => (
                    <View key={i} style={[styles.insightRow, statusStyle(insight.status)]}>
                      <Text style={styles.insightIcon}>{statusIcon(insight.status)}</Text>
                      <Text style={styles.insightText}>{insight.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manufacturer Specifications</Text>
                {renderSpecCard(spec)}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── SEARCH TAB ─────────────────────────────────────────────────── */}
      {tab === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search make or model (e.g. Prius, Alto, KDH)"
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
          {searchLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {filteredSpecs.length === 0 ? (
                <Text style={styles.noResultsText}>No vehicles match "{searchQuery}"</Text>
              ) : (
                filteredSpecs.map(s => (
                  <View key={s.id} style={styles.section}>
                    {renderSpecCard(s)}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  )
}

// Small helper component to avoid repeating spec item JSX
function SpecItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={specItemStyles.item}>
      <Text style={specItemStyles.label}>{label}</Text>
      <Text style={[specItemStyles.value, highlight && specItemStyles.valueHighlight]}>{value}</Text>
    </View>
  )
}

const specItemStyles = StyleSheet.create({
  item: { width: '48%', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, margin: 2 },
  label: { fontSize: 10, color: '#888', fontWeight: '600', marginBottom: 3, textTransform: 'uppercase' },
  value: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  valueHighlight: { color: '#e65100' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 16 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a73e8' },

  content: { padding: 16, paddingBottom: 40 },

  vehicleBanner: {
    backgroundColor: '#1a73e8', borderRadius: 14, padding: 18, marginBottom: 16,
  },
  vehicleBannerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  vehicleBannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },

  insightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  insightOk: { backgroundColor: '#e8f5e9' },
  insightWarn: { backgroundColor: '#fff3e0' },
  insightInfo: { backgroundColor: '#e8f0fe' },
  insightIcon: { fontSize: 14, fontWeight: '700', marginTop: 1, width: 16, textAlign: 'center' },
  insightText: { fontSize: 13, color: '#1a1a1a', flex: 1, lineHeight: 19 },

  noSpec: {
    backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 24,
  },
  noSpecTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  noSpecSub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },

  specCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  specCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  specCardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  specCardYear: { fontSize: 12, color: '#888', fontWeight: '600' },
  specEngine: { fontSize: 12, color: '#1a73e8', fontWeight: '600', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  specSectionLabel: {
    fontSize: 11, color: '#1a73e8', fontWeight: '700', textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, letterSpacing: 0.5,
  },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 4, gap: 4 },

  noteBox: {
    marginHorizontal: 16, marginBottom: 6, backgroundColor: '#fff3e0',
    borderRadius: 8, padding: 10,
  },
  notesBox: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff8e1',
    borderRadius: 8, padding: 10,
  },
  noteText: { fontSize: 12, color: '#795548', lineHeight: 17 },

  issuesBox: {
    margin: 16, marginTop: 8, backgroundColor: '#fff3e0',
    borderRadius: 10, padding: 14,
  },
  issuesTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 10 },
  issueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  issueDot: { color: '#e65100', fontWeight: '700', marginTop: 1 },
  issueText: { fontSize: 12, color: '#5d4037', flex: 1, lineHeight: 17 },

  searchBox: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: '#1a1a1a',
  },
  noResultsText: { textAlign: 'center', color: '#aaa', fontSize: 14, marginTop: 40 },
})
