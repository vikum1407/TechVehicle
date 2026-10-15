import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Image, FlatList, Linking, Share, Alert,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import MartListingCard from '../../components/mart/MartListingCard'
import MartEmptyState from '../../components/mart/MartEmptyState'
import ReviewsModal, { ReviewSummary, ReviewItem } from '../../components/mart/ReviewsModal'
import { DISTRICTS } from '../../constants/districts'
import { STORE_URL } from '../../constants/appLinks'
import { openPhone, openWhatsApp, timeAgo, memberSinceLabel } from '../../utils/martHelpers'

type ReviewsKind = 'parts' | 'service'
type ReviewRow = { id: string; rating: number; comment: string | null; createdAt: string; listingTitle?: string }

const EMPTY_DIST: Record<'5' | '4' | '3' | '2' | '1', number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }

// Spec: 04-screens.md §16 "Seller public profile (A for Shop, B for Casual)". One screen,
// layout switches on `seller.tag`. Reviews: Shop gets its own inline tab (same content as
// §17, no sheet — point 5, rendered by hand here since ReviewsModal is wrapped in its own
// bottom sheet shell); Casual has no tabs, so its rating badge and "See all" reuse the
// real ReviewsModal component instead (built in Step 0.10, never wired to real data until
// now) — this screen owns that sheet's state locally rather than threading it through
// every other screen that also shows a rating badge (Detail, My Mart, etc. are deliberately
// NOT wired to open a reviews sheet in this pass — flagged as a follow-up, not required by
// this step's own done-check).
export default function SellerProfileScreen({ token, sellerId, onBack, onOpenListing }: {
  token: string
  sellerId: string
  onBack: () => void
  onOpenListing: (id: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  const [tab, setTab] = useState<'ads' | 'reviews'>('ads')
  const [ads, setAds] = useState<any[]>([])
  const [adsCursor, setAdsCursor] = useState<string | null>(null)
  const [adsLoading, setAdsLoading] = useState(false)
  const [showAllAds, setShowAllAds] = useState(false)

  const [reviewsKind, setReviewsKind] = useState<ReviewsKind>('parts')
  const [reviewsLoadedKind, setReviewsLoadedKind] = useState<ReviewsKind | null>(null)
  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummary | null>(null)
  const [reviewsItems, setReviewsItems] = useState<ReviewRow[]>([])
  const [reviewsCursor, setReviewsCursor] = useState<string | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [casualPreviewReviews, setCasualPreviewReviews] = useState<ReviewRow[] | null>(null)
  const [reviewsSheetOpen, setReviewsSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false)
    try {
      const [profile, adsRes] = await Promise.all([
        api.getMartSeller(token, sellerId),
        api.getMartSellerListings(token, sellerId, { type: 'selling' }),
      ])
      setData(profile)
      setFollowing(profile.isFollowing)
      setAds(adsRes.items)
      setAdsCursor(adsRes.nextCursor)
      if (profile.seller.tag === 'casual') {
        api.getMartSellerReviews(token, sellerId, { kind: 'parts' })
          .then(r => setCasualPreviewReviews(r.items.slice(0, 2)))
          .catch(() => setCasualPreviewReviews([]))
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [token, sellerId])
  useEffect(() => { load() }, [load])

  const loadMoreAds = async () => {
    if (!adsCursor || adsLoading) return
    setAdsLoading(true)
    try {
      const r = await api.getMartSellerListings(token, sellerId, { type: 'selling', cursor: adsCursor })
      setAds(prev => [...prev, ...r.items])
      setAdsCursor(r.nextCursor)
    } finally {
      setAdsLoading(false)
    }
  }

  const toggleFavorite = async (item: any) => {
    const wasFavorited = item.isFavorited
    setAds(prev => prev.map(a => (a.id === item.id ? { ...a, isFavorited: !wasFavorited } : a)))
    try {
      if (wasFavorited) await api.unfavoriteMartListing(token, item.id)
      else await api.favoriteMartListing(token, item.id)
    } catch {
      setAds(prev => prev.map(a => (a.id === item.id ? { ...a, isFavorited: wasFavorited } : a)))
    }
  }

  const loadReviews = async (kind: ReviewsKind, cursor?: string, append = false) => {
    setReviewsLoading(true)
    try {
      const r = await api.getMartSellerReviews(token, sellerId, { kind, cursor })
      setReviewsSummary({ avg: r.summary.avg, count: r.summary.count, distribution: r.summary.distribution })
      setReviewsItems(prev => (append ? [...prev, ...r.items] : r.items))
      setReviewsCursor(r.nextCursor)
      setReviewsLoadedKind(kind)
    } catch {
      if (!append) { setReviewsSummary({ avg: null, count: 0, distribution: EMPTY_DIST }); setReviewsItems([]) }
    } finally {
      setReviewsLoading(false)
    }
  }
  useEffect(() => {
    if (tab === 'reviews' && reviewsLoadedKind !== reviewsKind) loadReviews(reviewsKind)
  }, [tab, reviewsKind])

  // Casual layout's rating badge / "See all" — reuses the real ReviewsModal sheet,
  // always kind 'parts' (a Casual-tagged user can never have a Garage, so there's no
  // service rating to switch to — getSellerTags() ties 'shop' to having a Garage).
  const openReviewsSheet = () => {
    setReviewsSheetOpen(true)
    if (reviewsLoadedKind !== 'parts') loadReviews('parts')
  }
  const reviewItemsForModal: ReviewItem[] = reviewsItems.map(r => ({
    id: r.id, rating: r.rating, comment: r.comment, timeAgoLabel: timeAgo((k: any, p: any) => defaultT(k, p), r.createdAt), listingTitle: r.listingTitle || '',
  }))

  const toggleFollow = async () => {
    if (followBusy) return
    setFollowBusy(true)
    const next = !following
    setFollowing(next)
    try {
      if (next) await api.followMartSeller(token, sellerId)
      else await api.unfollowMartSeller(token, sellerId)
    } catch {
      setFollowing(!next)
      Alert.alert('Something went wrong', 'Please try again.')
    } finally {
      setFollowBusy(false)
    }
  }

  // Showing a second Alert.alert from inside the first one's own onPress (Block/Report
  // here) can leave the native Android dialog stuck/unclosable — the first dialog's
  // dismiss animation and the second one's show call collide. Deferring the second call
  // past that animation (a standard RN/Android workaround) fixes it.
  const openMenu = () => {
    if (!data) return
    Alert.alert(data.seller.name, undefined, [
      { text: 'Share profile', onPress: shareProfile },
      { text: 'Block user', onPress: () => setTimeout(() => Alert.alert('Coming soon', 'Blocking is still being built.'), 400) },
      { text: 'Report user', onPress: () => setTimeout(() => Alert.alert('Coming soon', 'Reporting is still being built.'), 400) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }
  const shareProfile = () => {
    if (!data) return
    const message = `${data.seller.name} on Vocksy Mart` + (STORE_URL ? `\n${STORE_URL}` : '')
    Share.share({ message }).catch(() => {})
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.headerTitle}>Profile</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}><ActivityIndicator color={colors.primary} /></View>
      </View>
    )
  }
  if (notFound || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.headerTitle}>Profile</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}><Text style={styles.notAvailableText}>Not available</Text></View>
      </View>
    )
  }

  const { seller, shop, memberSince, stats, serviceRating, isMe, iBlockedThem } = data
  const isShop = seller.tag === 'shop'
  const districtLabel = seller.district ? DISTRICTS.find(d => d.id === seller.district)?.en : null
  const shopAreaLabel = shop?.townAddress || (shop?.district ? DISTRICTS.find(d => d.id === shop.district)?.en : null)

  const renderAdCard = (item: any, width?: number) => (
    <View key={item.id} style={width ? { width } : undefined}>
      <MartListingCard
        title={item.title} coverUrl={item.coverUrl} price={item.price} condition={item.condition}
        districtLabel={DISTRICTS.find(d => d.id === item.district)?.en || item.district}
        status={item.status === 'reserved' ? 'reserved' : 'available'}
        isFavorited={item.isFavorited} deliveryAvailable={item.deliveryAvailable}
        onPress={() => onOpenListing(item.id)}
        onToggleFavorite={() => toggleFavorite(item)}
      />
    </View>
  )

  if (showAllAds) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackBtn onBack={() => setShowAllAds(false)} colors={colors} />
          <Text style={styles.headerTitle} numberOfLines={1}>{seller.name}'s ads</Text>
          <View style={{ width: 22 }} />
        </View>
        {ads.length === 0 ? (
          <MartEmptyState icon={{ lib: 'ion', name: 'pricetags-outline' }} title="No ads right now" />
        ) : (
          <FlatList
            data={ads} keyExtractor={i => i.id} numColumns={2}
            columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.gridContent}
            onEndReached={() => { if (adsCursor && !adsLoading) loadMoreAds() }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={adsLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
            renderItem={({ item }) => renderAdCard(item)}
          />
        )}
      </View>
    )
  }

  const reviewRow = (r: ReviewRow) => (
    <View key={r.id} style={styles.reviewRow}>
      <View style={styles.reviewHeader}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3, 4, 5].map(i => <AppIcon key={i} icon={{ lib: 'ion', name: i <= r.rating ? 'star' : 'star-outline' }} size={12} color={colors.accent} />)}
        </View>
        <Text style={styles.reviewTime}>{timeAgo((k: any, p: any) => defaultT(k, p), r.createdAt)}</Text>
      </View>
      {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
      {r.listingTitle ? <Text style={styles.reviewFor}>For: {r.listingTitle}</Text> : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackBtn onBack={onBack} colors={colors} />
        <Text style={styles.headerTitle} numberOfLines={1}>{seller.name}</Text>
        {isMe ? <View style={{ width: 22 }} /> : (
          <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppIcon icon={{ lib: 'ion', name: 'ellipsis-horizontal' }} size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {iBlockedThem ? (
        <View style={styles.blockedBanner}><Text style={styles.blockedBannerText}>You've blocked this seller.</Text></View>
      ) : null}

      {isShop ? (
        <>
          <View style={styles.headerCard}>
            <View style={styles.shopTopRow}>
              {seller.photoUrl ? (
                <Image source={{ uri: seller.photoUrl }} style={styles.logo64} />
              ) : (
                <View style={[styles.logo64, styles.logoPlaceholder]}><Text style={styles.logoInitial}>{(seller.name || '?')[0]}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{seller.name}</Text>
                  <MartTag label="Shop" variant="amber-solid" />
                </View>
                {shopAreaLabel ? <Text style={styles.areaText}>{shopAreaLabel}</Text> : null}
                <View style={{ marginTop: 4, gap: 2 }}>
                  <RatingBadge avg={seller.rating.avg} count={seller.rating.count} label="Parts sales" onPress={() => setTab('reviews')} />
                  {serviceRating ? (
                    <RatingBadge avg={serviceRating.avg} count={serviceRating.count} label="Service" onPress={() => { setReviewsKind('service'); setTab('reviews') }} />
                  ) : null}
                </View>
              </View>
            </View>
            {!isMe ? <FollowBtn following={following} busy={followBusy} onPress={toggleFollow} colors={colors} styles={styles} /> : null}
            {shop?.contactPhone ? (
              <View style={styles.contactRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => openPhone(shop.contactPhone)}>
                  <AppIcon icon={{ lib: 'ion', name: 'call-outline' }} size={15} color={colors.primary} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => openWhatsApp(shop.contactPhone)}>
                  <AppIcon icon={{ lib: 'ion', name: 'logo-whatsapp' }} size={15} color={colors.primary} />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {shop?.about ? <Text style={styles.aboutText} numberOfLines={3}>{shop.about}</Text> : null}
            {(shop?.websiteUrl || shop?.googleMapsUrl) ? (
              <View style={styles.linksRow}>
                {shop.websiteUrl ? <Text style={styles.linkText} onPress={() => Linking.openURL(shop.websiteUrl)}>Website</Text> : null}
                {shop.googleMapsUrl ? <Text style={styles.linkText} onPress={() => Linking.openURL(shop.googleMapsUrl)}>Directions</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.tabsRow}>
            <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('ads')}>
              <Text style={[styles.tabText, tab === 'ads' && styles.tabTextActive]}>Ads {stats.activeAds}</Text>
              {tab === 'ads' ? <View style={styles.tabUnderline} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('reviews')}>
              <Text style={[styles.tabText, tab === 'reviews' && styles.tabTextActive]}>Reviews {stats.ratingCount}</Text>
              {tab === 'reviews' ? <View style={styles.tabUnderline} /> : null}
            </TouchableOpacity>
          </View>

          {tab === 'ads' ? (
            ads.length === 0 ? (
              <MartEmptyState icon={{ lib: 'ion', name: 'pricetags-outline' }} title="No ads right now" />
            ) : (
              <FlatList
                data={ads} keyExtractor={i => i.id} numColumns={2}
                columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.gridContent}
                onEndReached={() => { if (adsCursor && !adsLoading) loadMoreAds() }}
                onEndReachedThreshold={0.4}
                ListFooterComponent={adsLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
                renderItem={({ item }) => renderAdCard(item)}
              />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              {serviceRating ? (
                <View style={styles.segmentRow}>
                  <TouchableOpacity style={[styles.segmentBtn, reviewsKind === 'parts' && styles.segmentBtnActive]} onPress={() => setReviewsKind('parts')}>
                    <Text style={[styles.segmentText, reviewsKind === 'parts' && styles.segmentTextActive]}>Parts sales</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.segmentBtn, reviewsKind === 'service' && styles.segmentBtnActive]} onPress={() => setReviewsKind('service')}>
                    <Text style={[styles.segmentText, reviewsKind === 'service' && styles.segmentTextActive]}>Service</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {reviewsLoading && !reviewsSummary ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
              ) : reviewsSummary && reviewsSummary.count > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    <View style={styles.avgBlock}>
                      <Text style={styles.avgNumber}>{reviewsSummary.avg?.toFixed(1)}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(i => <AppIcon key={i} icon={{ lib: 'ion', name: i <= Math.round(reviewsSummary.avg || 0) ? 'star' : 'star-outline' }} size={14} color={colors.accent} />)}
                      </View>
                      <Text style={styles.summaryCount}>{reviewsSummary.count} reviews</Text>
                    </View>
                    <View style={styles.barsBlock}>
                      {(['5', '4', '3', '2', '1'] as const).map(k => {
                        const n = reviewsSummary.distribution[k] || 0
                        const pct = reviewsSummary.count > 0 ? n / reviewsSummary.count : 0
                        return (
                          <View key={k} style={styles.barRow}>
                            <Text style={styles.barLabel}>{k}</Text>
                            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct * 100}%` }]} /></View>
                            <Text style={styles.barCount}>{n}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                  {reviewsItems.map(reviewRow)}
                  {reviewsCursor ? (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={() => loadReviews(reviewsKind, reviewsCursor!, true)} disabled={reviewsLoading}>
                      <Text style={styles.loadMoreText}>{reviewsLoading ? 'Loading…' : 'Load more'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <MartEmptyState icon={{ lib: 'ion', name: 'star-outline' }} title="No reviews yet" />
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.casualHeader}>
            {seller.photoUrl ? (
              <Image source={{ uri: seller.photoUrl }} style={styles.avatar72} />
            ) : (
              <View style={[styles.avatar72, styles.logoPlaceholder]}><Text style={styles.avatarInitial}>{(seller.name || '?')[0]}</Text></View>
            )}
            <Text style={styles.name}>{seller.name}</Text>
            <View style={styles.chipsRow}>
              <MartTag label="Casual seller" variant="gray" />
              <Text style={styles.chipSep}>{districtLabel ? `${districtLabel} · ` : ''}{memberSinceLabel(memberSince)}</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <RatingBadge avg={seller.rating.avg} count={seller.rating.count} onPress={openReviewsSheet} />
            </View>
            {!isMe ? <FollowBtn following={following} busy={followBusy} onPress={toggleFollow} colors={colors} styles={styles} compact /> : null}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ads ({stats.activeAds})</Text>
            {ads.length > 3 ? <TouchableOpacity onPress={() => setShowAllAds(true)}><Text style={styles.seeAll}>See all</Text></TouchableOpacity> : null}
          </View>
          {ads.length === 0 ? (
            <MartEmptyState icon={{ lib: 'ion', name: 'pricetags-outline' }} title="No ads right now" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ads.slice(0, 3).map(item => renderAdCard(item, 128))}
            </ScrollView>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Reviews ({stats.ratingCount})</Text>
            {stats.ratingCount > 0 ? <TouchableOpacity onPress={openReviewsSheet}><Text style={styles.seeAll}>See all</Text></TouchableOpacity> : null}
          </View>
          {casualPreviewReviews === null ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : casualPreviewReviews.length === 0 ? (
            <MartEmptyState icon={{ lib: 'ion', name: 'star-outline' }} title="No reviews yet" />
          ) : (
            <View style={styles.reviewsPreviewCard}>
              {casualPreviewReviews.map(reviewRow)}
            </View>
          )}
        </ScrollView>
      )}

      <ReviewsModal
        visible={reviewsSheetOpen}
        onClose={() => setReviewsSheetOpen(false)}
        summary={reviewsSummary}
        items={reviewItemsForModal}
        loading={reviewsLoading}
        onLoadMore={() => { if (reviewsCursor && !reviewsLoading) loadReviews('parts', reviewsCursor, true) }}
      />
    </View>
  )
}

// timeAgo() expects the app's i18n `t` function; this screen doesn't have access to a
// translated-string context at the point reviewRow needs it, and review timestamps are
// a minor display detail, not user-facing copy requiring translation yet (Mart stays
// plain English until Step 3.7 per the established project-wide rule) — a tiny inline
// formatter fallback avoids threading `t` through just for this.
function defaultT(key: string, params?: Record<string, string | number>): string {
  if (key === 'notifications.justNow') return 'Just now'
  if (key === 'notifications.minsAgo') return `${params?.mins}m ago`
  if (key === 'notifications.hoursAgo') return `${params?.hrs}h ago`
  if (key === 'notifications.yesterday') return 'Yesterday'
  if (key === 'notifications.daysAgo') return `${params?.days} days ago`
  return ''
}

function BackBtn({ onBack, colors }: { onBack: () => void; colors: Colors }) {
  return (
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
    </TouchableOpacity>
  )
}

function FollowBtn({ following, busy, onPress, colors, styles, compact }: { following: boolean; busy: boolean; onPress: () => void; colors: Colors; styles: any; compact?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.followBtn, compact && styles.followBtnCompact, following && styles.followBtnActive]}
      onPress={onPress}
      disabled={busy}
    >
      <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>{following ? 'Following' : 'Follow'}</Text>
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centeredFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notAvailableText: { fontSize: 14, color: c.textMuted },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 16,
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: c.text, marginHorizontal: 10, textAlign: 'center' },
    body: { padding: 16, paddingBottom: 40 },

    blockedBanner: { backgroundColor: c.accentTint, padding: 10, alignItems: 'center' },
    blockedBannerText: { fontSize: 12.5, color: c.accentTintText, fontWeight: '600' },

    headerCard: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, padding: 16 },
    shopTopRow: { flexDirection: 'row', gap: 12 },
    logo64: { width: 64, height: 64, borderRadius: 14 },
    logoPlaceholder: { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    logoInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: 17, fontWeight: '700', color: c.text },
    areaText: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    followBtn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: c.primary, marginTop: 14 },
    followBtnCompact: { alignSelf: 'center', paddingHorizontal: 40, marginTop: 16 },
    followBtnActive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary },
    followBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    followBtnTextActive: { color: c.primary },

    contactRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    contactBtn: {
      flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 10,
    },
    contactBtnText: { fontSize: 13.5, fontWeight: '600', color: c.text },
    aboutText: { fontSize: 13, color: c.textBody, marginTop: 12, lineHeight: 19 },
    linksRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
    linkText: { fontSize: 12.5, color: c.primary, fontWeight: '600', textDecorationLine: 'underline' },

    tabsRow: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 14, fontWeight: '600', color: c.textMuted },
    tabTextActive: { color: c.primary, fontWeight: '700' },
    tabUnderline: { height: 3, backgroundColor: c.accent, width: 40, borderRadius: 2, marginTop: 6 },

    gridRow: { gap: 10, paddingHorizontal: 16 },
    gridContent: { paddingVertical: 14, gap: 10 },

    segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    segmentBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textBody },
    segmentTextActive: { color: '#fff' },

    summaryRow: { flexDirection: 'row', gap: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 8 },
    avgBlock: { alignItems: 'center', justifyContent: 'center' },
    avgNumber: { fontSize: 36, fontWeight: '700', color: c.text },
    summaryCount: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    barsBlock: { flex: 1, justifyContent: 'center', gap: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barLabel: { fontSize: 11, color: c.textMuted, width: 8 },
    barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: c.accent },
    barCount: { fontSize: 11, color: c.textMuted, width: 20, textAlign: 'right' },
    reviewRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reviewTime: { fontSize: 11, color: c.textMuted },
    reviewComment: { fontSize: 13, color: c.textBody, marginTop: 6, lineHeight: 18 },
    reviewFor: { fontSize: 11.5, color: c.textMuted, marginTop: 6 },
    loadMoreBtn: { alignItems: 'center', paddingVertical: 14 },
    loadMoreText: { fontSize: 13, fontWeight: '700', color: c.primary },

    casualHeader: { alignItems: 'center', paddingVertical: 10 },
    avatar72: { width: 72, height: 72, borderRadius: 36 },
    avatarInitial: { color: '#fff', fontSize: 26, fontWeight: '700' },
    chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    chipSep: { fontSize: 12, color: c.textMuted },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
    sectionTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    seeAll: { fontSize: 12.5, fontWeight: '600', color: c.primary },
    reviewsPreviewCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 },
  })
}
