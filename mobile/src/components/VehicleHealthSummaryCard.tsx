// The shared "Vehicle Health Summary" view — an auto-analyzed, visual
// summary of a vehicle's condition, used in place of a raw scrollable record
// list wherever a garage, buyer, or family member needs to understand a
// vehicle at a glance (booking's attached history, buyer's transfer preview,
// family share). See backend/src/utils/vehicleHealthSummary.ts for the data
// contract and the reasoning behind what's included/excluded.
import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useTranslation } from '../i18n/LanguageContext'
import Sparkline from './Sparkline'

export type HealthSummary = {
  mileageTrend: { date: string; mileage: number }[]
  topPredictions: { name: string; status: 'overdue' | 'due_soon'; remainingKm: number | null; remainingDays: number | null }[]
  recentServices: { date: string; description: string; category: 'service' | 'legal_compliance'; cost: number | null }[]
  totalSpend: number
  spendBreakdown: { category: string; amount: number }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function VehicleHealthSummaryCard({ summary }: { summary: HealthSummary }) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const mileageValues = summary.mileageTrend.map(m => m.mileage)
  const latestMileage = mileageValues.length > 0 ? mileageValues[mileageValues.length - 1] : null

  return (
    <View style={styles.container}>
      {/* Mileage trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('healthSummary.mileageTrend')}</Text>
        {mileageValues.length >= 2 ? (
          <>
            <Sparkline data={mileageValues} color={colors.primary} gradId="healthSummaryMileage" />
            <Text style={styles.bigValue}>{latestMileage!.toLocaleString()} km</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>
            {latestMileage != null ? `${latestMileage.toLocaleString()} km` : t('healthSummary.notEnoughData')}
          </Text>
        )}
      </View>

      {/* Needs attention */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('healthSummary.needsAttention')}</Text>
        {summary.topPredictions.length === 0 ? (
          <Text style={styles.emptyText}>{t('healthSummary.allOnTrack')}</Text>
        ) : (
          summary.topPredictions.map((p, i) => {
            const overdue = p.status === 'overdue'
            const color = overdue ? '#c62828' : '#e65100'
            const km = p.remainingKm != null ? Math.abs(p.remainingKm).toLocaleString() : null
            return (
              <View key={i} style={[styles.predRow, { borderLeftColor: color }]}>
                <Text style={styles.predName}>{p.name}</Text>
                <Text style={[styles.predStatus, { color }]}>
                  {overdue
                    ? (km ? t('healthSummary.overdueByKm', { km }) : t('healthSummary.overdue'))
                    : (km ? t('healthSummary.dueInKm', { km }) : t('healthSummary.dueSoon'))}
                </Text>
              </View>
            )
          })
        )}
      </View>

      {/* Recent services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('healthSummary.recentServices')}</Text>
        {summary.recentServices.length === 0 ? (
          <Text style={styles.emptyText}>{t('healthSummary.noServicesYet')}</Text>
        ) : (
          summary.recentServices.map((r, i) => (
            <View key={i} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceDesc} numberOfLines={1}>{r.description}</Text>
                <Text style={styles.serviceDate}>{formatDate(r.date)}</Text>
              </View>
              {r.cost != null && <Text style={styles.serviceCost}>LKR {r.cost.toLocaleString()}</Text>}
            </View>
          ))
        )}
      </View>

      {/* Total spend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('healthSummary.totalSpend')}</Text>
        <Text style={styles.bigValue}>LKR {summary.totalSpend.toLocaleString()}</Text>
        {summary.spendBreakdown.length > 0 && (
          <View style={styles.breakdownRow}>
            {summary.spendBreakdown.map((b, i) => (
              <View key={i} style={styles.breakdownChip}>
                <Text style={styles.breakdownChipText}>{b.category}</Text>
                <Text style={styles.breakdownChipAmount}>LKR {b.amount.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { gap: 14 },
    section: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
    bigValue: { fontSize: 22, fontWeight: '800', color: c.text, marginTop: 6 },
    emptyText: { fontSize: 13, color: c.textFaint },
    predRow: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginBottom: 8 },
    predName: { fontSize: 14, fontWeight: '700', color: c.text },
    predStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    serviceRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    serviceDesc: { fontSize: 14, color: c.text, fontWeight: '600' },
    serviceDate: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    serviceCost: { fontSize: 13, color: c.textSub, fontWeight: '600', marginLeft: 8 },
    breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    breakdownChip: { backgroundColor: c.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    breakdownChipText: { fontSize: 10, color: c.textMuted, fontWeight: '600' },
    breakdownChipAmount: { fontSize: 13, color: c.text, fontWeight: '700', marginTop: 1 },
  })
}
