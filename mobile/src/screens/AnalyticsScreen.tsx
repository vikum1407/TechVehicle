import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, ActivityIndicator,
  Alert, StyleSheet, TouchableOpacity
} from 'react-native'
import Svg, {
  Path, Circle, Line as SvgLine,
  Text as SvgText, Defs, LinearGradient, Stop, Rect
} from 'react-native-svg'
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
  mileageTrend: { mileage: number; label: string }[]
  fuelEfficiencyTrend: { kmPerL: number; label: string }[]
  fuelCostTrend: { cost: number; label: string }[]
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00897b', '#e65100', '#1565c0']

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildLinePath(pts: { x: number; y: number }[]): string {
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    d += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  return d
}

function labelStep(count: number) {
  return Math.max(1, Math.ceil(count / 4))
}

// ── Mileage line chart ────────────────────────────────────────────────────────

function MileageChart({ data }: { data: { mileage: number; label: string }[] }) {
  if (data.length < 2) {
    return <Text style={cs.noData}>Log more fuel fill-ups to see mileage growth</Text>
  }

  const W = 320, H = 150
  const pL = 44, pR = 10, pT = 14, pB = 28
  const plotW = W - pL - pR, plotH = H - pT - pB

  const vals = data.map(d => d.mileage)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const px = (i: number) => pL + (i / (data.length - 1)) * plotW
  const py = (v: number) => pT + plotH - ((v - minV) / range) * plotH
  const pts = data.map((d, i) => ({ x: px(i), y: py(d.mileage) }))

  const linePath = buildLinePath(pts)
  const fillPath = linePath + ` L ${pts[pts.length - 1].x} ${pT + plotH} L ${pts[0].x} ${pT + plotH} Z`

  const step = labelStep(data.length)
  const show = (i: number) => i === 0 || i % step === 0 || i === data.length - 1
  const fmtKm = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
  const color = '#1a73e8'

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="gMileage" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <SvgLine x1={pL} y1={pT} x2={W - pR} y2={pT} stroke="#f0f0f0" strokeWidth="1" />
      <SvgLine x1={pL} y1={pT + plotH} x2={W - pR} y2={pT + plotH} stroke="#f0f0f0" strokeWidth="1" />
      <Path d={fillPath} fill="url(#gMileage)" />
      <Path d={linePath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {data.map((d, i) => show(i) ? (
        <SvgText key={i} x={pts[i].x} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText>
      ) : null)}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{fmtKm(maxV)}</SvgText>
      <SvgText x={pL - 4} y={pT + plotH} textAnchor="end" fontSize="9" fill="#bbb">{fmtKm(minV)}</SvgText>
    </Svg>
  )
}

// ── Fuel efficiency line chart ────────────────────────────────────────────────

function EfficiencyChart({ data }: { data: { kmPerL: number; label: string }[] }) {
  if (data.length < 2) {
    return <Text style={cs.noData}>Log at least 3 fill-ups with litres to see efficiency trend</Text>
  }

  const W = 320, H = 140
  const pL = 34, pR = 10, pT = 14, pB = 28
  const plotW = W - pL - pR, plotH = H - pT - pB

  const vals = data.map(d => d.kmPerL)
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals)
  const pad = (rawMax - rawMin) * 0.15 || 1
  const minV = Math.max(0, rawMin - pad), maxV = rawMax + pad
  const range = maxV - minV

  const px = (i: number) => pL + (i / (data.length - 1)) * plotW
  const py = (v: number) => pT + plotH - ((v - minV) / range) * plotH
  const pts = data.map((d, i) => ({ x: px(i), y: py(d.kmPerL) }))

  const linePath = buildLinePath(pts)
  const fillPath = linePath + ` L ${pts[pts.length - 1].x} ${pT + plotH} L ${pts[0].x} ${pT + plotH} Z`

  const step = labelStep(data.length)
  const show = (i: number) => i === 0 || i % step === 0 || i === data.length - 1
  const color = '#34a853'

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="gEff" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <SvgLine x1={pL} y1={pT} x2={W - pR} y2={pT} stroke="#f0f0f0" strokeWidth="1" />
      <SvgLine x1={pL} y1={pT + plotH} x2={W - pR} y2={pT + plotH} stroke="#f0f0f0" strokeWidth="1" />
      <Path d={fillPath} fill="url(#gEff)" />
      <Path d={linePath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {data.map((d, i) => show(i) ? (
        <SvgText key={i} x={pts[i].x} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText>
      ) : null)}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{rawMax.toFixed(1)}</SvgText>
      <SvgText x={pL - 4} y={pT + plotH} textAnchor="end" fontSize="9" fill="#bbb">{rawMin.toFixed(1)}</SvgText>
    </Svg>
  )
}

