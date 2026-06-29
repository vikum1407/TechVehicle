import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, ScrollView, ActivityIndicator,
  Alert, StyleSheet, TouchableOpacity
} from 'react-native'
import Svg, {
  Path, Circle, Line as SvgLine,
  Text as SvgText, Defs, LinearGradient, Stop, Rect
} from 'react-native-svg'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  token: string
  vehicleId: string
  onBack: () => void
  onKnowledgeHub?: () => void
}

type OilHistoryItem = {
  date: string; km: number | null
  brand: string | null; grade: string | null; oilType: string | null; intervalKm: number | null
}
type TyreHistoryItem = {
  date: string; km: number | null
  size: string | null; brand: string | null; tyresChanged: string | null; kmThisSet: number | null
}
type EmissionHistoryItem = {
  date: string; km: number | null
  co: number | null; hc: number | null; co2: number | null; lambda: number | null
  result: string | null; station: string | null
}
type AcHistoryItem = {
  date: string; km: number | null
  refrigerantType: string | null; quantityGrams: number | null
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
  oilAnalytics: { history: OilHistoryItem[] } | null
  tyreAnalytics: { history: TyreHistoryItem[]; currentSize: string | null } | null
  emissionAnalytics: { history: EmissionHistoryItem[]; warning: string | null } | null
  acAnalytics: { history: AcHistoryItem[]; refillCount12m: number; warning: string | null } | null
}

type ForecastItem = {
  name: string
  status: string
  remainingKm: number | null
  remainingDays: number | null
  estimatedCost: number | null
  basedOn: number
}

type Forecast = {
  items: ForecastItem[]
  totalEstimated: number
  periodDays: number
}

type Anomaly = {
  id: string
  title: string
  description: string
  severity: 'warning' | 'info'
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00897b', '#e65100', '#1565c0']

// ── Shared helpers ─────────────────────────────────────────────────────────────

function buildLinePath(pts: { x: number; y: number }[]): string {
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    d += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  return d
}

function labelStep(count: number) { return Math.max(1, Math.ceil(count / 4)) }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Mileage line chart ─────────────────────────────────────────────────────────

function MileageChart({ data }: { data: { mileage: number; label: string }[] }) {
  if (data.length < 2) return <Text style={cs.noData}>Log more fuel fill-ups to see mileage growth</Text>
  const W = 320, H = 150, pL = 44, pR = 10, pT = 14, pB = 28
  const plotW = W - pL - pR, plotH = H - pT - pB
  const vals = data.map(d => d.mileage)
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1
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
      {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />)}
      {data.map((d, i) => show(i) ? <SvgText key={i} x={pts[i].x} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText> : null)}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{fmtKm(maxV)}</SvgText>
      <SvgText x={pL - 4} y={pT + plotH} textAnchor="end" fontSize="9" fill="#bbb">{fmtKm(minV)}</SvgText>
    </Svg>
  )
}

// ── Fuel efficiency line chart ─────────────────────────────────────────────────

function EfficiencyChart({ data }: { data: { kmPerL: number; label: string }[] }) {
  if (data.length < 2) return <Text style={cs.noData}>Log at least 3 fill-ups with litres to see efficiency trend</Text>
  const W = 320, H = 140, pL = 34, pR = 10, pT = 14, pB = 28
  const plotW = W - pL - pR, plotH = H - pT - pB
  const vals = data.map(d => d.kmPerL)
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals)
  const pad = (rawMax - rawMin) * 0.15 || 1
  const minV = Math.max(0, rawMin - pad), maxV = rawMax + pad, range = maxV - minV
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
      {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />)}
      {data.map((d, i) => show(i) ? <SvgText key={i} x={pts[i].x} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText> : null)}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{rawMax.toFixed(1)}</SvgText>
      <SvgText x={pL - 4} y={pT + plotH} textAnchor="end" fontSize="9" fill="#bbb">{rawMin.toFixed(1)}</SvgText>
    </Svg>
  )
}

// ── Fuel cost bar chart ────────────────────────────────────────────────────────

