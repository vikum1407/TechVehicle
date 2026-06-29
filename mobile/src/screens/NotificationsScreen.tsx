import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from 'react-native'
import { api } from '../config/api'

type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  linkTo: string | null
  read: boolean
  createdAt: string
}

type Props = {
  token: string
  onBack: () => void
  onNavigate: (linkTo: string | null) => void
  onMarkAllRead: (seenBookingIds: string[]) => void
  onSettings: () => void
}

const TYPE_ICON: Record<string, string> = {
  message: '💬',
  booking_confirmed: '✅',
  booking_reminder: '📅',
  booking_counter: '🔄',
  booking_counter_accepted: '✅',
  booking_counter_declined: '❌',
  booking_request: '📬',
  booking_cancelled: '🚫',
  mileage_reminder: '⛽',
  setup_reminder:   '🔧',
  service_reminder: '⚠️',
  submission: '📋',
  transfer: '🔑',
  transfer_accepted: '🏆',
  licence_reminder: '🚨',
  emission_reminder: '🚨',
}

const URGENT_TYPES = new Set(['licence_reminder', 'emission_reminder'])
const TRANSFER_TYPES = new Set(['transfer', 'transfer_accepted'])

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function NotificationsScreen({ token, onBack, onNavigate, onMarkAllRead, onSettings }: Props) {
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getNotifications(token)
      .then(data => setNotifs(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    // Mark all as read after a short delay so user sees the unread highlights first
    const t = setTimeout(() => {
      api.markAllNotifsRead(token)
        .then(() => {
          // Collect bookingIds from unread message notifications so card dots also clear
          const seenBookingIds = notifs
            .filter(n => !n.read && n.type === 'message' && n.linkTo)
            .map(n => { try { return JSON.parse(n.linkTo!).bookingId } catch { return null } })
            .filter((id): id is string => !!id)
          onMarkAllRead(seenBookingIds)
        })
        .catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [])

  const handleTap = (notif: AppNotification) => {
    onNavigate(notif.linkTo)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={onSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a73e8" style={{ marginTop: 60 }} />
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>Booking updates, messages, and transfers will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                URGENT_TYPES.has(item.type) ? styles.cardUrgent
                  : TRANSFER_TYPES.has(item.type) ? styles.cardTransfer
                  : (!item.read && styles.cardUnread),
              ]}
              onPress={() => handleTap(item)}
              activeOpacity={0.75}
            >
              <Text style={styles.cardIcon}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
              <View style={styles.cardBody}>
                <Text style={[
                  styles.cardTitle,
                  URGENT_TYPES.has(item.type) && styles.cardTitleUrgent,
                  TRANSFER_TYPES.has(item.type) && styles.cardTitleTransfer,
                ]}>
                  {item.title}
                </Text>
                <Text style={styles.cardText} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={[
                styles.unreadDot,
                URGENT_TYPES.has(item.type) && styles.unreadDotUrgent,
                TRANSFER_TYPES.has(item.type) && styles.unreadDotTransfer,
              ]} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { paddingRight: 12 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  settingsBtn: { paddingLeft: 12, width: 44, alignItems: 'flex-end' },
  settingsIcon: { fontSize: 20 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 4,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  cardUnread: { backgroundColor: '#e8f0fe' },
  cardUrgent: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4, borderLeftColor: '#e65100',
  },
  cardTitleUrgent: { color: '#c62828' },
  unreadDotUrgent: { backgroundColor: '#e65100' },
  cardTransfer: {
    backgroundColor: '#fffde7',
    borderLeftWidth: 4, borderLeftColor: '#f9a825',
  },
  cardTitleTransfer: { color: '#e65100' },
  unreadDotTransfer: { backgroundColor: '#f9a825' },
  cardIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  cardText: { fontSize: 13, color: '#555', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#aaa', marginTop: 5 },
  unreadDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#1a73e8', marginTop: 6, marginLeft: 8,
  },
})
