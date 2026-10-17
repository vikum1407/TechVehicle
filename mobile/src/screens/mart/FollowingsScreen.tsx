import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import MartEmptyState from '../../components/mart/MartEmptyState'
import MartToast from '../../components/mart/MartToast'
import { DISTRICTS } from '../../constants/districts'
import { localizedLabel } from '../../utils/martHelpers'

// Spec: 04-screens.md §18 "Followings — A Simple List". Milestone 2 Step 2.8. Tap a row
// to open the Seller Public Profile (section 16, built Step 2.7); tap "Following" to
// unfollow immediately with an optimistic fade + 4s "Undo" toast (MartToast, built empty
// in Step 0.10 specifically for this screen, wired to real data for the first time here).
export default function FollowingsScreen({ token, onBack, onOpenSeller }: {
  token: string
  onBack: () => void
  onOpenSeller: (sellerId: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [items, setItems] = useState<any[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const [toastVisible, setToastVisible] = useState(false)
  const [undo, setUndo] = useState<{ item: any; index: number } | null>(null)

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMartFollows(token, opts.cursor)
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

  const unfollow = (item: any, index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
    setUndo({ item, index })
    setToastVisible(true)
    api.unfollowMartSeller(token, item.seller.id).catch(() => {
      // Same fallback as Favorites' remove: stays removed from this list view even if
      // the request fails; the follow still exists server-side and reappears next load.
    })
  }

  const undoUnfollow = () => {
    if (!undo) return
    setItems(prev => {
      const next = [...prev]
      next.splice(Math.min(undo.index, next.length), 0, undo.item)
      return next
    })
    api.followMartSeller(token, undo.item.seller.id).catch(() => {})
    setUndo(null)
    setToastVisible(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mart.myMart.followings')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title={t('mart.home.loadError')} actionLabel={t('common.retry')} onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'people-outline' }}
          title={t('mart.followings.emptyTitle')}
        />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => i.seller.id}
            refreshing={refreshing}
            onRefresh={() => load({ isRefresh: true })}
            onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
            renderItem={({ item, index }) => {
              const isShop = item.seller.tag === 'shop'
              const areaLabel = isShop
                ? item.townAddress
                : (item.seller.district ? (() => { const d = DISTRICTS.find(x => x.id === item.seller.district); return d ? localizedLabel(language, d) : null })() : null)
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
                      <MartTag label={isShop ? t('mart.common.shop') : t('mart.common.casualSeller')} variant="gray" />
                    </View>
                    {areaLabel ? <Text style={styles.areaText}>{areaLabel}</Text> : null}
                    {item.seller.rating.count > 0 ? (
                      <RatingBadge avg={item.seller.rating.avg} count={item.seller.rating.count} size="small" />
                    ) : null}
                  </View>
                  <TouchableOpacity style={styles.followingBtn} onPress={() => unfollow(item, index)}>
                    <Text style={styles.followingBtnText}>{t('mart.common.following')}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            }}
          />
          <Text style={styles.footerHint}>{t('mart.followings.footerHint')}</Text>
        </>
      )}

      <MartToast
        visible={toastVisible}
        message={t('mart.followings.unfollowed')}
        actionLabel={t('mart.followings.undo')}
        onAction={undoUnfollow}
        onHide={() => { setToastVisible(false); setUndo(null) }}
      />
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

    followingBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    followingBtnText: { fontSize: 12.5, fontWeight: '700', color: c.primary },

    footerHint: { textAlign: 'center', fontSize: 11.5, color: c.textMuted, paddingVertical: 14 },
  })
}
