import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Modal, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import { useTranslation } from '../../i18n/LanguageContext'
import AppIcon from '../../components/AppIcon'
import MartListingCard from '../../components/mart/MartListingCard'
import MartRequestCard from '../../components/mart/MartRequestCard'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { DISTRICTS } from '../../constants/districts'
import { timeAgo, localizedLabel } from '../../utils/martHelpers'
import { MartFilters, DEFAULT_MART_FILTERS, activeFilterCount } from './FiltersScreen'
import NameDistrictSheet from './NameDistrictSheet'
import MartRulesScreen from './MartRulesScreen'

type MartType = 'selling' | 'wanted'

type Card = {
  id: string; title: string; coverUrl: string | null; price: number | null
  condition: 'new' | 'used' | null; district: string; status: string; isFavorited: boolean
  deliveryAvailable: boolean
  // Wanted-only fields (03-api.md §0 ListingCard)
  make: string | null; model: string | null; yearFrom: number | null; yearTo: number | null
  categoryId: string; budgetMin: number | null; budgetMax: number | null
  matchesYou?: boolean; repliesCount?: number; postedAt: string
  seller: { id: string; name: string }
}

// Spec: 04-screens.md §1 + §12. Milestone 2 Step 2.1 adds the Selling|Wanted switch —
// Wanted mode swaps the 2-column grid for a single-column request-card list (§12),
// everything else (header, search, category chips, bottom bar) stays the same component.
// Notifications icon (Step 2.9) now opens the real Notification Center, same unread-dot
// pattern as Messages. Favorites, My Mart, Messages (Step 1.8) and card taps all open
// real screens.
export default function MartHomeScreen({
  token, filters, onFiltersChange, onOpenFilters, onOpenPostAd, onOpenListing, onOpenMyMart, onOpenFavorites, onOpenMessages, onOpenNotifications,
}: {
  token: string
  filters: MartFilters
  onFiltersChange: (f: MartFilters) => void
  onOpenFilters: () => void
  onOpenPostAd: (initialType: MartType) => void
  onOpenListing: (id: string) => void
  onOpenMyMart: () => void
  onOpenFavorites: () => void
  onOpenMessages: () => void
  onOpenNotifications: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [martType, setMartType] = useState<MartType>('selling')
  const [myId, setMyId] = useState<string | null>(null)
  const [gateStep, setGateStep] = useState<'nameDistrict' | 'rules' | null>(null)
  const [searchText, setSearchText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [items, setItems] = useState<Card[]>([])
  const [unreadMessages, setUnreadMessages] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const queryParams = useCallback((cursor?: string) => ({
    type: martType,
    q: submittedQuery || undefined,
    categoryId: filters.categoryId || undefined,
    make: filters.make || undefined,
    model: filters.model || undefined,
    yearFrom: filters.yearFrom || undefined,
    yearTo: filters.yearTo || undefined,
    condition: martType === 'selling' ? filters.condition || undefined : undefined,
    priceMin: filters.priceMin ?? undefined,
    priceMax: filters.priceMax ?? undefined,
    district: filters.district || undefined,
    cursor,
  }), [martType, submittedQuery, filters])

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

  useEffect(() => { load() }, [martType, submittedQuery, filters])
  // Spec intent (04-screens.md §22): "reading never needs this" — browsing Mart Home
  // itself is never blocked on name+district+rules. But before this, a brand new user
  // had no way to discover that setup existed at all except by stumbling into it when
  // some action happened to fail (Post Ad, Message Seller, an offer) — there was no
  // proactive prompt anywhere. Checked once on mount; both steps are dismissible
  // (onClose/onBack just close them), so browsing is never actually gated, just invited.
  const checkGate = useCallback(async () => {
    try {
      const me = await api.getMartMe(token)
      setMyId(me.id)
      if (!me.displayName || !me.district) { setGateStep('nameDistrict'); return }
      if (!me.rulesAccepted) { setGateStep('rules'); return }
      setGateStep(null)
    } catch {
      setGateStep(null)
    }
  }, [token])

  useEffect(() => {
    api.getMartThreadsUnreadCount(token).then(r => setUnreadMessages(r.count > 0)).catch(() => {})
    api.getMartNotificationsUnreadCount(token).then(r => setUnreadNotifs(r.count > 0)).catch(() => {})
    checkGate()
  }, [token])

  const districtLabelFor = (id: string) => { const d = DISTRICTS.find(x => x.id === id); return d ? localizedLabel(language, d) : id }

  const toggleCategoryChip = (categoryId: string | null) => onFiltersChange({ ...filters, categoryId })

  const clearAll = () => { onFiltersChange(DEFAULT_MART_FILTERS); setSearchText(''); setSubmittedQuery('') }

  const filterCount = activeFilterCount(filters)

  // "Toggle, optimistic, revert on error. No navigation." (04-screens.md §1 Behavior)
  const toggleFavorite = async (item: Card) => {
    const wasFavorited = item.isFavorited
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, isFavorited: !wasFavorited } : i)))
    try {
      if (wasFavorited) await api.unfavoriteMartListing(token, item.id)
      else await api.favoriteMartListing(token, item.id)
    } catch {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, isFavorited: wasFavorited } : i)))
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Vocksy Mart</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onOpenFavorites} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'heart-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onOpenMessages} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'chatbubble-outline' }} size={22} color={colors.primary} />
            {unreadMessages ? <View style={styles.headerUnreadDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onOpenNotifications} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'notifications-outline' }} size={22} color={colors.primary} />
            {unreadNotifs ? <View style={styles.headerUnreadDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onOpenMyMart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'person-outline' }} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <AppIcon icon={{ lib: 'ion', name: 'search' }} size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={martType === 'wanted' ? t('mart.home.searchWanted') : t('mart.home.searchSelling')}
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

      {/* Spec: 04-screens.md §12 "Under the search row: Selling | Wanted segmented
          switch (gray track, white selected pill)." */}
      <View style={styles.typeSwitchWrap}>
        <View style={styles.typeSwitchTrack}>
          {(['selling', 'wanted'] as const).map(mt => (
            <TouchableOpacity
              key={mt}
              style={[styles.typeSwitchPill, martType === mt && styles.typeSwitchPillActive]}
              onPress={() => setMartType(mt)}
            >
              <Text style={[styles.typeSwitchText, martType === mt && styles.typeSwitchTextActive]}>
                {mt === 'selling' ? t('mart.home.selling') : t('mart.home.wanted')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* A plain ScrollView, not FlatList: only 12 categories, no virtualization
          needed, and this sidesteps the on-device FlatList cross-axis stretch bug
          found testing this screen for real (Oct 11) — simpler and more predictable
          for a short, static list like this one. The outer View (fixed height +
          overflow:hidden) is a second on-device fix from the same session: the
          ScrollView's own `style.height` was confirmed (via a red-background test on
          the physical device) to NOT actually constrain it here — wrapping it in a
          plain View that forcibly clips to 44px is what actually works. */}
      <View style={styles.chipStripWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStripContent}>
          <TouchableOpacity
            style={[styles.chip, !filters.categoryId && styles.chipActive]}
            onPress={() => toggleCategoryChip(null)}
          >
            <Text style={[styles.chipText, !filters.categoryId && styles.chipTextActive]}>{t('common.all')}</Text>
          </TouchableOpacity>
          {MART_CATEGORIES.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, filters.categoryId === item.id && styles.chipActive]}
              onPress={() => toggleCategoryChip(filters.categoryId === item.id ? null : item.id)}
            >
              <Text style={[styles.chipText, filters.categoryId === item.id && styles.chipTextActive]}>{localizedLabel(language, item)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title={t('mart.home.loadError')} actionLabel={t('common.retry')} onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: martType === 'wanted' ? 'search-outline' : 'file-tray-outline' }}
          title={martType === 'wanted' ? t('mart.home.noRequests') : t('mart.home.noAdsMatch')}
          actionLabel={martType === 'wanted' ? t('mart.home.postRequest') : (submittedQuery || filterCount > 0 ? t('mart.home.clearFilters') : undefined)}
          onAction={martType === 'wanted' ? () => onOpenPostAd('wanted') : (submittedQuery || filterCount > 0 ? clearAll : undefined)}
        />
      ) : martType === 'wanted' ? (
        <FlatList
          key="wanted"
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.requestListContent}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <MartRequestCard
              title={item.title}
              matchesYou={!!item.matchesYou}
              make={item.make}
              model={item.model}
              yearFrom={item.yearFrom}
              yearTo={item.yearTo}
              categoryId={item.categoryId}
              budgetMin={item.budgetMin}
              budgetMax={item.budgetMax}
              sellerName={item.seller.name}
              districtLabel={districtLabelFor(item.district)}
              ageLabel={timeAgo(t, item.postedAt)}
              repliesCount={item.repliesCount || 0}
              isOwner={!!myId && item.seller.id === myId}
              isFavorited={item.isFavorited}
              onPress={() => onOpenListing(item.id)}
              onAction={() => onOpenListing(item.id)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
        />
      ) : (
        <FlatList
          key="selling"
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
              districtLabel={districtLabelFor(item.district)}
              status={item.status === 'reserved' ? 'reserved' : 'available'}
              isFavorited={item.isFavorited}
              deliveryAvailable={item.deliveryAvailable}
              onPress={() => onOpenListing(item.id)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.postBtn} onPress={() => onOpenPostAd(martType)}>
        <AppIcon icon={{ lib: 'ion', name: 'add' }} size={26} color="#fff" />
      </TouchableOpacity>

      <NameDistrictSheet
        visible={gateStep === 'nameDistrict'}
        token={token}
        onDone={checkGate}
        onClose={() => setGateStep(null)}
      />

      {gateStep === 'rules' ? (
        <Modal visible animationType="slide" onRequestClose={() => setGateStep(null)}>
          <MartRulesScreen mode="firstAction" token={token} onBack={() => setGateStep(null)} onAccepted={checkGate} />
        </Modal>
      ) : null}
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
    headerUnreadDot: {
      position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4,
      backgroundColor: c.error, borderWidth: 1.5, borderColor: '#fff',
    },

    typeSwitchWrap: { backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12 },
    typeSwitchTrack: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 3 },
    typeSwitchPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    typeSwitchPillActive: {
      backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    typeSwitchText: { fontSize: 13.5, fontWeight: '600', color: c.textMuted },
    typeSwitchTextActive: { color: c.text, fontWeight: '700' },

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

    // See the on-device fix notes above this row's JSX.
    chipStripWrap: { height: 44, marginBottom: 12, overflow: 'hidden', backgroundColor: c.surface },
    chipStripContent: { alignItems: 'center' },
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
    requestListContent: { paddingTop: 12, paddingBottom: 100, paddingHorizontal: 16, gap: 10 },

    postBtn: {
      position: 'absolute', right: 16, bottom: 84, width: 52, height: 52, borderRadius: 26,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
    },
  })
}
