import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import { useTranslation } from '../../i18n/LanguageContext'
import AppIcon from '../../components/AppIcon'
import MartListingRow from '../../components/mart/MartListingRow'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { DISTRICTS } from '../../constants/districts'
import { formatBudget, localizedLabel } from '../../utils/martHelpers'

type FavFilter = 'all' | 'available' | 'closed'

// Spec: 04-screens.md §10. Removed ads arrive as a minimal card (title/cover only,
// `unavailable: 'removed'`) — tapping one still opens Detail, which already renders
// its own "This ad is no longer available" empty state (Step 1.4), so no special
// handling is needed here beyond always navigating through.
export default function FavoritesScreen({ token, onBack, onOpenListing }: {
  token: string
  onBack: () => void
  onOpenListing: (id: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [filter, setFilter] = useState<FavFilter>('all')
  const [items, setItems] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMartFavorites(token, { filter, cursor: opts.cursor })
      setItems(prev => (opts.cursor ? [...prev, ...result.items] : result.items))
      setNextCursor(result.nextCursor)
      setCount(result.count)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [filter, token])

  useEffect(() => { load() }, [filter])

  const removeFavorite = async (listingId: string) => {
    // "Remove: tap the heart and the row disappears at once. No confirm, no undo."
    setItems(prev => prev.filter(i => i.id !== listingId))
    setCount(c => Math.max(0, c - 1))
    try {
      await api.unfavoriteMartListing(token, listingId)
    } catch {
      // A failed unfavorite silently stays removed from this list view — the ad is
      // still favorited server-side and will simply reappear next time this screen
      // loads fresh, which is a reasonable fallback for a no-confirm/no-undo action.
    }
  }

  const rowFor = (item: any) => {
    if (item.unavailable === 'removed') {
      return { metaLine: '', statusTag: { label: t('mart.common.removed'), variant: 'gray' as const }, grayedOut: true }
    }
    const district = DISTRICTS.find(d => d.id === item.district)
    const districtLabel = district ? localizedLabel(language, district) : item.district
    const conditionLabel = item.condition === 'new' ? t('mart.common.conditionNew') : item.condition === 'used' ? t('mart.common.conditionUsed') : null
    const metaLine = [districtLabel, conditionLabel].filter(Boolean).join(' · ')
    if (item.unavailable === 'sold') return { metaLine, statusTag: { label: t('mart.common.sold'), variant: 'gray' as const }, grayedOut: true }
    if (item.status === 'reserved') return { metaLine, statusTag: { label: t('mart.common.reserved'), variant: 'amber-soft' as const }, grayedOut: false }
    return { metaLine, statusTag: undefined, grayedOut: false }
  }

  const emptyLabel = filter === 'all' ? null : t('mart.favorites.nothingHere')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mart.favorites.title')}</Text>
        <Text style={styles.countText}>{t('mart.favorites.savedCount', { count })}</Text>
      </View>

      <View style={styles.chipRow}>
        {([['all', t('common.all')], ['available', t('mart.favorites.filterAvailable')], ['closed', t('mart.favorites.filterClosed')]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.chip, filter === key && styles.chipActive]} onPress={() => setFilter(key)}>
            <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title={t('mart.home.loadError')} actionLabel={t('common.retry')} onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'heart-outline' }}
          title={emptyLabel || t('mart.favorites.emptyAll')}
          actionLabel={emptyLabel ? undefined : t('mart.favorites.browseMart')}
          onAction={emptyLabel ? undefined : onBack}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => {
            const row = rowFor(item)
            return (
              <MartListingRow
                title={item.title}
                coverUrl={item.coverUrl}
                price={item.unavailable === 'removed' ? null : item.price}
                priceText={item.unavailable !== 'removed' && item.type === 'wanted' ? formatBudget(t, item.budgetMin, item.budgetMax) : undefined}
                metaLine={row.metaLine}
                statusTag={row.statusTag}
                grayedOut={row.grayedOut}
                onPress={() => onOpenListing(item.id)}
                favoriteButton={
                  <TouchableOpacity onPress={() => removeFavorite(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppIcon icon={{ lib: 'ion', name: 'heart' }} size={20} color={colors.accent} />
                  </TouchableOpacity>
                }
              />
            )
          }}
        />
      )}
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    countText: { fontSize: 12.5, color: c.textMuted },

    chipRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 12, backgroundColor: c.surface },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.borderMid },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textBody },
    chipTextActive: { color: '#fff' },

    listContent: { padding: 16, paddingTop: 4, gap: 12 },
  })
}
