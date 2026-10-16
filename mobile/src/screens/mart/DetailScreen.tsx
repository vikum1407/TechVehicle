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
import { formatLKR, formatBudget, timeAgo } from '../../utils/martHelpers'
import { DISTRICTS } from '../../constants/districts'
import { STORE_URL } from '../../constants/appLinks'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { ChatThreadEntry } from './ChatThreadScreen'
import OfferSheet from './OfferSheet'
import WhoBoughtItSheet from './WhoBoughtItSheet'
import MartReportSheet from './MartReportSheet'

const W = Dimensions.get('window').width

// Spec: 04-screens.md §3 (Selling) + §19 (Wanted, Milestone 2 Step 2.1) — one screen,
// branched on `detail.type === 'wanted'` since both are "A ListingDetail with a
// different top section" rather than two unrelated screens (shared header, carousel/
// photo strip, photo viewer, Favorite, Share, Edit). Edit (Step 1.5) opens the real
// posting screen, prefilled, via `onEdit`, now type-aware too. Favorite (Step 1.7) is
// real, on both the header heart and the Similar Parts strip (selling only — Wanted has
// no Similar section, per §19 not defining one and MartListingCard not fitting a request
// card's shape). "Message Seller"/"I have this" (needs Chat for selling, the Offer sheet
// for wanted — Step 2.2), "Mark Sold"/"Mark Fulfilled" (Step 2.4), Report (Step 3.1) and
// Seller profile (Step 2.7) are still stubbed with a plain "Coming soon" alert, same
// reasoning as Mart Home (Step 1.3) — honest about nothing real happening there yet. The
// owner "Offers banner" always shows the 0-offers empty state for the same reason
// (offersCount isn't computed until 2.2, same deferral pattern as Step 1.1's
// unreadThreads/Step 1.4's deal fields).
export default function DetailScreen({ token, listingId, onBack, onOpenListing, onEdit, onOpenThread, onOpenOffers, onOpenSeller }: {
  token: string
  listingId: string
  onBack: () => void
  onOpenListing: (id: string) => void
  onEdit: (listing: any) => void
  onOpenThread: (entry: ChatThreadEntry) => void
  onOpenOffers: (listingId: string, title: string, budgetMin: number | null, budgetMax: number | null) => void
  onOpenSeller: (sellerId: string) => void
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
  const [offerSheetOpen, setOfferSheetOpen] = useState(false)
  const [whoBoughtItOpen, setWhoBoughtItOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

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

  const toggleFavorite = async () => {
    if (!detail) return
    const wasFavorited = detail.isFavorited
    setDetail((prev: any) => ({ ...prev, isFavorited: !wasFavorited }))
    try {
      if (wasFavorited) await api.unfavoriteMartListing(token, detail.id)
      else await api.favoriteMartListing(token, detail.id)
    } catch {
      setDetail((prev: any) => ({ ...prev, isFavorited: wasFavorited }))
    }
  }

  const toggleSimilarFavorite = async (item: any) => {
    const wasFavorited = item.isFavorited
    setSimilar(prev => prev.map(i => (i.id === item.id ? { ...i, isFavorited: !wasFavorited } : i)))
    try {
      if (wasFavorited) await api.unfavoriteMartListing(token, item.id)
      else await api.favoriteMartListing(token, item.id)
    } catch {
      setSimilar(prev => prev.map(i => (i.id === item.id ? { ...i, isFavorited: wasFavorited } : i)))
    }
  }

  // 2026-10-16, Vikum's bug report: the owner's own bottom bar always showed Edit/Mark
  // Sold|Fulfilled, even on an already-closed ad (sold/fulfilled, including a declined
  // deal) — only MyAdsScreen's own Sold/Fulfilled tab had status-aware buttons; Detail's
  // bottom bar never checked `detail.status` for the owner case at all.
  const relist = async () => {
    if (!detail) return
    setActionBusy(true)
    try {
      await api.relistMartListing(token, detail.id)
      load()
    } catch (e: any) {
      Alert.alert("Couldn't relist", e.message || 'Check your connection and try again.')
    } finally {
      setActionBusy(false)
    }
  }
  const confirmDelete = () => {
    Alert.alert('Delete this ad?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }
  const doDelete = async () => {
    if (!detail) return
    setActionBusy(true)
    try {
      await api.deleteMartListing(token, detail.id)
      onBack()
    } catch (e: any) {
      Alert.alert("Couldn't delete", e.message || 'Check your connection and try again.')
      setActionBusy(false)
    }
  }

  const handleMessageSeller = () => {
    if (!detail) return
    if (detail.myThreadId) { onOpenThread({ kind: 'thread', threadId: detail.myThreadId }); return }
    onOpenThread({
      kind: 'draft', listingId: detail.id, title: detail.title, coverUrl: detail.photoUrls[0] || null,
      price: detail.price, status: detail.status, otherName: detail.seller.name,
      prefilledText: 'Hi, is this still available?',
    })
  }

  const handleShare = () => {
    if (!detail) return
    const districtLabel = DISTRICTS.find(d => d.id === detail.district)?.en || detail.district
    const priceText = detail.type === 'wanted' ? formatBudget(detail.budgetMin, detail.budgetMax) : (detail.price !== null ? formatLKR(detail.price) : '')
    const message = [detail.title, priceText, districtLabel].filter(Boolean).join(' • ') + ' — on Vocksy Mart' + (STORE_URL ? `\n${STORE_URL}` : '')
    Share.share({ message })
  }

  const categoryPathLabel = (categoryId: string, categoryTypeId: string | null) => {
    const cat = MART_CATEGORIES.find(c => c.id === categoryId)
    if (!cat) return ''
    const type = categoryTypeId ? cat.types.find(t => t.id === categoryTypeId) : null
    return type ? `${cat.en} › ${type.en}` : cat.en
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

  const isWanted = detail.type === 'wanted'

  const statusTag = detail.status === 'sold' || detail.status === 'fulfilled'
    ? <MartTag label={isWanted ? 'Fulfilled' : 'Sold'} variant="gray" />
    : detail.status === 'reserved'
    ? <MartTag label="Reserved" variant="amber-soft" />
    : <MartTag label="Available" variant="success-outline" />

  const districtLabel = DISTRICTS.find(d => d.id === detail.district)?.en || detail.district
  const sellerSub = [districtLabel, `${detail.seller.activeAdsCount} active ad${detail.seller.activeAdsCount === 1 ? '' : 's'}`].join(' • ')
  const vehicleSpecLabel = detail.make
    ? `${detail.make}${detail.model ? ` ${detail.model}` : ''}${detail.yearFrom ? ` ${detail.yearFrom}${detail.yearTo && detail.yearTo !== detail.yearFrom ? `–${detail.yearTo}` : ''}` : ''}`
    : 'Any'

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
            <TouchableOpacity onPress={toggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon icon={{ lib: 'ion', name: detail.isFavorited ? 'heart' : 'heart-outline' }} size={20} color={colors.accent} />
            </TouchableOpacity>
          )}
          {!detail.isOwner && (
            <TouchableOpacity onPress={() => setReportOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon icon={{ lib: 'ion', name: 'flag-outline' }} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {(!isWanted || detail.photoUrls.length > 0) ? (
          <View style={styles.carouselWrap}>
            {detail.photoUrls.length > 0 ? (
              <FlatList
                data={detail.photoUrls}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={() => setPhotoViewerIndex(index)}>
                    <Image source={{ uri: item }} style={[styles.carouselImage, (detail.status === 'sold' || detail.status === 'fulfilled') && styles.grayedImage]} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={[styles.carouselImage, styles.imagePlaceholder]}>
                <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={48} color={colors.textFaint} />
              </View>
            )}
            {!isWanted ? <View style={styles.statusPillWrap}>{statusTag}</View> : null}
            {detail.photoUrls.length > 1 && (
              <View style={styles.dotsRow}>
                {detail.photoUrls.map((_: string, i: number) => (
                  <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.infoBlock}>
          {isWanted ? (
            <>
              <View style={styles.chipRow}>
                <MartTag label="Wanted" variant="amber-soft" />
                {detail.status === 'fulfilled' ? <MartTag label="Fulfilled" variant="gray" /> : null}
                {detail.matchesYou && !detail.isOwner ? <MartTag label="Matches you" variant="amber-soft" /> : null}
                {detail.isOwner ? <MartTag label="Your request" variant="gray" /> : null}
              </View>
              <Text style={styles.metaText}>Posted {timeAgo(t, detail.postedAt)}</Text>
              <Text style={styles.title}>{detail.title}</Text>
              <Text style={styles.budgetLabel}>Budget</Text>
              <Text style={styles.price}>{formatBudget(detail.budgetMin, detail.budgetMax)}</Text>
            </>
          ) : (
            <>
              {detail.condition ? <MartTag label={detail.condition === 'new' ? 'New' : 'Used'} variant={detail.condition === 'new' ? 'amber-soft' : 'gray'} /> : null}
              <Text style={styles.price}>{detail.price !== null ? formatLKR(detail.price) : ''}</Text>
              <Text style={styles.title}>{detail.title}</Text>
              <View style={styles.metaRow}>
                <AppIcon icon={{ lib: 'ion', name: 'location-outline' }} size={13} color={colors.textMuted} />
                <Text style={styles.metaText}>{districtLabel} • Posted {timeAgo(t, detail.postedAt)}</Text>
              </View>
              {detail.deliveryAvailable ? (
                <View style={styles.metaRow}>
                  <AppIcon icon={{ lib: 'mci', name: 'truck-delivery-outline' }} size={14} color={colors.success} />
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
            </>
          )}
        </View>

        {isWanted ? (
          <>
            <View style={styles.divider} />
            <View style={styles.infoBlock}>
              <View style={styles.specRow}><Text style={styles.specLabel}>Category</Text><Text style={styles.specValue}>{categoryPathLabel(detail.categoryId, detail.categoryTypeId)}</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>Vehicle</Text><Text style={styles.specValue}>{vehicleSpecLabel}</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>Condition</Text><Text style={styles.specValue}>Either</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>District</Text><Text style={styles.specValue}>{districtLabel}</Text></View>
            </View>
          </>
        ) : null}

        {isWanted && detail.isOwner ? (
          <View style={styles.infoBlock}>
            {detail.offersCount > 0 ? (
              <TouchableOpacity
                style={styles.offersBanner}
                onPress={() => onOpenOffers(detail.id, detail.title, detail.budgetMin, detail.budgetMax)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.offersBannerText}>{detail.offersCount} offer{detail.offersCount === 1 ? '' : 's'} received</Text>
                  {detail.newOffersCount > 0 ? <Text style={styles.offersBannerSub}>{detail.newOffersCount} new · tap to view</Text> : null}
                </View>
                <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={18} color={colors.accentTintText} />
              </TouchableOpacity>
            ) : (
              <View style={styles.offersBannerEmpty}><Text style={styles.offersBannerEmptyText}>No offers yet</Text></View>
            )}
          </View>
        ) : null}

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
        <TouchableOpacity style={styles.sellerRow} onPress={() => onOpenSeller(detail.seller.id)}>
          {detail.seller.photoUrl ? (
            <Image source={{ uri: detail.seller.photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{(detail.seller.name || '?')[0]}</Text></View>
          )}
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

        {!isWanted && similar.length > 0 ? (
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
                    deliveryAvailable={item.deliveryAvailable}
                    onPress={() => onOpenListing(item.id)}
                    onToggleFavorite={() => toggleSimilarFavorite(item)}
                  />
                </View>
              )}
            />
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {detail.isOwner && (detail.status === 'sold' || detail.status === 'fulfilled') ? (
          <View style={styles.ownerBtnRow}>
            <TouchableOpacity style={styles.editBtn} disabled={actionBusy} onPress={relist}>
              <Text style={styles.editBtnText}>Relist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.markSoldBtn} disabled={actionBusy} onPress={confirmDelete}>
              <Text style={styles.markSoldBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : detail.isOwner ? (
          <View style={styles.ownerBtnRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(detail)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.markSoldBtn} onPress={() => setWhoBoughtItOpen(true)}>
              <Text style={styles.markSoldBtnText}>{isWanted ? 'Mark Fulfilled' : 'Mark Sold'}</Text>
            </TouchableOpacity>
          </View>
        ) : isWanted ? (
          detail.status === 'fulfilled' ? (
            <View style={styles.soldBar}><Text style={styles.soldBarText}>This request is closed</Text></View>
          ) : (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => (detail.myOfferThreadId ? onOpenThread({ kind: 'thread', threadId: detail.myOfferThreadId }) : setOfferSheetOpen(true))}
            >
              <Text style={styles.messageBtnText}>I have this</Text>
            </TouchableOpacity>
          )
        ) : detail.status === 'sold' ? (
          <View style={styles.soldBar}><Text style={styles.soldBarText}>This item was sold</Text></View>
        ) : (
          <TouchableOpacity style={styles.messageBtn} onPress={handleMessageSeller}>
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

      {isWanted ? (
        <OfferSheet
          visible={offerSheetOpen}
          token={token}
          listingId={detail.id}
          title={detail.title}
          districtLabel={districtLabel}
          ownerName={detail.seller.name}
          budgetMin={detail.budgetMin}
          budgetMax={detail.budgetMax}
          onClose={() => setOfferSheetOpen(false)}
          onSent={threadId => { setOfferSheetOpen(false); onOpenThread({ kind: 'thread', threadId }) }}
        />
      ) : null}

      {detail.isOwner ? (
        <WhoBoughtItSheet
          visible={whoBoughtItOpen}
          token={token}
          listingId={detail.id}
          type={isWanted ? 'wanted' : 'selling'}
          onClose={() => setWhoBoughtItOpen(false)}
          onDone={() => { setWhoBoughtItOpen(false); load() }}
        />
      ) : null}

      <MartReportSheet
        visible={reportOpen}
        token={token}
        targetType={isWanted ? 'wanted' : 'listing'}
        targetId={detail.id}
        onClose={() => setReportOpen(false)}
        onDone={() => setReportOpen(false)}
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
    budgetLabel: { fontSize: 12, color: c.textMuted, marginTop: 6 },
    specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    specLabel: { fontSize: 13, color: c.textMuted },
    specValue: { fontSize: 13, fontWeight: '600', color: c.textBody, flexShrink: 1, textAlign: 'right' },
    offersBannerEmpty: { backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 14, alignItems: 'center' },
    offersBanner: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.accentTint,
      borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 14,
    },
    offersBannerText: { fontSize: 13.5, fontWeight: '700', color: c.accentTintText },
    offersBannerSub: { fontSize: 12, color: c.accentTintText, marginTop: 2 },
    offersBannerEmptyText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
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
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
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
