import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, ActivityIndicator,
  Alert, StyleSheet, TouchableOpacity
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  onBack: () => void
}

type Analytics = {
  totalSpend: number
  serviceCost: number
  fuelCost: number
  expenseTotal: number
  expenseBreakdown: { category: string; amount: number }[]
  avgFuelEfficiency: number | null
  costPerKm: number | null
  monthlySpend: { month: string; amount: number }[]
  recordCounts: { services: number; fuelLogs: number; expenses: number }
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00897b', '#e65100', '#1565c0']

export default function AnalyticsScreen({ token, vehicleId, onBack }: Props) {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAnalytics(token, vehicleId)
      .then(setData)
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    )
  }

  if (!data) return null

  const fmt = (n: number) => 'LKR ' + Math.round(n).toLocaleString()
  const maxBreakdown = Math.max(...data.expenseBreakdown.map(e => e.amount), 1)
  const maxMonthly = Math.max(...data.monthlySpend.map(m => m.amount), 1)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Analytics</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Vehicle Spend</Text>
        <Text style={styles.totalAmount}>{fmt(data.totalSpend)}</Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}><Text style={styles.pillText}>🔧 {fmt(data.serviceCost)}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>⛽ {fmt(data.fuelCost)}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>📋 {fmt(data.expenseTotal)}</Text></View>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cost / km</Text>
          <Text style={styles.statValue}>
            {data.costPerKm != null ? 'LKR ' + data.costPerKm.toFixed(1) : '—'}
          </Text>
          <Text style={styles.statSub}>per kilometre driven</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Fuel Economy</Text>
          <Text style={styles.statValue}>
            {data.avgFuelEfficiency != null ? data.avgFuelEfficiency.toFixed(1) + ' km/L' : '—'}
          </Text>
          <Text style={styles.statSub}>average efficiency</Text>
        </View>
      </View>

      {data.expenseBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          {data.expenseBreakdown.map((item, i) => (
            <View key={i} style={styles.catRow}>
              <Text style={styles.catLabel} numberOfLines={1}>{item.category}</Text>
              <View style={styles.barTrack}>
                <View style={[
                  styles.barFill,
                  {
                    width: (Math.round((item.amount / maxBreakdown) * 100) + '%') as any,
                    backgroundColor: COLORS[i % COLORS.length],
                  }
                ]} />
              </View>
              <Text style={styles.catAmount}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Spend — Last 6 Months</Text>
        <View style={styles.monthlyChart}>
          {data.monthlySpend.map((m, i) => {
            const barH = maxMonthly > 0 ? Math.round((m.amount / maxMonthly) * 80) : 0
            return (
              <View key={i} style={styles.monthCol}>
                {m.amount > 0 && (
                  <Text style={styles.monthAmt}>{Math.round(m.amount / 1000)}k</Text>
                )}
                <View style={styles.monthBg}>
                  <View style={[styles.monthFill, { height: Math.max(barH, m.amount > 0 ? 4 : 0) }]} />
                </View>
                <Text style={styles.monthLbl}>{m.month}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.countRow}>
        <View style={styles.countCard}>
          <Text style={styles.countNum}>{data.recordCounts.services}</Text>
          <Text style={styles.countLbl}>Services</Text>
        </View>
        <View style={styles.countCard}>
          <Text style={styles.countNum}>{data.recordCounts.fuelLogs}</Text>
          <Text style={styles.countLbl}>Fuel Logs</Text>
        </View>
        <View style={styles.countCard}>
          <Text style={styles.countNum}>{data.recordCounts.expenses}</Text>
          <Text style={styles.countLbl}>Expenses</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topRow: { marginTop: 48, marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  totalCard: { backgroundColor: '#1a73e8', borderRadius: 16, padding: 20, marginBottom: 16 },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 6 },
  totalAmount: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 14 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  statSub: { fontSize: 11, color: '#aaa' },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },
  catRow: { marginBottom: 12 },
  catLabel: { fontSize: 12, color: '#555', fontWeight: '600', marginBottom: 5 },
  barTrack: { height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, marginBottom: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  catAmount: { fontSize: 11, color: '#888' },
  monthlyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 },
  monthCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  monthAmt: { fontSize: 9, color: '#888', marginBottom: 3 },
  monthBg: {
    width: '80%', height: 80, backgroundColor: '#f0f0f0',
    borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden',
  },
  monthFill: { backgroundColor: '#1a73e8', borderRadius: 4, width: '100%' },
  monthLbl: { fontSize: 9, color: '#888', marginTop: 5, textAlign: 'center' },
  countRow: { flexDirection: 'row', gap: 12 },
  countCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  countNum: { fontSize: 28, fontWeight: '800', color: '#1a73e8', marginBottom: 4 },
  countLbl: { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center' },
})
