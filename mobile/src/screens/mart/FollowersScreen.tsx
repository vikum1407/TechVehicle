import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { DISTRICTS } from '../../constants/districts'

// Added 2026-10-15, Vikum's request — not in the original handoff spec at all (no
// "Followers" screen, endpoint or count existed before this). Read-only mirror of
// FollowingsScreen's own row layout (04-screens.md §18), reversed to show who follows
// ME instead of who I follow — no "Following"/unfollow button, since that relationship
// isn't mine to control from this side.
export default function FollowersScreen({ token, onBack, onOpenSeller }: {
  token: string
  onBack: () => void
  onOpenSeller: (sellerId: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [items, setItems] = useState<any[]>([])
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
      const result = await api.getMartFollowers(token, opts.cursor)
      setItems(prev => (opts.cursor ? [...prev, ...result.items] : result.items))
      setNextCursor(result.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [token])
  useEffect(() => { load() }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'people-outline' }}
          title="No followers yet. Buyers who follow your shop will show up here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.seller.id}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => {
            const isShop = item.seller.tag === 'shop'
            const areaLabel = isShop
              ? item.townAddress
              : (item.seller.district ? DISTRICTS.find(d => d.id === item.seller.district)?.en : null)
            return (
              <TouchableOpacity style={styles.row} onPress={() => onOpenSeller(item.seller.id)}>
                {item.seller.photoUrl ? (
                  <Image source={{ uri: item.seller.photoUrl }} style={[styles.avatar, isShop && styles.avatarShop]} />
                ) : (
                  <View style={[styles.avatar, isShop && styles.avatarShop, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{(item.seller.name || '?')[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.seller.name}</Text>
                    <MartTag label={isShop ? 'Shop' : 'Casual seller'} variant="gray" />
                  </View>
                  {areaLabel ? <Text style={styles.areaText}>{areaLabel}</Text> : null}
                  {item.seller.rating.count > 0 ? (
                    <RatingBadge avg={item.seller.rating.avg} count={item.seller.rating.count} size="small" />
                  ) : null}
                </View>
                <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
              </TouchableOpacity>
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

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingVertical: 14, paddingHorizontal: 16,
    },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarShop: { borderRadius: 12 },
    avatarPlaceholder: { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: 14.5, fontWeight: '700', color: c.text, flexShrink: 1 },
    areaText: { fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 2 },
  })
}