function FuelCostChart({ data }: { data: { cost: number; label: string }[] }) {
  if (data.length === 0) return <Text style={cs.noData}>Log fill-ups with cost to see spending per fill-up</Text>
  const W = 320, H = 120, pL = 40, pR = 10, pT = 10, pB = 28
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
            {show(i) && <SvgText x={bx(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.label}</SvgText>}
          </React.Fragment>
        )
      })}
      <SvgText x={pL - 4} y={pT + 5} textAnchor="end" fontSize="9" fill="#bbb">{fmtTop}</SvgText>
    </Svg>
  )
}

// ── Structured analytics cards ─────────────────────────────────────────────────

function OilCard({ data }: { data: NonNullable<Analytics['oilAnalytics']> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Oil Change History</Text>
        <Text style={styles.sectionBadge}>{data.history.length} records</Text>
      </View>
      {data.history.map((item, i) => (
        <View key={i} style={[styles.tableRow, i === 0 && styles.tableRowFirst]}>
          <View style={styles.tableCol1}>
            <Text style={styles.tableDate}>{fmtDate(item.date)}</Text>
            {item.km && <Text style={styles.tableKm}>{item.km.toLocaleString()} km</Text>}
          </View>
          <View style={styles.tableCol2}>
            {item.grade
              ? <View style={styles.gradeBadge}><Text style={styles.gradeBadgeText}>{item.grade}</Text></View>
              : null
            }
            {item.brand && <Text style={styles.tableSubText}>{item.brand}</Text>}
            {item.oilType && <Text style={[styles.tableSubText, { color: '#888' }]}>{item.oilType}</Text>}
            {!item.grade && !item.brand && <Text style={styles.tableDash}>—</Text>}
          </View>
          <View style={styles.tableCol3}>
            {item.intervalKm && (
              <Text style={styles.tableInterval}>{item.intervalKm.toLocaleString()} km</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

function TyreCard({ data }: { data: NonNullable<Analytics['tyreAnalytics']> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Tyre Change History</Text>
        {data.currentSize && (
          <View style={styles.sizeBadge}><Text style={styles.sizeBadgeText}>{data.currentSize}</Text></View>
        )}
      </View>
      {data.history.map((item, i) => (
        <View key={i} style={[styles.tableRow, i === 0 && styles.tableRowFirst]}>
          <View style={styles.tableCol1}>
            <Text style={styles.tableDate}>{fmtDate(item.date)}</Text>
            {item.km && <Text style={styles.tableKm}>{item.km.toLocaleString()} km</Text>}
          </View>
          <View style={styles.tableCol2}>
            {item.size
              ? <View style={styles.gradeBadge}><Text style={styles.gradeBadgeText}>{item.size}</Text></View>
              : <Text style={styles.tableDash}>—</Text>
            }
            {item.brand && <Text style={styles.tableSubText}>{item.brand}</Text>}
          </View>
          <View style={styles.tableCol3}>
            {item.tyresChanged && <Text style={styles.tableMeta}>{item.tyresChanged} tyre{item.tyresChanged !== '1' ? 's' : ''}</Text>}
            {item.kmThisSet != null && (
              <Text style={styles.tableInterval}>{item.kmThisSet.toLocaleString()} km/set</Text>
            )}
          </View>
        </View>
      ))}
      {data.history.length < 2 && (
        <Text style={cs.noData}>Log a second tyre change to see km-per-set calculation</Text>
      )}
    </View>
  )
}

function EmissionCard({ data }: { data: NonNullable<Analytics['emissionAnalytics']> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Emission Test History</Text>
        <Text style={styles.sectionBadge}>{data.history.length} tests</Text>
      </View>
      {data.warning && (
        <View style={[styles.warnBanner, data.warning.includes('FAIL') && styles.warnBannerRed]}>
          <Text style={styles.warnIcon}>{data.warning.includes('FAIL') ? '🚨' : '⚠️'}</Text>
          <Text style={styles.warnText}>{data.warning}</Text>
        </View>
      )}
      {data.history.map((item, i) => {
        const passed = item.result === 'Pass'
        const failed = item.result === 'Fail'
        const hasReadings = item.co != null || item.hc != null
        return (
          <View key={i} style={[styles.tableRow, i === 0 && styles.tableRowFirst]}>
            <View style={styles.tableCol1}>
              <Text style={styles.tableDate}>{fmtDate(item.date)}</Text>
              {item.km && <Text style={styles.tableKm}>{item.km.toLocaleString()} km</Text>}
            </View>
            <View style={[styles.tableCol2, { gap: 3 }]}>
              {item.co != null  && <Text style={styles.emissionVal}>CO: <Text style={styles.emissionNum}>{item.co}%</Text></Text>}
              {item.hc != null  && <Text style={styles.emissionVal}>HC: <Text style={styles.emissionNum}>{item.hc} ppm</Text></Text>}
              {item.co2 != null && <Text style={styles.emissionVal}>CO₂: <Text style={styles.emissionNum}>{item.co2}%</Text></Text>}
              {!hasReadings && <Text style={styles.tableDash}>No readings</Text>}
            </View>
            <View style={styles.tableCol3}>
              {item.result && (
                <View style={[styles.resultBadge, passed ? styles.resultPass : failed ? styles.resultFail : styles.resultNeutral]}>
                  <Text style={[styles.resultText, (passed || failed) && { color: '#fff' }]}>
                    {passed ? '✓ Pass' : failed ? '✗ Fail' : item.result}
                  </Text>
                </View>
              )}
              {item.station && <Text style={styles.tableMeta} numberOfLines={1}>{item.station}</Text>}
            </View>
          </View>
        )
      })}
      {!data.history.some(h => h.co != null || h.hc != null) && (
        <Text style={cs.noData}>Enter CO% and HC ppm readings when logging next emission test</Text>
      )}
    </View>
  )
}

function AcCard({ data }: { data: NonNullable<Analytics['acAnalytics']> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>AC System — Refill History</Text>
        <Text style={styles.sectionBadge}>{data.refillCount12m} past year</Text>
      </View>
      {data.warning && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnIcon}>⚠️</Text>
          <Text style={styles.warnText}>{data.warning}</Text>
        </View>
      )}
      {data.history.map((item, i) => (
        <View key={i} style={[styles.tableRow, i === 0 && styles.tableRowFirst]}>
          <View style={styles.tableCol1}>
            <Text style={styles.tableDate}>{fmtDate(item.date)}</Text>
            {item.km && <Text style={styles.tableKm}>{item.km.toLocaleString()} km</Text>}
          </View>
          <View style={styles.tableCol2}>
            {item.refrigerantType
              ? <View style={styles.gradeBadge}><Text style={styles.gradeBadgeText}>{item.refrigerantType}</Text></View>
              : <Text style={styles.tableDash}>—</Text>
            }
          </View>
          <View style={styles.tableCol3}>
            {item.quantityGrams != null
              ? <Text style={styles.tableInterval}>{item.quantityGrams}g</Text>
              : <Text style={styles.tableDash}>— g</Text>
            }
          </View>
        </View>
      ))}
      {!data.history.some(h => h.quantityGrams != null) && (
        <Text style={cs.noData}>Enter grams filled when logging next AC refill</Text>
      )}
    </View>
  )
}

// ── Cost Forecast Card ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  overdue: '#e53935',
  due_soon: '#f57c00',
  ok: '#1a73e8',
  no_data: '#9e9e9e',
}

function CostForecastCard({ forecast }: { forecast: Forecast }) {
  const fmt = (n: number) => 'LKR ' + Math.round(n).toLocaleString()
  const hasAnyEstimate = forecast.items.some(i => i.estimatedCost !== null)

  return (
    <View style={styles.forecastCard}>
      <View style={styles.forecastHeader}>
        <View>
          <Text style={styles.forecastTitle}>Cost Forecast</Text>
          <Text style={styles.forecastSub}>Next 90 days — upcoming services</Text>
        </View>
        {hasAnyEstimate && (
          <View style={styles.forecastTotal}>
            <Text style={styles.forecastTotalLabel}>Estimated</Text>
            <Text style={styles.forecastTotalValue}>{fmt(forecast.totalEstimated)}</Text>
          </View>
        )}
      </View>

      {forecast.items.length === 0 ? (
        <Text style={styles.forecastEmpty}>No services due in the next 90 days.</Text>
      ) : (
        forecast.items.map((item, i) => {
          const color = STATUS_COLOR[item.status] ?? '#888'
          const timeStr = [
            item.remainingKm !== null
              ? item.remainingKm < 0
                ? `${Math.abs(item.remainingKm).toLocaleString()} km overdue`
                : `in ${item.remainingKm.toLocaleString()} km`
              : null,
            item.remainingDays !== null
              ? item.remainingDays < 0
                ? `${Math.abs(item.remainingDays)}d overdue`
                : `in ${item.remainingDays}d`
              : null,
          ].filter(Boolean).join(' · ')

          return (
            <View key={i} style={[styles.forecastRow, i > 0 && styles.forecastRowBorder]}>
              <View style={[styles.forecastDot, { backgroundColor: color }]} />
              <View style={styles.forecastRowText}>
                <Text style={styles.forecastItemName}>{item.name}</Text>
                {timeStr ? <Text style={[styles.forecastItemTime, { color }]}>{timeStr}</Text> : null}
              </View>
              <View style={styles.forecastCostCol}>
                {item.estimatedCost !== null ? (
                  <>
                    <Text style={styles.forecastCost}>{fmt(item.estimatedCost)}</Text>
                    <Text style={styles.forecastCostNote}>avg of {item.basedOn}</Text>
                  </>
                ) : (
                  <Text style={styles.forecastCostNoData}>No estimate</Text>
                )}
              </View>
            </View>
          )
        })
      )}

      {!hasAnyEstimate && forecast.items.length > 0 && (
        <Text style={styles.forecastHint}>
          Log service costs when you add records to unlock cost estimates here.
        </Text>
      )}
    </View>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ token, vehicleId, onBack, onKnowledgeHub }: Props) {
  const [data, setData] = useState<Analytics | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const load = () => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      api.getAnalytics(token, vehicleId),
      api.getCostForecast(token, vehicleId).catch(() => null),
      api.getAnomalies(token, vehicleId).catch(() => []),
    ])
      .then(([analytics, fore, anom]) => {
        setData(analytics)
        setForecast(fore)
        setAnomalies(anom ?? [])
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>

  if (loadError) return (
    <View style={styles.center}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>Could not load analytics</Text>
      <Text style={styles.errorSub}>Check your connection and try again</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={load}>
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  )

  if (!data || (data.totalSpend === 0 && data.recordCounts.fuelLogs === 0 && data.recordCounts.services === 0)) return (
    <View style={styles.center}>
      <Text style={styles.errorIcon}>📊</Text>
      <Text style={styles.errorTitle}>No data yet</Text>
      <Text style={styles.errorSub}>Log a fuel fill-up or service record to start seeing analytics</Text>
      <TouchableOpacity onPress={onBack} style={styles.retryBtn}>
        <Text style={styles.retryBtnText}>← Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  )

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
          <Text style={styles.statValue}>{data.costPerKm != null ? 'LKR ' + data.costPerKm.toFixed(1) : '—'}</Text>
          <Text style={styles.statSub}>per kilometre driven</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Fuel Economy</Text>
          <Text style={styles.statValue}>{data.avgFuelEfficiency != null ? data.avgFuelEfficiency.toFixed(1) + ' km/L' : '—'}</Text>
          <Text style={styles.statSub}>average efficiency</Text>
        </View>
      </View>

      {/* Anomaly warnings */}
      {anomalies.length > 0 && (
        <View style={styles.anomalySection}>
          <Text style={styles.anomalySectionTitle}>⚠ Service History Alerts</Text>
          {anomalies.map(a => (
            <View
              key={a.id}
              style={[styles.anomalyCard, a.severity === 'warning' ? styles.anomalyCardWarn : styles.anomalyCardInfo]}
            >
              <Text style={[styles.anomalyTitle, a.severity === 'warning' ? styles.anomalyTitleWarn : styles.anomalyTitleInfo]}>
                {a.severity === 'warning' ? '⚠️ ' : 'ℹ️ '}{a.title}
              </Text>
              <Text style={styles.anomalyDesc}>{a.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Cost forecast */}
      {forecast && forecast.items.length > 0 && (
        <CostForecastCard forecast={forecast} />
      )}

      {/* Mileage growth */}
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

      {/* Fuel efficiency */}
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
                  { width: (Math.round((item.amount / maxBreakdown) * 100) + '%') as any, backgroundColor: COLORS[i % COLORS.length] }
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
                {m.amount > 0 && <Text style={styles.monthAmt}>{Math.round(m.amount / 1000)}k</Text>}
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

      {/* ── Structured analytics ─────────────────────────── */}
      {(data.oilAnalytics || data.tyreAnalytics || data.emissionAnalytics || data.acAnalytics) && (
        <View style={styles.structuredDivider}>
          <Text style={styles.structuredDividerText}>Detailed Service Analytics</Text>
        </View>
      )}

      {data.oilAnalytics      && <OilCard      data={data.oilAnalytics}      />}
      {data.tyreAnalytics     && <TyreCard     data={data.tyreAnalytics}     />}
      {data.emissionAnalytics && <EmissionCard data={data.emissionAnalytics} />}
      {data.acAnalytics       && <AcCard       data={data.acAnalytics}       />}

      {/* Knowledge Hub nudge — appears when structured oil or tyre data exists */}
      {onKnowledgeHub && (data.oilAnalytics || data.tyreAnalytics) && (
        <TouchableOpacity style={styles.knowledgeNudge} onPress={onKnowledgeHub} activeOpacity={0.8}>
          <View style={styles.knowledgeNudgeLeft}>
            <Text style={styles.knowledgeNudgeTitle}>Check Against Manufacturer Specs</Text>
            <Text style={styles.knowledgeNudgeSub}>
              {data.oilAnalytics?.history.some(h => h.grade)
                ? 'Compare your logged oil grade, tyre size, and service intervals against manufacturer recommendations for your vehicle.'
                : 'Add oil grade in Prediction Setup, then compare everything against manufacturer recommendations in Knowledge Hub.'}
            </Text>
          </View>
          <Text style={styles.knowledgeNudgeArrow}>→</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  noData: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
})

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, backgroundColor: c.background },
    errorIcon: { fontSize: 48, marginBottom: 16 },
    errorTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
    errorSub: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    retryBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 28, paddingVertical: 12,
    },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    topRow: { marginTop: 48, marginBottom: 8 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    title: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 20 },

    totalCard: { backgroundColor: c.primary, borderRadius: 16, padding: 20, marginBottom: 16 },
    totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 6 },
    totalAmount: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 14 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
    pillText: { fontSize: 11, color: '#fff', fontWeight: '600' },

    statRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    statCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    statLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginBottom: 4 },
    statValue: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 2 },
    statSub: { fontSize: 11, color: c.textFaint },

    chartCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    chartTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    chartSub: { fontSize: 11, color: c.textFaint },
    chartDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

    section: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    sectionBadge: { fontSize: 11, color: c.textMuted, fontWeight: '600' },

    catRow: { marginBottom: 12 },
    catLabel: { fontSize: 12, color: c.textSub, fontWeight: '600', marginBottom: 5 },
    barTrack: { height: 10, backgroundColor: c.border, borderRadius: 5, marginBottom: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    catAmount: { fontSize: 11, color: c.textMuted },

    monthlyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 },
    monthCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    monthAmt: { fontSize: 9, color: c.textMuted, marginBottom: 3 },
    monthBg: { width: '80%', height: 80, backgroundColor: c.border, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    monthFill: { backgroundColor: c.primary, borderRadius: 4, width: '100%' },
    monthLbl: { fontSize: 9, color: c.textMuted, marginTop: 5, textAlign: 'center' },

    countRow: { flexDirection: 'row', gap: 12 },
    countCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 16, alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    countNum: { fontSize: 28, fontWeight: '800', color: c.primary, marginBottom: 4 },
    countLbl: { fontSize: 11, color: c.textMuted, fontWeight: '600', textAlign: 'center' },

    structuredDivider: { marginTop: 8, marginBottom: 16, alignItems: 'center' },
    structuredDividerText: { fontSize: 11, color: c.textFaint, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

    tableRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border,
    },
    tableRowFirst: { borderTopWidth: 0 },
    tableCol1: { width: 90 },
    tableCol2: { flex: 1 },
    tableCol3: { width: 80, alignItems: 'flex-end' },
    tableDate: { fontSize: 12, color: c.textBody, fontWeight: '600' },
    tableKm: { fontSize: 10, color: c.textFaint, marginTop: 2 },
    tableDash: { fontSize: 13, color: c.borderStrong },
    tableMeta: { fontSize: 11, color: c.textMuted, marginTop: 3 },
    tableSubText: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    tableInterval: { fontSize: 11, color: c.primary, fontWeight: '600', marginTop: 3 },

    gradeBadge: { backgroundColor: c.primaryTint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
    gradeBadgeText: { fontSize: 12, color: c.primaryTintText, fontWeight: '700' },
    sizeBadge: { backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    sizeBadgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },

    emissionVal: { fontSize: 11, color: c.textSub },
    emissionNum: { fontWeight: '700', color: c.textBody },
    resultBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-end' },
    resultPass: { backgroundColor: '#34a853' },
    resultFail: { backgroundColor: '#ea4335' },
    resultNeutral: { backgroundColor: c.border },
    resultText: { fontSize: 11, fontWeight: '700', color: c.textSub },

    knowledgeNudge: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.primaryTint, borderRadius: 14, padding: 16,
      marginTop: 8, marginBottom: 16,
      borderLeftWidth: 4, borderLeftColor: c.primary,
    },
    knowledgeNudgeLeft: { flex: 1 },
    knowledgeNudgeTitle: { fontSize: 14, fontWeight: '700', color: c.primaryTintText, marginBottom: 4 },
    knowledgeNudgeSub: { fontSize: 12, color: c.textSub, lineHeight: 17 },
    knowledgeNudgeArrow: { fontSize: 18, color: c.primary, fontWeight: '700' },

    warnBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: '#fff8e1', borderRadius: 8, padding: 10, marginBottom: 12,
      borderLeftWidth: 3, borderLeftColor: '#f9a825',
    },
    warnBannerRed: { backgroundColor: '#fce4ec', borderLeftColor: '#e53935' },
    warnIcon: { fontSize: 14, marginTop: 1 },
    warnText: { flex: 1, fontSize: 12, color: '#5d4037', lineHeight: 17 },

    anomalySection: { marginBottom: 16 },
    anomalySectionTitle: { fontSize: 14, fontWeight: '700', color: c.textSub, marginBottom: 10 },
    anomalyCard: {
      borderRadius: 10, padding: 14, marginBottom: 10,
      borderLeftWidth: 4,
    },
    anomalyCardWarn: { backgroundColor: '#fff8e1', borderLeftColor: '#f9a825' },
    anomalyCardInfo: { backgroundColor: c.primaryTint, borderLeftColor: c.primary },
    anomalyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
    anomalyTitleWarn: { color: '#e65100' },
    anomalyTitleInfo: { color: c.primaryTintText },
    anomalyDesc: { fontSize: 13, color: c.textSub, lineHeight: 19 },

    forecastCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    forecastHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 14,
    },
    forecastTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 2 },
    forecastSub: { fontSize: 12, color: c.textMuted },
    forecastTotal: { alignItems: 'flex-end' },
    forecastTotalLabel: { fontSize: 11, color: c.textMuted, marginBottom: 2 },
    forecastTotalValue: { fontSize: 18, fontWeight: '800', color: c.primary },
    forecastEmpty: { fontSize: 13, color: c.textFaint, textAlign: 'center', paddingVertical: 8 },
    forecastRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    },
    forecastRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
    forecastDot: { width: 8, height: 8, borderRadius: 4 },
    forecastRowText: { flex: 1 },
    forecastItemName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
    forecastItemTime: { fontSize: 12, fontWeight: '600' },
    forecastCostCol: { alignItems: 'flex-end', minWidth: 80 },
    forecastCost: { fontSize: 14, fontWeight: '700', color: c.text },
    forecastCostNote: { fontSize: 10, color: c.textFaint },
    forecastCostNoData: { fontSize: 12, color: c.textFaint, fontStyle: 'italic' },
    forecastHint: {
      fontSize: 11, color: c.textFaint, fontStyle: 'italic',
      textAlign: 'center', marginTop: 10, lineHeight: 16,
    },
  })
}
