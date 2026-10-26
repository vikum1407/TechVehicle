import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

type Props = { token: string; onBack: () => void }

// English only (spec D2/Step 5) - this screen is admin-only tooling, not user-facing
// product UI, so it's deliberately left out of the i18n system to keep this build
// focused on the data, not translation plumbing for a screen only Vikum ever opens.
export default function AdminScreen({ token, onBack }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<any>(null)
  const [cityType, setCityType] = useState<'owner' | 'garage'>('owner')
  const [cities, setCities] = useState<any>(null)
  const [features, setFeatures] = useState<any[] | null>(null)
  const [promoCodes, setPromoCodes] = useState<any>(null)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [promoDetail, setPromoDetail] = useState<Record<string, any>>({})
  const [growth, setGrowth] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)

  const loadCities = useCallback(async (type: 'owner' | 'garage') => {
    try {
      setCities(await api.getAdminCities(token, type))
    } catch (e: any) {
      setError(e.message)
    }
  }, [token])

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const [ov, ci, fe, pc, gr, he] = await Promise.all([
        api.getAdminOverview(token),
        api.getAdminCities(token, cityType),
        api.getAdminFeatures(token),
        api.getAdminPromoCodes(token),
        api.getAdminGrowth(token),
        api.getAdminHealth(token),
      ])
      setOverview(ov); setCities(ci); setFeatures(fe); setPromoCodes(pc); setGrowth(gr); setHealth(he)
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data')
    } finally {
      setLoading(false); setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => { loadAll() }, [loadAll])

  const togglePromoDetail = async (code: string) => {
    if (expandedCode === code) { setExpandedCode(null); return }
    setExpandedCode(code)
    if (!promoDetail[code]) {
      try {
        const detail = await api.getAdminPromoCodeDetail(token, code)
        setPromoDetail(prev => ({ ...prev, [code]: detail }))
      } catch (e: any) {
        setError(e.message)
      }
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Admin" onBack={onBack} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Admin" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} />}
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <SectionTitle text="Overview" colors={colors} />
        {overview && (
          <View style={styles.statGrid}>
            <StatTile label="Owners" value={overview.owners} colors={colors} />
            <StatTile label="Garages" value={overview.garages} colors={colors} />
            <StatTile label="No role yet" value={overview.noRole} colors={colors} />
            <StatTile label="Pending deletion" value={overview.pendingDeletion} colors={colors} />
            <StatTile label="Signups today" value={overview.signups.today} colors={colors} />
            <StatTile label="Signups 7d" value={overview.signups.last7d} colors={colors} />
            <StatTile label="Signups 30d" value={overview.signups.last30d} colors={colors} />
            <StatTile label="DAU" value={overview.dau} colors={colors} />
            <StatTile label="MAU" value={overview.mau} colors={colors} />
            <StatTile label="5xx (24h)" value={overview.errorsLast24h} colors={colors} warn={overview.errorsLast24h > 0} />
            <StatTile
              label="Last backup"
              value={overview.lastBackup ? overview.lastBackup.status : 'none'}
              colors={colors}
              warn={!overview.lastBackup || overview.lastBackup.status === 'failed'}
              isText
            />
          </View>
        )}

        {/* ── Cities ────────────────────────────────────────────────────────── */}
        <SectionTitle text="Users per City" colors={colors} />
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, cityType === 'owner' && styles.toggleBtnActive]}
            onPress={() => { setCityType('owner'); loadCities('owner') }}
          >
            <Text style={[styles.toggleBtnText, cityType === 'owner' && styles.toggleBtnTextActive]}>Owners</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, cityType === 'garage' && styles.toggleBtnActive]}
            onPress={() => { setCityType('garage'); loadCities('garage') }}
          >
            <Text style={[styles.toggleBtnText, cityType === 'garage' && styles.toggleBtnTextActive]}>Garages</Text>
          </TouchableOpacity>
        </View>
        {cities && (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>{cities.total} total · {cities.pctSet}% have a city set</Text>
            {cities.listed.filter((c: any) => c.count > 0).map((c: any) => (
              <BarRow key={c.city} label={c.city} count={c.count} max={cities.total} colors={colors} />
            ))}
            {cities.otherTyped.length > 0 && (
              <>
                <Text style={styles.subLabel}>Other (typed)</Text>
                {cities.otherTyped.map((c: any) => (
                  <BarRow key={c.city} label={c.city} count={c.count} max={cities.total} colors={colors} />
                ))}
              </>
            )}
            <BarRow label="Not set" count={cities.notSet} max={cities.total} colors={colors} muted />
          </View>
        )}

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <SectionTitle text="Feature Usage" colors={colors} />
        {features && (
          <View style={styles.card}>
            <Text style={styles.subLabel}>Owner features</Text>
            {features.filter(f => f.side === 'owner').map(f => <FeatureRow key={f.key} row={f} colors={colors} />)}
            <Text style={[styles.subLabel, { marginTop: 14 }]}>Garage features</Text>
            {features.filter(f => f.side === 'garage').map(f => <FeatureRow key={f.key} row={f} colors={colors} />)}
          </View>
        )}

        {/* ── Promo codes ───────────────────────────────────────────────────── */}
        <SectionTitle text="Promo Codes" colors={colors} />
        {promoCodes && (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>
              {promoCodes.totalSignups} signups · {promoCodes.totalReal} Real · {promoCodes.totalNotReal} Not Real · {promoCodes.flaggedCodes} flagged
            </Text>
            {promoCodes.rows.length === 0 && <Text style={styles.emptyText}>No promo code signups yet.</Text>}
            {promoCodes.rows.map((row: any) => (
              <View key={row.promoCode}>
                <TouchableOpacity style={styles.promoRow} onPress={() => togglePromoDetail(row.promoCode)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoUserNumber}>{row.userNumber}</Text>
                    <Text style={styles.promoCode}>
                      {row.promoCode}{row.flags.length > 0 ? ' ⚠' : ''}{row.busyHour ? ' ℹ' : ''}
                    </Text>
                  </View>
                  <Text style={styles.promoCounts}>
                    <Text style={{ color: colors.success }}>{row.real}</Text>
                    {'  '}
                    <Text style={{ color: colors.error }}>{row.notReal}</Text>
                    {'  '}
                    <Text style={{ color: colors.textMuted }}>{row.waiting}</Text>
                  </Text>
                </TouchableOpacity>
                {expandedCode === row.promoCode && (
                  <View style={styles.promoDetailBox}>
                    {!promoDetail[row.promoCode] ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        {promoDetail[row.promoCode].flags.map((f: any, i: number) => (
                          <Text key={i} style={styles.flagReason}>⚠ {f.reason}</Text>
                        ))}
                        {promoDetail[row.promoCode].signups.map((s: any, i: number) => (
                          <View key={i} style={styles.signupRow}>
                            <Text style={styles.signupPhone}>{s.phone}</Text>
                            <Text style={styles.signupDate}>{new Date(s.signedUpAt).toLocaleDateString('en-GB')}</Text>
                            <Text style={[
                              styles.signupStatus,
                              s.status === 'real' && { color: colors.success },
                              s.status === 'not_real' && { color: colors.error },
                            ]}>
                              {s.status === 'not_real' ? 'Not Real' : s.status === 'real' ? 'Real' : 'Waiting'}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Growth ────────────────────────────────────────────────────────── */}
        <SectionTitle text="Growth" colors={colors} />
        {growth && (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>
              Activation (37–7 days ago): {growth.activation.pct != null ? `${growth.activation.pct}%` : '—'} of {growth.activation.cohortSize}
            </Text>
            <Text style={styles.cardMeta}>
              DAU {growth.activeUsers.dau} · Avg DAU (7d) {growth.activeUsers.avgDau7d} · MAU {growth.activeUsers.mau} · DAU/MAU {growth.activeUsers.dauMauPct != null ? `${growth.activeUsers.dauMauPct}%` : '—'}
            </Text>
            {growth.activeUsers.trackingSince && <Text style={styles.emptyText}>Tracking since {growth.activeUsers.trackingSince}</Text>}
            <Text style={[styles.subLabel, { marginTop: 10 }]}>Signups — last 30 days</Text>
            {growth.signupsPerDay.filter((d: any) => d.owner + d.garage + d.noRole > 0).slice(-14).map((d: any) => (
              <View key={d.day} style={styles.signupDayRow}>
                <Text style={styles.signupDayLabel}>{d.day.slice(5)}</Text>
                <Text style={styles.signupDayCounts}>
                  {d.owner} owner · {d.garage} garage · {d.withCode} w/code
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Health ────────────────────────────────────────────────────────── */}
        <SectionTitle text="App Health" colors={colors} />
        {health && (
          <View style={styles.card}>
            <Text style={styles.cardMeta}>5xx errors: {health.errors.last24h} (24h) · {health.errors.last7d} (7d)</Text>
            {health.errors.topRoutes.length > 0 && (
              <>
                <Text style={styles.subLabel}>Top error routes (7d)</Text>
                {health.errors.topRoutes.map((r: any) => (
                  <Text key={r.route} style={styles.emptyText}>{r.route} — {r.count}</Text>
                ))}
              </>
            )}
            <Text style={[styles.subLabel, { marginTop: 10 }]}>App versions (active last 30 days)</Text>
            {health.versions.length === 0 && <Text style={styles.emptyText}>No tracked activity yet.</Text>}
            {health.versions.map((v: any) => (
              <Text key={v.versionPlatform} style={styles.emptyText}>{v.versionPlatform} — {v.count}</Text>
            ))}
            <Text style={[styles.subLabel, { marginTop: 10 }]}>Last backup</Text>
            {health.backup.status ? (
              <Text style={[styles.cardMeta, health.backup.stale && { color: colors.error }]}>
                {health.backup.status.toUpperCase()} · {health.backup.sizeBytes ? `${(health.backup.sizeBytes / 1024).toFixed(0)} KB` : '—'} · {new Date(health.backup.createdAt).toLocaleString('en-GB')}
              </Text>
            ) : (
              <Text style={[styles.cardMeta, { color: colors.error }]}>No backup recorded yet</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function SectionTitle({ text, colors }: { text: string; colors: Colors }) {
  return <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>{text}</Text>
}

function StatTile({ label, value, colors, warn, isText }: { label: string; value: number | string; colors: Colors; warn?: boolean; isText?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: '30%', backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 10, marginRight: 8 }}>
      <Text style={{ fontSize: isText ? 15 : 20, fontWeight: '700', color: warn ? colors.error : colors.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

function BarRow({ label, count, max, colors, muted }: { label: string; count: number; max: number; colors: Colors; muted?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, color: muted ? colors.textFaint : colors.text }}>{label}</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>{count}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: muted ? colors.textFaint : colors.primary, borderRadius: 3 }} />
      </View>
    </View>
  )
}

function FeatureRow({ row, colors }: { row: any; colors: Colors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{row.label}</Text>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>
        {row.everUsed} ever{row.active30d != null ? ` · ${row.active30d} (30d)` : ''} · {row.pctOfSide}%
      </Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 48 },
    errorText: { color: c.error, fontSize: 13, marginBottom: 10 },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 4 },
    cardMeta: { fontSize: 12, color: c.textMuted, marginBottom: 10 },
    subLabel: { fontSize: 11, fontWeight: '700', color: c.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
    emptyText: { fontSize: 12, color: c.textFaint },
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: c.borderMid },
    toggleBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    toggleBtnText: { fontSize: 13, fontWeight: '600', color: c.textSub },
    toggleBtnTextActive: { color: '#fff' },
    promoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
    promoUserNumber: { fontSize: 14, fontWeight: '700', color: c.text },
    promoCode: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    promoCounts: { fontSize: 13, fontWeight: '700' },
    promoDetailBox: { backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 10, marginBottom: 8 },
    flagReason: { fontSize: 12, color: c.error, marginBottom: 4 },
    signupRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    signupPhone: { fontSize: 12, color: c.text, flex: 1 },
    signupDate: { fontSize: 11, color: c.textMuted, marginRight: 8 },
    signupStatus: { fontSize: 11, fontWeight: '700', color: c.textMuted },
    signupDayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    signupDayLabel: { fontSize: 12, color: c.textMuted, width: 50 },
    signupDayCounts: { fontSize: 12, color: c.text },
  })
}
