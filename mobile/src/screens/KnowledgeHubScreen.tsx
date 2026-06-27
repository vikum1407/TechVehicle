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
  oilGrade: string
  oilType: string
  oilCapacityL?: number
  oilChangeKm: number
  tyreSizeFront: string
  tyreSizeRear?: string
  timingType: 'belt' | 'chain' | 'gear-driven'
  timingBeltKm?: number
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

type Tab = 'myVehicle' | 'search'

export default function KnowledgeHubScreen({ token, vehicle, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('myVehicle')
  const [spec, setSpec] = useState<VehicleSpec | null>(null)
  const [specLoading, setSpecLoading] = useState(true)
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [allSpecs, setAllSpecs] = useState<VehicleSpec[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    loadMyVehicleSpec()
  }, [])

  useEffect(() => {
    if (tab === 'search' && allSpecs.length === 0) loadAllSpecs()
  }, [tab])

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

  // ── Personalised insights from records vs spec ─────────────────────────────

  const getLastOilChange = () => records.find(r => r.description.toLowerCase().includes('oil change'))
  const getLastTyreChange = () => records.find(r => r.description.toLowerCase().includes('tyre change'))
  const getLastTimingBelt = () => records.find(r =>
    r.description.toLowerCase().includes('timing belt') ||
    r.description.toLowerCase().includes('cam belt')
  )

  const oilInsight = (): { status: 'ok' | 'warn' | 'info'; text: string } | null => {
    if (!spec) return null
    const last = getLastOilChange()
    if (!last) return { status: 'info', text: `No oil change logged. ${spec.oilGrade} ${spec.oilType} recommended.` }
    const sd = last.structuredData as any
    const loggedBrand = sd?.oilBrand
    if (loggedBrand) {
      return { status: 'ok', text: `Last oil change used ${loggedBrand}. Manufacturer recommends ${spec.oilGrade} ${spec.oilType}.` }
    }
    return { status: 'info', text: `Manufacturer recommends ${spec.oilGrade} ${spec.oilType}${spec.oilCapacityL ? ` (${spec.oilCapacityL}L capacity)` : ''}.` }
  }

  const tyreInsight = (): { status: 'ok' | 'warn' | 'info'; text: string } | null => {
    if (!spec) return null
    const last = getLastTyreChange()
    if (!last) return { status: 'info', text: `OEM tyre size: ${spec.tyreSizeFront}${spec.tyreSizeRear ? ` front / ${spec.tyreSizeRear} rear` : ''}.` }
    const sd = last.structuredData as any
    const loggedSize = sd?.tyreSize
    if (loggedSize) {
      const matches = loggedSize.trim() === spec.tyreSizeFront.trim()
      return {
        status: matches ? 'ok' : 'warn',
        text: matches
          ? `Tyre size ${loggedSize} matches OEM spec ✓`
          : `Your logged tyre size ${loggedSize} differs from OEM spec ${spec.tyreSizeFront}. Verify this is correct.`,
      }
    }
    return { status: 'info', text: `OEM tyre size: ${spec.tyreSizeFront}${spec.tyreSizeRear ? ` front / ${spec.tyreSizeRear} rear` : ''}.` }
  }

  const timingInsight = (): { status: 'ok' | 'warn' | 'info'; text: string } | null => {
    if (!spec) return null
    if (spec.timingType === 'chain') {
      return { status: 'ok', text: 'Chain-driven engine — no timing belt replacement needed ✓' }
    }
    if (spec.timingType === 'gear-driven') {
      return { status: 'ok', text: 'Gear-driven engine — no timing belt or chain service needed ✓' }
    }
    // Belt engine
    const last = getLastTimingBelt()
    if (!last) {
      return {
        status: 'warn',
        text: `Timing belt engine — no replacement logged. Replace every ${spec.timingBeltKm?.toLocaleString() ?? '?'} km. This is critical — failure destroys the engine.`,
      }
    }
    const lastKm = last.mileage ?? 0
    const dueAt = lastKm + (spec.timingBeltKm ?? 60000)
    const remaining = dueAt - vehicle.mileage
    if (remaining < 0) {
      return { status: 'warn', text: `Timing belt OVERDUE by ${Math.abs(remaining).toLocaleString()} km — replace immediately.` }
    }
    if (remaining <= 10000) {
      return { status: 'warn', text: `Timing belt due in ${remaining.toLocaleString()} km — schedule soon.` }
    }
    return { status: 'ok', text: `Timing belt due in ${remaining.toLocaleString()} km ✓` }
  }

  // ── Search filter ──────────────────────────────────────────────────────────
  const filteredSpecs = allSpecs.filter(s => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return s.make.toLowerCase().includes(q) || s.model.toLowerCase().includes(q)
  })

  // ── Render helpers ─────────────────────────────────────────────────────────

  const insightStatusStyle = (status: 'ok' | 'warn' | 'info') => {
    if (status === 'ok') return styles.insightOk
    if (status === 'warn') return styles.insightWarn
    return styles.insightInfo
  }

  const insightIcon = (status: 'ok' | 'warn' | 'info') => {
    if (status === 'ok') return '✓'
    if (status === 'warn') return '⚠'
    return 'ℹ'
  }

  const renderSpecCard = (s: VehicleSpec, showIssues = true) => (
    <View style={styles.specCard}>
      <View style={styles.specCardHeader}>
        <Text style={styles.specCardTitle}>{s.make} {s.model}</Text>
        <Text style={styles.specCardYear}>{s.yearFrom}–{s.yearTo ?? 'present'}</Text>
      </View>
      {s.engine && <Text style={styles.specEngine}>{s.engine} · {s.fuelType}</Text>}

      <View style={styles.specGrid}>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Oil Grade</Text>
          <Text style={styles.specValue}>{s.oilGrade}</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Oil Type</Text>
          <Text style={styles.specValue}>{s.oilType}</Text>
        </View>
        {s.oilCapacityL && (
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Oil Capacity</Text>
            <Text style={styles.specValue}>{s.oilCapacityL}L</Text>
          </View>
        )}
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Oil Change</Text>
          <Text style={styles.specValue}>Every {s.oilChangeKm.toLocaleString()} km</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Tyre Size</Text>
          <Text style={styles.specValue}>{s.tyreSizeFront}{s.tyreSizeRear ? ` / ${s.tyreSizeRear}` : ''}</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Timing</Text>
          <Text style={[styles.specValue, s.timingType === 'belt' && styles.specValueBelt]}>
            {s.timingType === 'belt'
              ? `Belt — ${s.timingBeltKm?.toLocaleString()} km`
              : s.timingType === 'chain' ? 'Chain ✓' : 'Gear-driven ✓'}
          </Text>
        </View>
        {s.fuelEconomyKmL && (
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Fuel Economy</Text>
            <Text style={styles.specValue}>~{s.fuelEconomyKmL} km/L</Text>
          </View>
        )}
      </View>

      {s.notes && (
        <View style={styles.noteBox}>
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

  const insights = spec ? [oilInsight(), tyreInsight(), timingInsight()].filter(Boolean) : []

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knowledge Hub</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'myVehicle' && styles.tabActive]}
          onPress={() => setTab('myVehicle')}
        >
          <Text style={[styles.tabText, tab === 'myVehicle' && styles.tabTextActive]}>🚗 My Vehicle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'search' && styles.tabActive]}
          onPress={() => setTab('search')}
        >
          <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>🔍 Search</Text>
        </TouchableOpacity>
      </View>

      {/* ── MY VEHICLE TAB ────────────────────────────────────────────── */}
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
                We're building the database for top Sri Lanka vehicles. Check the Search tab
                to browse what's available, or check back after an app update.
              </Text>
            </View>
          ) : (
            <>
              {/* Personalised insights */}
              {insights.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Vehicle Insights</Text>
                  {insights.map((insight, i) => insight && (
                    <View key={i} style={[styles.insightRow, insightStatusStyle(insight.status)]}>
                      <Text style={styles.insightIcon}>{insightIcon(insight.status)}</Text>
                      <Text style={styles.insightText}>{insight.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Full spec card */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manufacturer Specifications</Text>
                {renderSpecCard(spec)}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── SEARCH TAB ────────────────────────────────────────────────── */}
      {tab === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search make or model (e.g. Prius, Alto)"
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
  tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a73e8' },

  content: { padding: 16, paddingBottom: 40 },

  vehicleBanner: {
    backgroundColor: '#1a73e8', borderRadius: 14, padding: 18, marginBottom: 16,
  },
  vehicleBannerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  vehicleBannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },

  // Insights
  insightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  insightOk: { backgroundColor: '#e8f5e9' },
  insightWarn: { backgroundColor: '#fff3e0' },
  insightInfo: { backgroundColor: '#e8f0fe' },
  insightIcon: { fontSize: 14, fontWeight: '700', marginTop: 1, width: 16, textAlign: 'center' },
  insightText: { fontSize: 13, color: '#1a1a1a', flex: 1, lineHeight: 19 },

  // No spec
  noSpec: {
    backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 24,
  },
  noSpecTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  noSpecSub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },

  // Spec card
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
  specEngine: { fontSize: 12, color: '#1a73e8', fontWeight: '600', paddingHorizontal: 16, paddingTop: 10 },
  specGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 4,
  },
  specItem: {
    width: '48%', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, margin: 2,
  },
  specLabel: { fontSize: 10, color: '#888', fontWeight: '600', marginBottom: 3, textTransform: 'uppercase' },
  specValue: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  specValueBelt: { color: '#e65100' },

  noteBox: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff8e1',
    borderRadius: 8, padding: 10,
  },
  noteText: { fontSize: 12, color: '#795548', lineHeight: 17 },

  issuesBox: {
    margin: 16, marginTop: 4, backgroundColor: '#fff3e0',
    borderRadius: 10, padding: 14,
  },
  issuesTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 10 },
  issueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  issueDot: { color: '#e65100', fontWeight: '700', marginTop: 1 },
  issueText: { fontSize: 12, color: '#5d4037', flex: 1, lineHeight: 17 },

  // Search tab
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
