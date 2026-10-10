import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, Share, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { formatLKR, timeAgo } from '../../utils/martHelpers'
import { DISTRICTS } from '../../constants/districts'
import { STORE_URL } from '../../constants/appLinks'

type Tab = 'available' | 'reserved' | 'sold'

// Spec: 04-screens.md §7. Selling only — same reasoning as every step since 1.2 (no
// Selling|Wanted switch rendered; Wanted posting/browsing doesn't exist anywhere yet).
// "Mark Sold" and "Relist" are "Coming soon" (both need Milestone 2 Step 2.4); Mark
// Reserved/Available (Step 1.5's /status) and Delete (Step 1.5's DELETE) are real.
export default function MyAdsScreen({ token, onBack, onOpenPostAd, onOpenListing, onOpenEdit }: {
  token: string
  onBack: () => void
  onOpenPostAd: () => void
  onOpenListing: (id: string) => void
  onOpenEdit: (listing: any) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [tab, setTab] = useState<Tab>('available')
  const [items, setItems] = useState<any[]>([])
  const [counts, setCounts] = useState({ available: 0, reserved: 0, sold: 0 })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMyMartAds(token, { type: 'selling', tab, cursor: opts.cursor })
      setItems(prev => (opts.cursor ? [...prev, ...result.items] : result.items))
      setNextCursor(result.nextCursor)
      setCounts(result.counts as any)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [tab, token])

  useEffect(() => { load() }, [tab])

  const comingSoon = () => Alert.alert('Coming soon', 'This part of Vocksy Mart is still being built.')

  const changeStatus = async (listingId: string, status: 'available' | 'reserved') => {
    setBusyId(listingId)
    try {
      await api.setMartListingStatus(token, listingId, status)
      load()
    } catch (e: any) {
      Alert.alert('Couldn\'t update', e.message || 'Check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = (listingId: string) => {
    Alert.alert('Delete this ad?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => doDelete(listingId) },
    ])
  }
  const doDelete = async (listingId: string) => {
    setBusyId(listingId)
    try {
      await api.deleteMartListing(token, listingId)
      load()
    } catch (e: any) {
      Alert.alert('Couldn\'t delete', e.message || 'Check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const shareAd = (item: any) => {
    const districtLabel = DISTRICTS.find(d => d.id === item.district)?.en || item.district
    const priceText = item.price !== null ? formatLKR(item.price) : ''
    const message = [item.title, priceText, districtLabel].filter(Boolean).join(' • ') + ' — on Vocksy Mart' + (STORE_URL ? `\n${STORE_URL}` : '')
    Share.share({ message })
  }

  const openMenu = (item: any) => {
    Alert.alert(item.title, undefined, [
      { text: 'Edit', onPress: () => onOpenEdit(item) },
      { text: 'Share', onPress: () => shareAd(item) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const ageLabel = (item: any) => {
    if (item.status === 'sold') return `Sold ${timeAgo(t, item.statusChangedAt)}`
    if (item.status === 'reserved') return `Reserved ${timeAgo(t, item.statusChangedAt)}`
    return `Posted ${timeAgo(t, item.postedAt)}`
  }

  const emptyLabel = tab === 'available' ? 'You have no ads yet' : tab === 'reserved' ? 'No reserved ads' : 'No sold ads yet'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Ads</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabRow}>
        {([['available', 'Available', counts.available], ['reserved', 'Reserved', counts.reserved], ['sold', 'Sold', counts.sold]] as const).map(([key, label, count]) => (
          <TouchableOpacity key={key} style={styles.tabBtn} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label} ({count})</Text>
            {tab === key ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'pricetags-outline' }}
          title={emptyLabel}
          actionLabel={tab === 'available' ? 'Post your first ad' : undefined}
          onAction={tab === 'available' ? onOpenPostAd : undefined}
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
          renderItem={({ item }) => (
            <View style={[styles.card, tab === 'sold' && styles.cardFaded]}>
              <TouchableOpacity style={styles.cardTop} onPress={() => onOpenListing(item.id)}>
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={22} color={colors.textFaint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{item.price !== null ? formatLKR(item.price) : ''}</Text>
                  <Text style={styles.cardStats}>
                    {item.favoritesCount} saved · {item.chatsCount ?? 0} chats · {ageLabel(item)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openMenu(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppIcon icon={{ lib: 'ion', name: 'ellipsis-vertical' }} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                {tab === 'available' && (
                  <>
                    <TouchableOpacity style={styles.outlinedBtn} disabled={busyId === item.id} onPress={() => changeStatus(item.id, 'reserved')}>
                      <Text style={styles.outlinedBtnText}>Mark Reserved</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navyBtn} onPress={comingSoon}>
                      <Text style={styles.navyBtnText}>Mark Sold</Text>
                    </TouchableOpacity>
                  </>
                )}
                {tab === 'reserved' && (
                  <>
                    <TouchableOpacity style={styles.outlinedBtn} disabled={busyId === item.id} onPress={() => changeStatus(item.id, 'available')}>
                      <Text style={styles.outlinedBtnText}>Mark Available</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navyBtn} onPress={comingSoon}>
                      <Text style={styles.navyBtnText}>Mark Sold</Text>
                    </TouchableOpacity>
                  </>
                )}
                {tab === 'sold' && (
                  <>
                    <TouchableOpacity style={styles.outlinedBtn} onPress={comingSoon}>
                      <Text style={styles.outlinedBtnText}>Relist</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navyBtn} disabled={busyId === item.id} onPress={() => confirmDelete(item.id)}>
                      <Text style={styles.navyBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },

    tabRow: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 13.5, fontWeight: '600', color: c.textMuted },
    tabTextActive: { color: c.primary, fontWeight: '700' },
    tabUnderline: { height: 3, width: 28, backgroundColor: c.accent, borderRadius: 2, marginTop: 6 },

    listContent: { padding: 16, paddingBottom: 100, gap: 12 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 },
    cardFaded: { opacity: 0.75 },
    cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    thumb: { width: 72, height: 72, borderRadius: 10 },
    thumbPlaceholder: { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 13.5, fontWeight: '600', color: c.text },
    cardPrice: { fontSize: 14, fontWeight: '700', color: c.priceSmall, marginTop: 2 },
    cardStats: { fontSize: 11.5, color: c.textMuted, marginTop: 4 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    outlinedBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    outlinedBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    navyBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    navyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    postBtn: {
      position: 'absolute', right: 16, bottom: 84, width: 52, height: 52, borderRadius: 26,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
    },
  })
}
