import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, SectionList, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon, { AppIconSpec } from '../../components/AppIcon'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { timeAgo } from '../../utils/martHelpers'

const TYPE_ICON: Record<string, AppIconSpec> = {
  mart_message: { lib: 'ion', name: 'chatbubble-outline' },
  mart_sale_confirm: { lib: 'ion', name: 'checkmark' },
  mart_sale_confirmed: { lib: 'ion', name: 'checkmark-circle-outline' },
  mart_sale_declined: { lib: 'ion', name: 'close-circle-outline' },
  mart_wanted_match: { lib: 'ion', name: 'search-outline' },
  mart_rating: { lib: 'ion', name: 'star-outline' },
  mart_new_follower: { lib: 'ion', name: 'person-add-outline' },
  mart_new_ad: { lib: 'ion', name: 'pricetag-outline' },
  mart_report_threshold: { lib: 'ion', name: 'alert-circle-outline' },
}
const DEFAULT_ICON: AppIconSpec = { lib: 'ion', name: 'notifications-outline' }

// Spec: 04-screens.md §13 "Notification center — Grouped by Day". Milestone 2 Step 2.9.
// `onNavigate` is App.tsx's own `handleNotificationData` passed straight through — that
// function already takes a flat `{screen, threadId, listingId, ...}` object (the exact
// shape a parsed `linkTo` is) to dispatch a real push-notification tap, so this screen
// reuses it as-is instead of writing a third copy of that routing chain (the existing
// non-Mart NotificationsScreen's own `onNavigate` prop is the second one).
export default function NotificationCenterScreen({ token, onBack, onNavigate }: {
  token: string
  onBack: () => void
  onNavigate: (linkTo: any) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [items, setItems] = useState<any[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMartNotifications(token, opts.cursor)
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

  const markAllRead = async () => {
    if (markingAll) return
    setMarkingAll(true)
    setItems(prev => prev.map(i => ({ ...i, read: true })))
    try {
      await api.markMartNotificationsReadAll(token)
    } catch {
      // Same fallback philosophy as Favorites/Followings: stays marked read in this
      // view even if the request fails; a fresh load would just show the true state.
    } finally {
      setMarkingAll(false)
    }
  }

  const handleTap = (item: any) => {
    if (!item.read) {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, read: true } : i)))
      api.markMartNotificationRead(token, item.id).catch(() => {})
    }
    onNavigate(item.linkTo)
  }

  const hasUnread = items.some(i => !i.read)

  const sections = useMemo(() => {
    const todayStr = new Date().toDateString()
    const today = items.filter(i => new Date(i.createdAt).toDateString() === todayStr)
    const earlier = items.filter(i => new Date(i.createdAt).toDateString() !== todayStr)
    return [
      ...(today.length > 0 ? [{ title: t('mart.notifCenter.todayHeader'), data: today }] : []),
      ...(earlier.length > 0 ? [{ title: t('mart.notifCenter.earlierHeader'), data: earlier }] : []),
    ]
  }, [items, t])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mart.notifCenter.title')}</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.markAllText}>{t('mart.notifCenter.markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title={t('mart.home.loadError')} actionLabel={t('common.retry')} onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState icon={{ lib: 'ion', name: 'notifications-outline' }} title={t('mart.notifCenter.emptyTitle')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, !item.read && styles.cardUnread]} onPress={() => handleTap(item)}>
              <View style={styles.cardIcon}>
                <AppIcon icon={TYPE_ICON[item.type] || DEFAULT_ICON} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, item.read && styles.cardTitleRead]} numberOfLines={2}>{item.title}</Text>
                {item.body ? <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.cardTime}>{timeAgo(t, item.createdAt)}</Text>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
            </TouchableOpacity>
          )}
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
    markAllText: { fontSize: 13, fontWeight: '700', color: c.primary },

    listContent: { padding: 16, paddingTop: 8, gap: 10 },
    sectionHeader: { fontSize: 12, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },

    card: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12,
    },
    cardUnread: { backgroundColor: '#fffaf0', borderColor: '#f3dfae' },
    cardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 13.5, fontWeight: '700', color: c.text },
    cardTitleRead: { fontWeight: '600' },
    cardBody: { fontSize: 12.5, color: c.textMuted, marginTop: 3, lineHeight: 17 },
    cardTime: { fontSize: 11, color: c.textMuted },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  })
}
