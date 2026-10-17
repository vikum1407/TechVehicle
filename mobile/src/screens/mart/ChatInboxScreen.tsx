import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { timeAgo } from '../../utils/martHelpers'

// Spec: 04-screens.md §5. Selling/Wanted "role" filter exists in the API but the inbox
// here shows everything (role=all) — there's no Selling|Wanted switch anywhere else in
// the app yet (Wanted is Milestone 2), so a role filter chip would have nothing
// meaningful to split on until then.
export default function ChatInboxScreen({ token, onBack, onOpenThread }: {
  token: string
  onBack: () => void
  onOpenThread: (threadId: string) => void
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

  const load = useCallback(async (opts: { cursor?: string; isRefresh?: boolean } = {}) => {
    if (opts.cursor) setLoadingMore(true)
    else if (opts.isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const result = await api.getMartThreads(token, { cursor: opts.cursor })
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
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{t('mart.inbox.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('mart.inbox.subtitle')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title={t('mart.home.loadError')} actionLabel={t('common.retry')} onAction={() => load()} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'chatbubble-outline' }}
          title={t('mart.inbox.emptyTitle')}
          actionLabel={t('mart.favorites.browseMart')}
          onAction={onBack}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          refreshing={refreshing}
          onRefresh={() => load({ isRefresh: true })}
          onEndReached={() => { if (nextCursor && !loadingMore) load({ cursor: nextCursor }) }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => {
            const closed = item.listing.status !== 'active'
            const needsConfirm = closed && item.listing.dealStatus === 'pending'
            const declined = closed && item.listing.dealStatus === 'declined'
            const tagLabel = item.listing.status === 'removed' ? t('mart.common.removed') : needsConfirm ? t('mart.inbox.needToConfirm') : declined ? t('mart.inbox.declined') : t('mart.common.sold')
            const closedLabel = item.listing.status === 'removed' ? t('mart.inbox.listingRemoved') : tagLabel
            return (
              <TouchableOpacity style={styles.row} onPress={() => onOpenThread(item.id)}>
                {item.listing.thumbUrl ? (
                  <Image source={{ uri: item.listing.thumbUrl }} style={[styles.thumb, closed && styles.thumbGray]} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={18} color={colors.textFaint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, closed && styles.textGray]} numberOfLines={1}>{item.listing.title}</Text>
                    <Text style={styles.time}>{timeAgo(t, item.lastMessageAt)}</Text>
                  </View>
                  <Text style={styles.otherName} numberOfLines={1}>{item.other.name}</Text>
                  {closed ? (
                    <View style={styles.previewRow}>
                      <MartTag label={tagLabel} variant="gray" />
                      <Text style={styles.previewGray} numberOfLines={1}> {t('mart.inbox.closedDaysLeft', { label: closedLabel })}</Text>
                    </View>
                  ) : (
                    <View style={styles.previewRow}>
                      <Text style={[styles.preview, item.unread && styles.previewUnread]} numberOfLines={1}>{item.lastMessagePreview}</Text>
                      {item.unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                  )}
                </View>
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
    container: { flex: 1, backgroundColor: c.surface },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: topInset + 12, paddingBottom: 16, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.primary },
    headerSubtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    divider: { height: 1, backgroundColor: c.border, marginLeft: 16 },
    row: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
    thumb: { width: 44, height: 44, borderRadius: 8 },
    thumbGray: { opacity: 0.5 },
    thumbPlaceholder: { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    title: { flex: 1, fontSize: 13.5, fontWeight: '700', color: c.text },
    textGray: { color: c.textMuted },
    time: { fontSize: 11, color: c.textMuted },
    otherName: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
    previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 },
    preview: { flex: 1, fontSize: 13, color: c.textMuted },
    previewUnread: { color: c.text, fontWeight: '700' },
    previewGray: { fontSize: 12, color: c.textFaint, flexShrink: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  })
}
