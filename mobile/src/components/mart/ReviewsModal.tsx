import React, { useMemo } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon from '../AppIcon'
import MartBottomSheet from './MartBottomSheet'
import MartEmptyState from './MartEmptyState'

// Spec: 04-screens.md §17. Shell built in Step 0.10 — the real data wiring
// (GET /mart/sellers/:id/reviews) is Milestone 2 Step 2.7. This is a reusable
// presentational component, ready to receive real data then; nothing calls it yet.
export type ReviewSummary = { avg: number | null; count: number; distribution: Record<'5' | '4' | '3' | '2' | '1', number> }
export type ReviewItem = { id: string; rating: number; comment: string | null; timeAgoLabel: string; listingTitle: string }

export default function ReviewsModal({
  visible, onClose, title = 'Reviews · Parts sales', summary, items, loading, onLoadMore,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  summary: ReviewSummary | null
  items: ReviewItem[]
  loading: boolean
  onLoadMore?: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <MartBottomSheet visible={visible} onClose={onClose} topOffset={120}>
      <Text style={styles.title}>{title}</Text>

      {loading && !summary ? (
        <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
      ) : summary && summary.count > 0 ? (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.avgBlock}>
              <Text style={styles.avgNumber}>{summary.avg?.toFixed(1)}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <AppIcon key={i} icon={{ lib: 'ion', name: i <= Math.round(summary.avg || 0) ? 'star' : 'star-outline' }} size={14} color={colors.accent} />
                ))}
              </View>
              <Text style={styles.countText}>{summary.count} reviews</Text>
            </View>
            <View style={styles.barsBlock}>
              {(['5', '4', '3', '2', '1'] as const).map(k => {
                const n = summary.distribution[k] || 0
                const pct = summary.count > 0 ? n / summary.count : 0
                return (
                  <View key={k} style={styles.barRow}>
                    <Text style={styles.barLabel}>{k}</Text>
                    <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct * 100}%` }]} /></View>
                    <Text style={styles.barCount}>{n}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={item => item.id}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <View style={styles.reviewRow}>
                <View style={styles.reviewHeader}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <AppIcon key={i} icon={{ lib: 'ion', name: i <= item.rating ? 'star' : 'star-outline' }} size={12} color={colors.accent} />
                    ))}
                  </View>
                  <Text style={styles.reviewTime}>{item.timeAgoLabel}</Text>
                </View>
                {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
                <Text style={styles.reviewFor}>For: {item.listingTitle}</Text>
              </View>
            )}
          />
        </>
      ) : (
        <MartEmptyState icon={{ lib: 'ion', name: 'star-outline' }} title="No reviews yet" />
      )}
    </MartBottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 18, fontWeight: '700', color: c.primary, marginBottom: 16 },
    summaryRow: { flexDirection: 'row', gap: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 12 },
    avgBlock: { alignItems: 'center', justifyContent: 'center' },
    avgNumber: { fontSize: 40, fontWeight: '700', color: c.text },
    starsRow: { flexDirection: 'row', gap: 2, marginVertical: 4 },
    countText: { fontSize: 12, color: c.textMuted },
    barsBlock: { flex: 1, justifyContent: 'center', gap: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barLabel: { fontSize: 11, color: c.textMuted, width: 8 },
    barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: c.accent },
    barCount: { fontSize: 11, color: c.textMuted, width: 20, textAlign: 'right' },
    reviewRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reviewTime: { fontSize: 11, color: c.textMuted },
    reviewComment: { fontSize: 13, color: c.textBody, marginTop: 6, lineHeight: 18 },
    reviewFor: { fontSize: 11.5, color: c.textMuted, marginTop: 6 },
  })
}