// ── Fuel cost bar chart ───────────────────────────────────────────────────────

function FuelCostChart({ data }: { data: { cost: number; label: string }[] }) {
  if (data.length === 0) {
    return <Text style={cs.noData}>Log fill-ups with cost to see spending per fill-up</Text>
  }

  const W = 320, H = 120
  const pL = 40, pR = 10, pT = 10, pB = 28
  const plotW = W - pL - pR, plotH = H - pT - pB

  const maxV = Math.max(...data.map(d => d.cost))
  const gap = plotW / data.length
  const barW = Math.min(28, Math.max(12, gap * 0.55))
  const bx = (i: number) => pL + i * gap + gap / 2
  const bh = (v: number) => Math.max(4, (v / maxV) * plotH)

  const step = labelStep(data.length)
  const show = (i: number) => i === 0 || i % step === 0 || i === data.length - 1
  const color = '#1a73e8'
  const fmtTop = maxV >= 1000 ? `${(maxV / 1000).toFixed(0)}k` : `${Math.round(maxV)}`

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <SvgLine x1={pL} y1={pT + plotH} x2={W - pR} y2={pT + plotH} stroke="#f0f0f0" strokeWidth="1" />
      {data.map((d, i) => {
        const bHeight = bh(d.cost)
        const bY = pT + plotH - bHeight
        return (
          <React.Fragment key={i}>
            <Rect x={bx(i) - barW / 2} y={bY} width={barW} height={bHeight} rx={4} fill={color} opacity={0.75} />
            {show(i) && (
              <SvgText x={bx(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText>
            )}
          </React.Fragment>
        )
      })}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{fmtTop}</SvgText>
    </Svg>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

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

      {/* Total spend */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Vehicle Spend</Text>
        <Text style={styles.totalAmount}>{fmt(data.totalSpend)}</Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}><Text style={styles.pillText}>🔧 {fmt(data.serviceCost)}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>⛽ {fmt(data.fuelCost)}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>📋 {fmt(data.expenseTotal)}</Text></View>
        </View>
      </View>

      {/* Key stats */}
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

      {/* Mileage growth chart */}
      {(data.mileageTrend?.length ?? 0) > 0 && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Mileage Growth</Text>
              <Text style={styles.chartSub}>Odometer over time (km)</Text>
            </View>
            <View style={[styles.chartDot, { backgroundColor: '#1a73e8' }]} />
          </View>
          <MileageChart data={data.mileageTrend} />
        </View>
      )}

      {/* Fuel efficiency trend */}
      {((data.fuelEfficiencyTrend?.length ?? 0) > 0 || (data.fuelCostTrend?.length ?? 0) > 0) && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Fuel Efficiency</Text>
              <Text style={styles.chartSub}>km per litre — per fill-up</Text>
            </View>
            <View style={[styles.chartDot, { backgroundColor: '#34a853' }]} />
          </View>
          <EfficiencyChart data={data.fuelEfficiencyTrend ?? []} />
        </View>
      )}

      {/* Cost per fill-up */}
      {(data.fuelCostTrend?.length ?? 0) > 0 && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Cost per Fill-up</Text>
              <Text style={styles.chartSub}>LKR spent each time you refuelled</Text>
            </View>
            <View style={[styles.chartDot, { backgroundColor: '#1a73e8' }]} />
          </View>
          <FuelCostChart data={data.fuelCostTrend} />
        </View>
      )}

      {/* Spending by category */}
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

      {/* Monthly spend */}
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

      {/* Record counts */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  noData: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
})

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

  chartCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chartSub: { fontSize: 11, color: '#aaa' },
  chartDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

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
