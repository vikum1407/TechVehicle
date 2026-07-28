import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import { VEHICLE_TYPE_OPTIONS } from '../constants/serviceData'

type Props = {
  token: string
  focusVehicleId?: string | null
  onBack: () => void
}

type Customer = {
  vehicleId: string; registrationNo: string; make: string; model: string; year: number
  vehicleType: string | null
  jobCount: number; totalRevenue: number; lastServiceDate: string | null
}

type LedgerItem = {
  id: string; description: string; categories: string[]; cost: number | null
  mileage: number | null; notes: string | null; photos: string[]; createdAt: string
}

export default function GarageLedgerScreen({ token, focusVehicleId, onBack }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyCache, setHistoryCache] = useState<Record<string, LedgerItem[]>>({})
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const rowLayouts = useRef<Record<string, number>>({})
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    api.getGarageCustomers(token)
      .then(setCustomers)
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  const loadHistory = async (vehicleId: string) => {
    if (historyCache[vehicleId]) return
    setHistoryLoadingId(vehicleId)
    try {
      const data = await api.getCustomerLedgerHistory(token, vehicleId)
      setHistoryCache(prev => ({ ...prev, [vehicleId]: data }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setHistoryLoadingId(null)
    }
  }

  const toggleExpand = (vehicleId: string) => {
    const next = expandedId === vehicleId ? null : vehicleId
    setExpandedId(next)
    if (next) loadHistory(next)
  }

  // Deep-link from the Customers tab's "View Full History" link
  useEffect(() => {
    if (!focusVehicleId || loading) return
    setExpandedId(focusVehicleId)
    loadHistory(focusVehicleId)
    setTimeout(() => {
      const y = rowLayouts.current[focusVehicleId]
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true })
    }, 300)
  }, [focusVehicleId, loading])

  const q = search.trim().toLowerCase()
  const filtered = customers.filter(c => {
    if (typeFilter && c.vehicleType !== typeFilter) return false
    if (q && !c.registrationNo.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <View style={styles.container}>
      <ScreenHeader title="Customer Ledger" subtitle="Your full service record book" onBack={onBack} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <FormField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search by registration number"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !typeFilter && styles.filterChipActive]}
            onPress={() => setTypeFilter(null)}
          >
            <Text style={[styles.filterChipText, !typeFilter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {VEHICLE_TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, typeFilter === opt.value && styles.filterChipActive]}
              onPress={() => setTypeFilter(typeFilter === opt.value ? null : opt.value)}
            >
              <Text style={[styles.filterChipText, typeFilter === opt.value && styles.filterChipTextActive]}>
                {opt.icon} {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📒</Text>
            <Text style={styles.emptyText}>No customers found</Text>
            <Text style={styles.emptySub}>
              {customers.length === 0
                ? "Vehicles you've serviced through bookings or shares will appear here"
                : 'Try a different search or filter'}
            </Text>
          </View>
        ) : (
          filtered.map(cust => {
            const isExpanded = expandedId === cust.vehicleId
            const items = historyCache[cust.vehicleId]
            const typeOpt = VEHICLE_TYPE_OPTIONS.find(o => o.value === cust.vehicleType)

            return (
              <View
                key={cust.vehicleId}
                onLayout={e => { rowLayouts.current[cust.vehicleId] = e.nativeEvent.layout.y }}
                style={styles.custCard}
              >
                <TouchableOpacity onPress={() => toggleExpand(cust.vehicleId)} activeOpacity={0.7}>
                  <View style={styles.custTop}>
                    <Text style={styles.custReg}>{cust.registrationNo}</Text>
                    {typeOpt && <Text style={styles.custTypeIcon}>{typeOpt.icon}</Text>}
                  </View>
                  <Text style={styles.custVehicle}>{cust.year} {cust.make} {cust.model}</Text>
                  <View style={styles.custStatsRow}>
                    <Text style={styles.custStat}>{cust.jobCount} job{cust.jobCount !== 1 ? 's' : ''}</Text>
                    <Text style={styles.custStat}>LKR {cust.totalRevenue.toLocaleString()}</Text>
                    {cust.lastServiceDate && (
                      <Text style={styles.custStat}>
                        Last: {new Date(cust.lastServiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.expandHint}>{isExpanded ? '▲ Hide history' : '▼ View full history'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  historyLoadingId === cust.vehicleId ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
                  ) : items && items.length === 0 ? (
                    <Text style={styles.emptySub}>No completed jobs recorded yet.</Text>
                  ) : items ? (
                    <View style={styles.historyList}>
                      {items.map(item => (
                        <View key={item.id} style={styles.historyItem}>
                          <View style={styles.historyItemTop}>
                            <Text style={styles.historyDate}>
                              {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                            {item.cost != null && <Text style={styles.historyCost}>LKR {item.cost.toLocaleString()}</Text>}
                          </View>
                          <Text style={styles.historyDesc}>{item.description}</Text>
                          {item.mileage != null && (
                            <Text style={styles.historyMeta}>{item.mileage.toLocaleString()} km</Text>
                          )}
                          {item.notes && <Text style={styles.historyNotes}>{item.notes}</Text>}
                        </View>
                      ))}
                    </View>
                  ) : null
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 48 },
    filterScroll: { marginBottom: 16, flexGrow: 0 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText: { fontSize: 13, color: c.textSub, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },
    custCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    custTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    custReg: { fontSize: 16, fontWeight: '800', color: c.text },
    custTypeIcon: { fontSize: 18 },
    custVehicle: { fontSize: 13, color: c.textSub, marginTop: 2 },
    custStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    custStat: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    expandHint: { fontSize: 12, color: c.primary, fontWeight: '600', marginTop: 10 },
    historyList: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    historyItem: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8,
    },
    historyItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    historyDate: { fontSize: 12, color: c.textFaint },
    historyCost: { fontSize: 13, fontWeight: '700', color: '#34a853' },
    historyDesc: { fontSize: 14, color: c.textBody, lineHeight: 19 },
    historyMeta: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    historyNotes: { fontSize: 12, color: c.textSub, marginTop: 4, fontStyle: 'italic' },
    empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 15, fontWeight: '700', color: c.textSub, marginBottom: 4 },
    emptySub: { fontSize: 13, color: c.textFaint, textAlign: 'center' },
  })
}
