import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartListingCard from '../../components/mart/MartListingCard'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { DISTRICTS } from '../../constants/districts'
import { MartFilters, DEFAULT_MART_FILTERS, activeFilterCount } from './FiltersScreen'

type Card = {
  id: string; title: string; coverUrl: string | null; price: number | null
  condition: 'new' | 'used' | null; district: string; status: string; isFavorited: boolean
}

// Spec: 04-screens.md §1. Selling only for now — the Selling|Wanted switch is Milestone 2
// Step 2.1, so it isn't rendered. Favorites/Messages/Notifications/My Mart icons and the
// heart button are present (matching the header layout) but not yet wired to anything real
// — those screens don't exist until Steps 1.6/1.7/1.8/2.9, so tapping them is a harmless
// no-op for now rather than a fake, unpersisted favorite toggle. Tapping a card opens the
// real Detail screen (Step 1.4).
export default function MartHomeScreen({
  token, filters, onFiltersChange, onOpenFilters, onOpenPostAd, onOpenListing,
}: {
  token: string
  filters: MartFilters
  onFiltersChange: (f: MartFilters) => void
  onOpenFilters: () => void
  onOpenPostAd: () => void
  onOpenListing: (id: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [searchText, setSearchText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [items, setItems] = useState<Card[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const queryParams = useCallback((cursor?: string) => ({
    type: 'selling' as const,
    q: submittedQuery || undefined,
    categoryId: filters.categoryId || undefined,
    make: filters.make || undefined,
    model: filters.model || undefined,
    yearFrom: filters.yearFrom || undefined,
    yearTo: filters.yearTo || undefined,
    condition: filters.condition || undefined,
    priceMin: filters.priceMin ?? undefined,
    priceMax: filters.priceMax ?? undefined,
    district: filters.district || undefined,
    cursor,
  }), [submittedQuery, filters])

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMartListings(token, queryParams(opts.cursor))
      setItems(prev => (opts.cursor ? [...prev, ...result.items] : result.items))
      setNextCursor(result.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [queryParams, token])

  useEffect(() => { load() }, [submittedQuery, filters])

  const toggleCategoryChip = (categoryId: string | null) => onFiltersChange({ ...filters, categoryId })

  const clearAll = () => { onFiltersChange(DEFAULT_MART_FILTERS); setSearchText(''); setSubmittedQuery('') }

  const filterCount = activeFilterCount(filters)
  const comingSoon = () => Alert.alert('Coming soon', 'This part of Vocksy Mart is still being built.')

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Vocksy Mart</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'heart-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'chatbubble-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'notifications-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'person-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <AppIcon icon={{ lib: 'ion', name: 'search' }} size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parts, brand, model…"
            placeholderTextColor={colors.textFaint}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => setSubmittedQuery(searchText.trim())}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={onOpenFilters}>
          <AppIcon icon={{ lib: 'ion', name: 'options-outline' }} size={20} color="#fff" />
          {filterCount > 0 ? (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filterCount}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        data={MART_CATEGORIES}
        keyExtractor={c => c.id}
        ListHeaderComponent={() => (
          <TouchableOpacity
            style={[styles.chip, !filters.categoryId && styles.chipActive]}
            onPress={() => toggleCategoryChip(null)}
          >
            <Text style={[styles.chipText, !filters.categoryId && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filters.categoryId === item.id && styles.chipActive]}
            onPress={() => toggleCategoryChip(filters.categoryId === item.id ? null : item.id)}
          >
            <Text style={[styles.chipText, filters.categoryId === item.id && styles.chipTextActive]}>{item.en}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'file-tray-outline' }}
          title="No ads match your search"
          actionLabel={submittedQuery || filterCount > 0 ? 'Clear filters' : undefined}
          onAction={submittedQuery || filterCount > 0 ? clearAll : undefined}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <MartListingCard
              title={item.title}
              coverUrl={item.coverUrl}
              price={item.price}
              condition={item.condition}
              districtLabel={DISTRICTS.find(d => d.id === item.district)?.en || item.district}
              status={item.status === 'reserved' ? 'reserved' : 'available'}
              isFavorited={item.isFavorited}
              onPress={() => onOpenListing(item.id)}
              onToggleFavorite={comingSoon}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.postBtn} onPress={onOpenPostAd}>
        <AppIcon icon={{ lib: 'ion', name: 'add' }} size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingBottom: 12, paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.primary },
    headerIcons: { flexDirection: 'row', gap: 2 },
    headerIconBtn: { padding: 6 },

    searchRow: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: c.surface },
    searchBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    filterBtn: {
      width: 40, height: 40, borderRadius: 10, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: c.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    },
    filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    chipStrip: { backgroundColor: c.surface, paddingBottom: 12 },
    chip: {
      marginLeft: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
      backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.borderMid,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textBody },
    chipTextActive: { color: '#fff' },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    gridRow: { gap: 12, paddingHorizontal: 16 },
    gridContent: { paddingTop: 12, paddingBottom: 100, gap: 12 },

    postBtn: {
      position: 'absolute', right: 16, bottom: 84, width: 52, height: 52, borderRadius: 26,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
    },
  })
}
