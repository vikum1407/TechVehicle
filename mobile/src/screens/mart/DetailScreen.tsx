import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Image, FlatList, Share, Alert,
  ActivityIndicator, Dimensions, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import MartPhotoViewer from '../../components/mart/MartPhotoViewer'
import MartListingCard from '../../components/mart/MartListingCard'
import MartEmptyState from '../../components/mart/MartEmptyState'
import { formatLKR, timeAgo } from '../../utils/martHelpers'
import { DISTRICTS } from '../../constants/districts'
import { STORE_URL } from '../../constants/appLinks'

const W = Dimensions.get('window').width

// Spec: 04-screens.md §3. "Message Seller" (Chat, Step 1.8), Edit/Mark Sold (Step 1.5),
// Report (Step 3.1), Favorite persistence (Step 1.7) and Seller profile (Step 2.7) are
// all stubbed with a plain "Coming soon" alert, same reasoning as Mart Home (Step 1.3) —
// honest about nothing real happening there yet, rather than faking it.
export default function DetailScreen({ token, listingId, onBack, onOpenListing }: {
  token: string
  listingId: string
  onBack: () => void
  onOpenListing: (id: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [detail, setDetail] = useState<any | null>(null)
  const [similar, setSimilar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [networkError, setNetworkError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null)

  const load = async () => {
    setLoading(true); setNetworkError(false); setNotFound(false)
    try {
      const d = await api.getMartListingDetail(token, listingId)
      setDetail(d)
      api.getMartSimilarListings(token, listingId).then(r => setSimilar(r.items)).catch(() => {})
    } catch (e: any) {
      if (e.message && e.message.includes('no longer available')) setNotFound(true)
      else setNetworkError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [listingId])

  const comingSoon = () => Alert.alert('Coming soon', 'This part of Vocksy Mart is still being built.')

  const handleShare = () => {
    if (!detail) return
    const districtLabel = DISTRICTS.find(d => d.id === detail.district)?.en || detail.district
    const priceText = detail.price !== null ? formatLKR(detail.price) : ''
    const message = [detail.title, priceText, districtLabel].filter(Boolean).join(' • ') + ' — on Vocksy Mart' + (STORE_URL ? `\n${STORE_URL}` : '')
    Share.share({ message })
  }

  if (loading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator color={colors.primary} /></View>
  }
  if (notFound) {
    return (
      <View style={styles.container}>
        <MartEmptyState icon={{ lib: 'ion', name: 'alert-circle-outline' }} title="This ad is no longer available" actionLabel="Back" onAction={onBack} />
      </View>
    )
  }
  if (networkError || !detail) {
    return (
      <View style={styles.container}>
        <MartEmptyState isError title="Couldn't load. Check your connection." actionLabel="Try again" onAction={load} />
      </View>
    )
  }

  const statusTag = detail.status === 'sold'
    ? <MartTag label="Sold" variant="gray" />
    : detail.status === 'reserved'
    ? <MartTag label="Reserved" variant="amber-soft" />
    : <MartTag label="Available" variant="success-outline" />

  const districtLabel = DISTRICTS.find(d => d.id === detail.district)?.en || detail.district
  const sellerSub = [districtLabel, `${detail.seller.activeAdsCount} active ad${detail.seller.activeAdsCount === 1 ? '' : 's'}`].join(' • ')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon icon={{ lib: 'ion', name: 'share-outline' }} size={20} color={colors.text} />
          </TouchableOpacity>
          {!detail.isOwner && (
            <TouchableOpacity onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon icon={{ lib: detail.isFavorited ? 'ion' : 'ion', name: detail.isFavorited ? 'heart' : 'heart-outline' }} size={20} color={colors.accent} />
            </TouchableOpacity>
          )}
          {!detail.isOwner && (
            <TouchableOpacity onPress={comingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon icon={{ lib: 'ion', name: 'flag-outline' }} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.carouselWrap}>
          {detail.photoUrls.length > 0 ? (
            <FlatList
              data={detail.photoUrls}
              keyExtractor={(_, i) => String(i)}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.95} onPress={() => setPhotoViewerIndex(index)}>
                  <Image source={{ uri: item }} style={[styles.carouselImage, detail.status === 'sold' && styles.grayedImage]} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.carouselImage, styles.imagePlaceholder]}>
              <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={48} color={colors.textFaint} />
            </View>
          )}
          <View style={styles.statusPillWrap}>{statusTag}</View>
          {detail.photoUrls.length > 1 && (
            <View style={styles.dotsRow}>
              {detail.photoUrls.map((_: string, i: number) => (
                <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.infoBlock}>
          {detail.condition ? <MartTag label={detail.condition === 'new' ? 'New' : 'Used'} variant={detail.condition === 'new' ? 'amber-soft' : 'gray'} /> : null}
          <Text style={styles.price}>{detail.price !== null ? formatLKR(detail.price) : ''}</Text>
          <Text style={styles.title}>{detail.title}</Text>
          <View style={styles.metaRow}>
            <AppIcon icon={{ lib: 'ion', name: 'location-outline' }} size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{districtLabel} • Posted {timeAgo(t, detail.postedAt)}</Text>
          </View>
          {detail.deliveryAvailable ? (
            <View style={styles.metaRow}>
              <AppIcon icon={{ lib: 'ion', name: 'car-outline' }} size={13} color={colors.success} />
              <Text style={[styles.metaText, { color: colors.success }]}>Delivery available</Text>
            </View>
          ) : null}
          {detail.make ? (
            <View style={styles.chipRow}>
              <View style={styles.vehicleChip}><Text style={styles.vehicleChipText}>{detail.make}</Text></View>
              {detail.model ? <View style={styles.vehicleChip}><Text style={styles.vehicleChipText}>{detail.model}</Text></View> : null}
              {detail.yearFrom ? (
                <View style={styles.vehicleChip}>
                  <Text style={styles.vehicleChipText}>{detail.yearFrom}{detail.yearTo && detail.yearTo !== detail.yearFrom ? `–${detail.yearTo}` : ''}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {detail.description ? (
          <>
            <View style={styles.divider} />
            <View style={styles.infoBlock}>
              <Text style={styles.sectionHeading}>Description</Text>
              <Text style={styles.description}>{detail.description}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.divider} />
        <TouchableOpacity style={styles.sellerRow} onPress={comingSoon}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(detail.seller.name || '?')[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.sellerNameRow}>
              <Text style={styles.sellerName}>{detail.seller.name}</Text>
              {detail.seller.tag === 'shop' ? <MartTag label="Shop" variant="amber-solid" /> : null}
            </View>
            <Text style={styles.sellerSub}>{sellerSub}</Text>
            <RatingBadge avg={detail.seller.rating.avg} count={detail.seller.rating.count} />
          </View>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {similar.length > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.infoBlock}>
              <Text style={styles.sectionHeading}>Similar Parts</Text>
            </View>
            <FlatList
              horizontal showsHorizontalScrollIndicator={false}
              data={similar}
              keyExtractor={i => i.id}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              renderItem={({ item }) => (
                <View style={{ width: 128 }}>
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
                </View>
              )}
            />
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {detail.isOwner ? (
          <View style={styles.ownerBtnRow}>
            <TouchableOpacity style={styles.editBtn} onPress={comingSoon}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.markSoldBtn} onPress={comingSoon}>
              <Text style={styles.markSoldBtnText}>Mark Sold</Text>
            </TouchableOpacity>
          </View>
        ) : detail.status === 'sold' ? (
          <View style={styles.soldBar}><Text style={styles.soldBarText}>This item was sold</Text></View>
        ) : (
          <TouchableOpacity style={styles.messageBtn} onPress={comingSoon}>
            <AppIcon icon={{ lib: 'ion', name: 'chatbubble-outline' }} size={18} color="#fff" />
            <Text style={styles.messageBtnText}>Message Seller</Text>
          </TouchableOpacity>
        )}
      </View>

      <MartPhotoViewer
        visible={photoViewerIndex !== null}
        photos={detail.photoUrls}
        initialIndex={photoViewerIndex || 0}
        label={detail.title}
        onClose={() => setPhotoViewerIndex(null)}
      />
    </View>
  )
}

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 16,
    },
    headerIcons: { flexDirection: 'row', gap: 14 },

    carouselWrap: { height: 230, backgroundColor: c.surfaceAlt },
    carouselImage: { width: W, height: 230 },
    grayedImage: { opacity: 0.5 },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    statusPillWrap: { position: 'absolute', top: 12, left: 12 },
    dotsRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { backgroundColor: '#fff' },

    infoBlock: { padding: 16, gap: 6 },
    price: { fontSize: 22, fontWeight: '700', color: c.accent },
    title: { fontSize: 16, fontWeight: '700', color: c.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 12.5, color: c.textMuted },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    vehicleChip: { borderWidth: 1, borderColor: c.borderMid, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    vehicleChipText: { fontSize: 12, color: c.textBody, fontWeight: '600' },

    divider: { height: 1, backgroundColor: c.border },
    sectionHeading: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 6 },
    description: { fontSize: 13.5, color: c.textBody, lineHeight: 21 },

    sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sellerName: { fontSize: 14.5, fontWeight: '700', color: c.text },
    sellerSub: { fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 4 },

    bottomBar: { borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, padding: 16, paddingBottom: bottomInset + 16 },
    messageBtn: { flexDirection: 'row', gap: 8, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    messageBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    soldBar: { backgroundColor: c.surfaceAlt, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    soldBarText: { color: c.textMuted, fontWeight: '700', fontSize: 14.5 },
    ownerBtnRow: { flexDirection: 'row', gap: 10 },
    editBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    editBtnText: { color: c.primary, fontWeight: '700', fontSize: 15 },
    markSoldBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    markSoldBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  })
}
