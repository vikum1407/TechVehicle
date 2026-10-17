import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import MartEmptyState from '../../components/mart/MartEmptyState'
import WhoBoughtItSheet from './WhoBoughtItSheet'
import { formatLKR, formatBudget, timeAgo } from '../../utils/martHelpers'
import { ChatThreadEntry } from './ChatThreadScreen'

// Spec: 04-screens.md §14.2. Entry: Wanted Detail's owner-only Offers banner. "Mark
// Fulfilled" (the "Who gave you the part?" flow) is real as of Step 2.4.
export default function OffersListScreen({
  token, listingId, title, budgetMin, budgetMax, onBack, onOpenThread,
}: {
  token: string
  listingId: string
  title: string
  budgetMin: number | null
  budgetMax: number | null
  onBack: () => void
  onOpenThread: (entry: ChatThreadEntry) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [items, setItems] = useState<any[]>([])
  const [closed, setClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [whoGaveItOpen, setWhoGaveItOpen] = useState(false)

  const load = async () => {
    setLoading(true); setError(false)
    try {
      const result = await api.getMartListingOffers(token, listingId)
      setItems(result.items)
      setClosed(result.closed)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [listingId])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.subHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.subBudget}>{formatBudget(t, budgetMin, budgetMax)}</Text>
        </View>
        {!closed && items.length > 0 ? (
          <TouchableOpacity style={styles.fulfilledBtn} onPress={() => setWhoGaveItOpen(true)}>
            <Text style={styles.fulfilledBtnText}>Mark Fulfilled</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={load} />
      ) : items.length === 0 ? (
        <MartEmptyState
          icon={{ lib: 'ion', name: 'pricetag-outline' }}
          title="No offers yet. Sellers who match your request will be notified."
        />
      ) : (
        <>
          <Text style={styles.countLabel}>{items.length} OFFER{items.length === 1 ? '' : 'S'}</Text>
          <FlatList
            data={items}
            keyExtractor={i => i.threadId}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  {item.photos.length > 0 ? (
                    <Image source={{ uri: item.photos[0] }} style={styles.photo} />
                  ) : (
                    <View style={[styles.photo, styles.photoPlaceholder]}>
                      <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={22} color={colors.textFaint} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.sellerRow}>
                      <Text style={styles.sellerName} numberOfLines={1}>{item.seller.name}</Text>
                      <Text style={styles.age}>{timeAgo(t, item.createdAt)}</Text>
                    </View>
                    <View style={styles.tagRatingRow}>
                      {item.seller.tag === 'shop' ? <MartTag label="Shop" variant="gray" /> : null}
                      <RatingBadge avg={item.seller.rating.avg} count={item.seller.rating.count} />
                    </View>
                    <Text style={styles.price}>{item.offerPrice !== null ? formatLKR(item.offerPrice) : 'No price given'}</Text>
                  </View>
                </View>
                {item.note ? <Text style={styles.note} numberOfLines={3}>{item.note}</Text> : null}
                <TouchableOpacity style={styles.openChatBtn} onPress={() => onOpenThread({ kind: 'thread', threadId: item.threadId })}>
                  <Text style={styles.openChatBtnText}>Open chat</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}

      <WhoBoughtItSheet
        visible={whoGaveItOpen}
        token={token}
        listingId={listingId}
        type="wanted"
        onClose={() => setWhoGaveItOpen(false)}
        onDone={() => { setWhoGaveItOpen(false); load() }}
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

    subHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface,
      borderBottomWidth: 1, borderBottomColor: c.border, padding: 16,
    },
    subTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    subBudget: { fontSize: 13, fontWeight: '700', color: c.accentTintText, marginTop: 2 },
    fulfilledBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    fulfilledBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },

    countLabel: { fontSize: 11.5, fontWeight: '700', color: c.textMuted, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    listContent: { padding: 16, paddingTop: 8, gap: 12 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 },
    cardTop: { flexDirection: 'row', gap: 12 },
    photo: { width: 72, height: 72, borderRadius: 10 },
    photoPlaceholder: { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    sellerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sellerName: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
    age: { fontSize: 11, color: c.textMuted },
    tagRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    price: { fontSize: 16, fontWeight: '700', color: c.accentTintText, marginTop: 6 },
    note: { fontSize: 12.5, color: c.textBody, marginTop: 10, lineHeight: 18 },
    openChatBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
    openChatBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
  })
}
