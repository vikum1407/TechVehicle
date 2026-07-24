import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

type ForecastItem = {
  name: string
  status: string
  remainingKm: number | null
  remainingDays: number | null
  estimatedCost: number | null
  basedOn: number
}

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  onBack: () => void
  onAddService?: () => void
}

function statusColor(status: string): string {
  if (status === 'overdue')   return '#c62828'
  if (status === 'due_soon')  return '#e65100'
  if (status === 'upcoming')  return '#1d3a5f'
  return '#888'
}

function statusBg(status: string): string {
  if (status === 'overdue')   return '#ffebee'
  if (status === 'due_soon')  return '#fff3e0'
  if (status === 'upcoming')  return '#e7edf3'
  return '#f5f5f5'
}

function statusLabel(status: string): string {
  if (status === 'overdue')   return '🚨 Overdue'
  if (status === 'due_soon')  return '⚠️ Due Soon'
  if (status === 'upcoming')  return '📅 Upcoming'
  return status
}

function remainingText(item: ForecastItem): string {
  const parts: string[] = []
  if (item.remainingKm != null) {
    const km = Math.abs(item.remainingKm)
    parts.push(item.remainingKm < 0 ? `${km.toLocaleString()} km overdue` : `${km.toLocaleString()} km remaining`)
  }
  if (item.remainingDays != null) {
    const d = Math.abs(item.remainingDays)
    parts.push(item.remainingDays < 0 ? `${d} day${d !== 1 ? 's' : ''} overdue` : `${d} day${d !== 1 ? 's' : ''} remaining`)
  }
  return parts.join('  ·  ')
}

export default function CostForecastScreen({ token, vehicleId, vehicleName, onBack, onAddService }: Props) {
  const [items, setItems] = useState<ForecastItem[]>([])
  const [total, setTotal] = useState(0)
  const [periodDays, setPeriodDays] = useState(365)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const data = await api.getCostForecast(token, vehicleId)
      setItems(data.items)
      setTotal(data.totalEstimated)
      setPeriodDays(data.periodDays)
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const itemsWithCost = items.filter(i => i.estimatedCost != null)
  const itemsNoCost   = items.filter(i => i.estimatedCost == null)

  return (
    <View style={styles.container}>
      <ScreenHeader title="Cost Forecast" subtitle={vehicleName} onBack={onBack} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} size="large" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          {/* Total card */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Estimated next {Math.round(periodDays / 30)} months</Text>
            <Text style={styles.totalAmount}>
              {total > 0 ? `LKR ${total.toLocaleString()}` : 'Not enough data yet'}
            </Text>
            <Text style={styles.totalNote}>
              Based on your service history and manufacturer recommendations.
              Costs are estimates — actual amounts vary by garage and parts brand.
            </Text>
          </View>

          {items.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No forecast available yet</Text>
              <Text style={styles.emptyNote}>
                We need at least one past record of each service type (e.g. an oil change) to know when the next one is due. Log your service history to unlock predictions — the forecast improves as your records grow.
              </Text>
            </View>
          )}

          {itemsWithCost.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Upcoming Services with Cost Estimates</Text>
              {itemsWithCost.map((item, i) => (
                <View key={i} style={[styles.itemCard, { backgroundColor: statusBg(item.status), borderLeftColor: statusColor(item.status) }]}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemName, { color: statusColor(item.status) }]}>{item.name}</Text>
                    <Text style={[styles.itemStatus, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                  </View>
                  {remainingText(item) ? (
                    <Text style={styles.itemRemaining}>{remainingText(item)}</Text>
                  ) : null}
                  <View style={styles.itemBottom}>
                    <Text style={styles.itemCostLabel}>Estimated cost</Text>
                    <Text style={[styles.itemCost, { color: statusColor(item.status) }]}>
                      LKR {item.estimatedCost!.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.itemBased}>Based on your last {item.basedOn} record{item.basedOn !== 1 ? 's' : ''}</Text>
                </View>
              ))}
            </>
          )}

          {itemsNoCost.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Other Due Services (no cost data yet)</Text>
              {itemsNoCost.map((item, i) => (
                <View key={i} style={[styles.itemCard, styles.itemCardMuted, { borderLeftColor: statusColor(item.status) }]}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemNameMuted}>{item.name}</Text>
                    <Text style={[styles.itemStatus, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                  </View>
                  {remainingText(item) ? (
                    <Text style={styles.itemRemaining}>{remainingText(item)}</Text>
                  ) : null}
                  <View style={styles.itemNoCostRow}>
                    <Text style={styles.itemBased}>Log a service cost to improve forecast accuracy.</Text>
                    {onAddService && (
                      <TouchableOpacity onPress={onAddService} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.itemLogLink}>+ Log Service</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={styles.footer}>
            💡 Log service costs consistently to improve forecast accuracy over time.
          </Text>
        </ScrollView>
      )}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 16, paddingBottom: 48 },
    totalCard: {
      backgroundColor: c.primary, borderRadius: 16, padding: 20, marginBottom: 20,
    },
    totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
    totalAmount: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10 },
    totalNote: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
    emptyCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 24,
      alignItems: 'center', borderWidth: 1, borderColor: c.border,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 8 },
    emptyNote: { fontSize: 13, color: c.textSub, textAlign: 'center', lineHeight: 20 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 8, marginBottom: 12 },
    itemCard: {
      borderRadius: 12, padding: 14, marginBottom: 10,
      borderLeftWidth: 4, elevation: 1,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
    },
    itemCardMuted: { backgroundColor: c.surface },
    itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemName: { fontSize: 15, fontWeight: '700', flex: 1 },
    itemNameMuted: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    itemStatus: { fontSize: 12, fontWeight: '700' },
    itemRemaining: { fontSize: 12, color: '#555', marginBottom: 8 },
    itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
    itemCostLabel: { fontSize: 12, color: '#666' },
    itemCost: { fontSize: 17, fontWeight: '800' },
    itemBased: { fontSize: 11, color: '#888', marginTop: 4, flex: 1 },
    itemNoCostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 },
    itemLogLink: { fontSize: 12, color: c.primary, fontWeight: '700' },
    footer: { textAlign: 'center', fontSize: 12, color: c.textFaint, marginTop: 16, lineHeight: 18 },
  })
}
