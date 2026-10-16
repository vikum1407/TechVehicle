import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { timeAgo } from '../../utils/martHelpers'

function defaultT(key: string, params?: Record<string, string | number>): string {
  if (key === 'notifications.justNow') return 'Just now'
  if (key === 'notifications.minsAgo') return `${params?.mins}m ago`
  if (key === 'notifications.hoursAgo') return `${params?.hrs}h ago`
  if (key === 'notifications.yesterday') return 'Yesterday'
  if (key === 'notifications.daysAgo') return `${params?.days} days ago`
  return ''
}

// Spec: 04-screens.md §20.3 "Blocked users list". Milestone 3 Step 3.2. No pagination —
// GET /mart/blocks has no cursor (a blocked list is expected to stay short). DECISION
// (overrides the mockup's own footer text, per the spec's own explicit note): chats DO
// reappear after unblock, follows do NOT — footer wording matches that, not the mockup.
export default function BlockedUsersScreen({ token, onBack }: {
  token: string
  onBack: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(false)
    try {
      const result = await api.getMartBlocks(token)
      setItems(result.items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const unblock = async (item: any) => {
    setBusyId(item.seller.id)
    const prev = items
    setItems(prevItems => prevItems.filter(i => i.seller.id !== item.seller.id))
    try {
      await api.deleteMartBlock(token, item.seller.id)
    } catch {
      setItems(prev)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={load} />
      ) : items.length === 0 ? (
        <MartEmptyState icon={{ lib: 'ion', name: 'person-remove-outline' }} title="You have not blocked anyone." />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => i.seller.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {item.seller.photoUrl ? (
                  <Image source={{ uri: item.seller.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarInitial}>{(item.seller.name || '?')[0]}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.seller.name}</Text>
                  <Text style={styles.blockedAt}>Blocked {timeAgo((k: any, p: any) => defaultT(k, p), item.blockedAt)}</Text>
                </View>
                <TouchableOpacity style={styles.unblockBtn} disabled={busyId === item.seller.id} onPress={() => unblock(item)}>
                  <Text style={styles.unblockBtnText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <Text style={styles.footerNote}>Unblocking brings back your chats, but not follows.</Text>
        </>
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
    avatar: { width: 42, height: 42, borderRadius: 21 },
    avatarPlaceholder: { backgroundColor: c.textMuted, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
    name: { fontSize: 14.5, fontWeight: '700', color: c.text },
    blockedAt: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    unblockBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    unblockBtnText: { fontSize: 12.5, fontWeight: '700', color: c.primary },

    footerNote: { textAlign: 'center', fontSize: 11.5, color: c.textMuted, paddingVertical: 16, paddingHorizontal: 24 },
  })
}
