import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Image, TextInput, FlatList,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import { formatLKR } from '../../utils/martHelpers'
import NameDistrictSheet from './NameDistrictSheet'
import MartRulesScreen from './MartRulesScreen'
import RateSellerModal from './RateSellerModal'
import MartReportSheet from './MartReportSheet'
import MartBlockSheet from './MartBlockSheet'

const MESSAGE_MAX = 1000
const CLOSED_VISIBLE_DAYS = 7

// Spec: 04-screens.md §6. Two ways to arrive here: an existing thread (normal load), or
// a "draft" — Detail's "Message Seller" button when `myThreadId` was null, carrying the
// listing snapshot Detail already has so the pinned bar can render before any thread
// row exists. Sending from a draft calls POST /mart/threads (creating the thread and
// its first message atomically), then this screen transforms in place into thread mode
// — no separate navigation needed.
export type ChatThreadEntry =
  | { kind: 'thread'; threadId: string }
  | { kind: 'draft'; listingId: string; title: string; coverUrl: string | null; price: number | null; status: string; otherName: string; prefilledText: string }

export default function ChatThreadScreen({ token, entry, onBack, onOpenListing, onOpenSeller }: {
  token: string
  entry: ChatThreadEntry
  onBack: () => void
  onOpenListing: (id: string) => void
  onOpenSeller: (sellerId: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])
  const scrollRef = useRef<ScrollView>(null)

  const [threadId, setThreadId] = useState<string | null>(entry.kind === 'thread' ? entry.threadId : null)
  const [threadData, setThreadData] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [moreFromSeller, setMoreFromSeller] = useState<any[]>([])
  const [loading, setLoading] = useState(entry.kind === 'thread')
  const [loadError, setLoadError] = useState(false)
  const [composeText, setComposeText] = useState(entry.kind === 'draft' ? entry.prefilledText : '')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [gateStep, setGateStep] = useState<'nameDistrict' | 'rules' | null>(null)
  const [dealResponding, setDealResponding] = useState(false)
  const [rateModalOpen, setRateModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'listing' | 'wanted'; id: string } | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)

  const listingId = entry.kind === 'draft' ? entry.listingId : threadData?.listing.id

  const loadThread = async (id: string) => {
    setLoading(true); setLoadError(false)
    try {
      const result = await api.getMartThread(token, id)
      setThreadData(result.thread)
      setMessages([...result.messages].reverse())
      api.markMartThreadRead(token, id).catch(() => {})
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (entry.kind === 'thread') loadThread(entry.threadId)
  }, [])

  useEffect(() => {
    if (!listingId) return
    api.getMartMoreFromSeller(token, listingId).then(r => setMoreFromSeller(r.items)).catch(() => {})
  }, [listingId])

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
  }, [messages.length])


  // Spec: 04-screens.md §9.2. "Confirm purchase" normally opens the Rate modal (§9.3) —
  // that's Milestone 2 Step 2.5 (Ratings), not built yet, so this just confirms and
  // reloads; the banner disappears once dealState is no longer 'pending'. The "Rate
  // seller" fallback link it describes ("the buyer can rate later from the chat") is
  // stubbed below rather than wired, for the same reason.
  const handleDealConfirm = async (confirm: boolean) => {
    if (!threadId || !listingId) return
    setDealResponding(true)
    try {
      const result = await api.confirmMartDeal(token, listingId, confirm)
      await loadThread(threadId)
      // Spec: 04-screens.md §9.2 "Confirm purchase → opens 9.3 [the rate modal]" — opens
      // automatically right on confirm rather than needing a second tap on the "Rate
      // seller" link (which stays as the fallback entry point for rating later).
      if (confirm && result.canRate) setRateModalOpen(true)
    } catch (e: any) {
      Alert.alert(t('mart.thread.couldntConfirm'), e.message || t('mart.common.checkConnectionRetry'))
    } finally {
      setDealResponding(false)
    }
  }

  const handleSend = async () => {
    const text = composeText.trim()
    if (!text || sending) return
    setSending(true)
    setSendError('')
    try {
      if (!threadId) {
        const result = await api.openMartThread(token, (entry as any).listingId, text)
        setThreadId(result.threadId)
        setComposeText('')
        await loadThread(result.threadId)
      } else {
        const result = await api.sendMartMessage(token, threadId, text)
        setMessages(prev => [...prev, result.message])
        setComposeText('')
      }
    } catch (e: any) {
      if (e.code === 'PROFILE_REQUIRED') { setGateStep('nameDistrict'); return }
      if (e.code === 'RULES_REQUIRED') { setGateStep('rules'); return }
      setSendError(e.message || t('mart.thread.couldntSend'))
    } finally {
      setSending(false)
    }
  }

  const confirmDelete = () => {
    if (!threadId) return
    Alert.alert(
      t('mart.thread.deleteConversationConfirm'),
      t('mart.thread.deleteConversationBody', { name: otherName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: doDelete },
      ]
    )
  }
  const doDelete = async () => {
    if (!threadId) return
    try {
      await api.deleteMartThread(token, threadId)
      onBack()
    } catch (e: any) {
      Alert.alert(t('mart.detail.couldntDelete'), e.message || t('mart.common.checkConnectionRetry'))
    }
  }

  const openMenu = () => {
    // Spec: 04-screens.md §20.1 "Chat thread header... reports the user or the ad" —
    // two separate report targets reachable from this one entry point, not a single
    // generic "Report".
    Alert.alert('', undefined, [
      { text: t('mart.thread.reportUser'), onPress: () => setTimeout(() => setReportTarget({ type: 'user', id: otherId! }), 400) },
      { text: t('mart.thread.reportAd'), onPress: () => setTimeout(() => setReportTarget({ type: threadData?.listing.type === 'wanted' ? 'wanted' : 'listing', id: listingId! }), 400) },
      { text: t('mart.thread.blockUserMenu'), onPress: () => setTimeout(() => setBlockOpen(true), 400) },
      { text: t('mart.thread.deleteConversation'), style: 'destructive', onPress: confirmDelete },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  if (loading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator color={colors.primary} /></View>
  }
  if (loadError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{t('mart.home.loadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => threadId && loadThread(threadId)}>
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Spec parity with PostAdScreen's first-action gate (04-screens.md §22): sending a
  // message hits the same requireProfile/requireRules backend checks as posting an ad,
  // but unlike Post Ad this screen is reached from many places (not just one entry
  // point), so the gate is handled lazily here — only shown once a send actually fails
  // with PROFILE_REQUIRED/RULES_REQUIRED — rather than checked eagerly on every open.
  if (gateStep === 'rules') {
    return (
      <MartRulesScreen
        mode="firstAction"
        token={token}
        onBack={() => setGateStep(null)}
        onAccepted={() => { setGateStep(null); handleSend() }}
      />
    )
  }

  // Unified view of the pinned-bar fields, whichever mode we're in. `threadData.listing
  // .title` is already resolved server-side to the snapshot (if removed) or live title.
  const title = threadData ? threadData.listing.title : (entry as any).title
  const coverUrl = threadData ? threadData.listing.thumbUrl : (entry as any).coverUrl
  const price = threadData ? threadData.listing.price : (entry as any).price
  const rawStatus: string = threadData ? threadData.listing.status : (entry as any).status
  const removed = threadData ? threadData.listing.removed : false
  const closed = threadData ? threadData.listing.closed : false
  const otherName = threadData ? threadData.other.name : (entry as any).otherName
  const otherPhotoUrl = threadData ? threadData.other.photoUrl : null
  const otherId = threadData ? threadData.other.id : null
  const canSend = threadData ? threadData.canSend : true

  const daysLeft = (() => {
    if (!threadData) return null
    const ts = threadData.listing.removedAt || threadData.listing.closedAt
    if (!ts) return null
    const elapsedDays = (Date.now() - new Date(ts).getTime()) / (24 * 60 * 60 * 1000)
    return Math.max(0, Math.ceil(CLOSED_VISIBLE_DAYS - elapsedDays))
  })()

  return (
    <>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIdentityRow}
          disabled={!otherId}
          onPress={() => otherId && onOpenSeller(otherId)}
        >
          {otherPhotoUrl ? (
            <Image source={{ uri: otherPhotoUrl }} style={styles.headerAvatarImage} />
          ) : (
            <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{(otherName || '?')[0]}</Text></View>
          )}
          <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
        </TouchableOpacity>
        {threadId ? (
          <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppIcon icon={{ lib: 'ion', name: 'ellipsis-vertical' }} size={20} color={colors.text} />
          </TouchableOpacity>
        ) : <View style={{ width: 20 }} />}
      </View>

      <View style={styles.pinnedBar}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.pinnedThumb} />
        ) : (
          <View style={[styles.pinnedThumb, styles.pinnedThumbPlaceholder]}>
            <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={18} color={colors.textFaint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.pinnedTitle} numberOfLines={1}>{title}</Text>
          {removed ? (
            <Text style={styles.pinnedClosedText}>{t('mart.thread.listingRemovedCaps')}</Text>
          ) : rawStatus === 'sold' || rawStatus === 'fulfilled' ? (
            <Text style={styles.pinnedClosedText}>
              {/* The listing itself flips to sold/fulfilled the instant the seller marks
                  it — dealState stays 'pending' separately until the other side actually
                  confirms (and can even decline). Showing "SOLD" here while a confirm
                  action still sits right below it read as contradictory (Vikum's
                  feedback, 2026-10-16) — so only the deal thread itself shows "NEED TO
                  CONFIRM" while pending, "DECLINED" once declined (same contradiction,
                  found via a follow-up bug report — `status` stays sold/fulfilled forever
                  after a decline too, until Relist); every other (non-deal) thread on the
                  same ad still just says "SOLD". Uses `isDealThread`, not `iAmPartner` —
                  `iAmPartner` is only true for the chosen seller/buyer specifically, which
                  misses the listing OWNER's own view of this same thread on a Wanted ad
                  (the requester is isListingOwner, never iAmPartner, since dealPartnerPhone
                  there is the seller they picked, not themselves) — same directional bug
                  already hit once today in the inbox's own equivalent check. */}
              {threadData?.listing?.deal?.isDealThread && threadData?.listing?.deal?.state === 'pending'
                ? t('mart.thread.needToConfirmCaps')
                : threadData?.listing?.deal?.isDealThread && threadData?.listing?.deal?.state === 'declined'
                ? t('mart.thread.declinedCaps')
                : (rawStatus === 'fulfilled' ? t('mart.thread.fulfilledCaps') : t('mart.thread.soldCaps'))}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.pinnedPrice}>{price !== null ? formatLKR(price) : ''}</Text>
              {rawStatus === 'reserved' ? <MartTag label={t('mart.common.reserved')} variant="amber-soft" /> : null}
            </View>
          )}
        </View>
        {listingId ? (
          <TouchableOpacity style={[styles.viewAdBtn, removed && styles.viewAdBtnDisabled]} disabled={removed} onPress={() => onOpenListing(listingId)}>
            <Text style={[styles.viewAdBtnText, removed && styles.viewAdBtnTextDisabled]}>{t('mart.thread.viewAd')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {(removed || closed) && daysLeft !== null ? (
        <View style={styles.noticeBanner}>
          <AppIcon icon={{ lib: 'ion', name: 'information-circle-outline' }} size={16} color={colors.textMuted} />
          <Text style={styles.noticeText}>
            {removed
              ? t('mart.thread.noticeRemoved', { days: daysLeft })
              : rawStatus === 'fulfilled'
              ? t('mart.thread.noticeFulfilled', { days: daysLeft })
              : t('mart.thread.noticeSold', { days: daysLeft })}
          </Text>
        </View>
      ) : null}

      {threadData?.dealBanner === 'confirm_sale' ? (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmBannerText}>
            {threadData.listing.type === 'wanted' ? t('mart.thread.confirmYouSoldThis', { name: otherName }) : t('mart.thread.theyMarkedSoldToYou', { name: otherName })}
          </Text>
          <Text style={styles.confirmBannerSub}>{t('mart.thread.confirmingLetsYouReview')}</Text>
          <View style={styles.confirmBannerRow}>
            <TouchableOpacity style={styles.confirmOutlinedBtn} disabled={dealResponding} onPress={() => handleDealConfirm(false)}>
              <Text style={styles.confirmOutlinedBtnText}>{t('mart.thread.notMe')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmNavyBtn} disabled={dealResponding} onPress={() => handleDealConfirm(true)}>
              <Text style={styles.confirmNavyBtnText}>{threadData.listing.type === 'wanted' ? t('mart.thread.confirmSale') : t('mart.thread.confirmPurchase')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : threadData?.dealBanner === 'rate' ? (
        <TouchableOpacity style={styles.rateSellerLink} onPress={() => setRateModalOpen(true)}>
          <AppIcon icon={{ lib: 'ion', name: 'star-outline' }} size={14} color={colors.primary} />
          <Text style={styles.rateSellerLinkText}>{t('mart.thread.rateSeller')}</Text>
        </TouchableOpacity>
      ) : null}

      {moreFromSeller.length > 0 && threadData?.role !== 'selling' ? (
        <View style={styles.moreStripWrap}>
          <Text style={styles.moreStripLabel}>{t('mart.thread.moreFrom', { name: otherName?.toUpperCase() })}</Text>
          <FlatList
            horizontal showsHorizontalScrollIndicator={false}
            data={moreFromSeller}
            keyExtractor={i => i.id}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.moreCard} onPress={() => onOpenListing(item.id)}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.moreCardImage} /> : (
                  <View style={[styles.moreCardImage, styles.pinnedThumbPlaceholder]}>
                    <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={16} color={colors.textFaint} />
                  </View>
                )}
                <Text style={styles.morePrice}>{item.price !== null ? formatLKR(item.price) : ''}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.messagesContent}>
        {buildRenderItems(messages, t).map((item, i) => (
          item.type === 'day' ? (
            <View key={`day-${i}`} style={styles.daySeparatorWrap}><Text style={styles.daySeparatorText}>{item.label}</Text></View>
          ) : item.message.kind === 'system' ? (
            <View key={item.message.id} style={styles.systemLineWrap}><Text style={styles.systemLineText}>{item.message.body}</Text></View>
          ) : item.message.kind === 'offer' ? (
            <View key={item.message.id} style={[styles.bubbleWrap, item.message.mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
              <View style={[styles.offerCard, item.message.mine ? styles.bubbleMine : styles.bubbleOther]}>
                <View style={styles.offerHeaderRow}>
                  <AppIcon icon={{ lib: 'ion', name: 'pricetag' }} size={14} color={item.message.mine ? '#fff' : colors.accent} />
                  <Text style={[styles.offerHeaderText, item.message.mine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                    {item.message.offerPrice !== null ? t('mart.thread.offerPrice', { price: formatLKR(item.message.offerPrice) }) : t('mart.thread.sentAnOffer')}
                  </Text>
                </View>
                {item.message.offerPhotos && item.message.offerPhotos.length > 0 ? (
                  <View style={styles.offerPhotoStripWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {item.message.offerPhotos.map((url: string, pi: number) => (
                        <Image key={pi} source={{ uri: url }} style={styles.offerPhoto} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {item.message.body ? (
                  <Text style={item.message.mine ? styles.bubbleTextMine : styles.bubbleTextOther}>{item.message.body}</Text>
                ) : null}
              </View>
              <Text style={styles.bubbleTime}>{formatTime(item.message.createdAt)}</Text>
            </View>
          ) : (
            <View key={item.message.id} style={[styles.bubbleWrap, item.message.mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
              <View style={[styles.bubble, item.message.mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={item.message.mine ? styles.bubbleTextMine : styles.bubbleTextOther}>{item.message.body}</Text>
              </View>
              <Text style={styles.bubbleTime}>{formatTime(item.message.createdAt)}</Text>
            </View>
          )
        ))}
      </ScrollView>

      {canSend ? (
        <View style={styles.composeBar}>
          {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              placeholder={t('mart.thread.typeAMessage')}
              placeholderTextColor={colors.textFaint}
              value={composeText}
              onChangeText={v => setComposeText(v.slice(0, MESSAGE_MAX))}
              multiline
            />
            <TouchableOpacity style={[styles.sendBtn, (sending || !composeText.trim()) && styles.sendBtnDisabled]} disabled={sending || !composeText.trim()} onPress={handleSend}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <AppIcon icon={{ lib: 'ion', name: 'send' }} size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.closedBar}>
          <Text style={styles.closedBarText}>
            {removed
              ? t('mart.thread.closedRemoved')
              : rawStatus === 'fulfilled'
              ? t('mart.thread.closedFulfilled')
              : t('mart.thread.closedSold')}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>

    <NameDistrictSheet
      visible={gateStep === 'nameDistrict'}
      token={token}
      onDone={() => { setGateStep(null); handleSend() }}
      onClose={() => setGateStep(null)}
    />

    {listingId ? (
      <RateSellerModal
        visible={rateModalOpen}
        token={token}
        listingId={listingId}
        sellerName={otherName}
        onClose={() => setRateModalOpen(false)}
        onDone={() => { setRateModalOpen(false); if (threadId) loadThread(threadId) }}
      />
    ) : null}

    {reportTarget ? (
      <MartReportSheet
        visible
        token={token}
        targetType={reportTarget.type}
        targetId={reportTarget.id}
        onClose={() => setReportTarget(null)}
        onDone={() => setReportTarget(null)}
        onBlock={() => { setReportTarget(null); setBlockOpen(true) }}
      />
    ) : null}

    {otherId ? (
      <MartBlockSheet
        visible={blockOpen}
        token={token}
        sellerId={otherId}
        sellerName={otherName}
        onClose={() => setBlockOpen(false)}
        onDone={() => { setBlockOpen(false); onBack() }}
      />
    ) : null}
    </>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

function dayLabel(iso: string, t: (key: any, params?: Record<string, string | number>) => string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (dayKey(iso) === dayKey(today.toISOString())) return t('mart.thread.today')
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return t('notifications.yesterday')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

type RenderItem = { type: 'day'; label: string } | { type: 'message'; message: any }

function buildRenderItems(messages: any[], t: (key: any, params?: Record<string, string | number>) => string): RenderItem[] {
  const out: RenderItem[] = []
  let lastDay = ''
  for (const m of messages) {
    const day = dayKey(m.createdAt)
    if (day !== lastDay) {
      out.push({ type: 'day', label: dayLabel(m.createdAt, t) })
      lastDay = day
    }
    out.push({ type: 'message', message: m })
  }
  return out
}

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: 14, color: c.textMuted, marginBottom: 12 },
    retryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 12, paddingHorizontal: 16,
    },
    headerIdentityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    headerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
    headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    headerName: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text },

    pinnedBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    pinnedThumb: { width: 44, height: 44, borderRadius: 8 },
    pinnedThumbPlaceholder: { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    pinnedTitle: { fontSize: 13.5, fontWeight: '600', color: c.text },
    pinnedPrice: { fontSize: 13.5, fontWeight: '700', color: c.accent, marginTop: 2 },
    pinnedClosedText: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginTop: 2 },
    viewAdBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    viewAdBtnDisabled: { borderColor: c.borderStrong, opacity: 0.5 },
    viewAdBtnText: { color: c.primary, fontWeight: '700', fontSize: 12 },
    viewAdBtnTextDisabled: { color: c.textMuted },

    noticeBanner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, backgroundColor: c.surfaceAlt },
    noticeText: { flex: 1, fontSize: 12, color: c.textMuted },

    confirmBanner: { backgroundColor: c.accentTint, padding: 14 },
    confirmBannerText: { fontSize: 13.5, fontWeight: '700', color: c.accentTintText },
    confirmBannerSub: { fontSize: 12, color: c.accentTintText, marginTop: 2 },
    confirmBannerRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    confirmOutlinedBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
    confirmOutlinedBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    confirmNavyBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
    confirmNavyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    rateSellerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    rateSellerLinkText: { color: c.primary, fontWeight: '700', fontSize: 13 },

    moreStripWrap: { paddingTop: 10, paddingBottom: 6, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    moreStripLabel: { fontSize: 10.5, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6 },
    moreCard: { width: 80 },
    moreCardImage: { width: 80, height: 60, borderRadius: 8 },
    morePrice: { fontSize: 12, fontWeight: '700', color: c.accent, marginTop: 4 },

    messagesContent: { padding: 16, gap: 10 },
    daySeparatorWrap: { alignItems: 'center', marginVertical: 6 },
    daySeparatorText: { fontSize: 11, color: c.textMuted, backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    systemLineWrap: { alignItems: 'center' },
    systemLineText: { fontSize: 11, color: c.textMuted, backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    bubbleWrap: { maxWidth: '75%' },
    bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubbleWrapOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: { paddingHorizontal: 12, paddingVertical: 9 },
    bubbleMine: { backgroundColor: c.primary, borderRadius: 14, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: c.surfaceAlt, borderRadius: 14, borderBottomLeftRadius: 4 },
    bubbleTextMine: { color: '#fff', fontSize: 14 },
    bubbleTextOther: { color: c.text, fontSize: 14 },
    offerCard: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, maxWidth: 240 },
    offerHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    offerHeaderText: { fontSize: 14, fontWeight: '700' },
    offerPhotoStripWrap: { height: 64, overflow: 'hidden' },
    offerPhoto: { width: 64, height: 64, borderRadius: 8, marginRight: 6 },
    bubbleTime: { fontSize: 10.5, color: c.textFaint, marginTop: 3 },

    composeBar: { borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, padding: 10, paddingBottom: bottomInset + 10 },
    sendError: { fontSize: 12, color: c.error, marginBottom: 6 },
    composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    composeInput: {
      flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14, color: c.text, maxHeight: 100,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.5 },

    closedBar: { borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surfaceAlt, padding: 14, paddingBottom: bottomInset + 14, alignItems: 'center' },
    closedBarText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  })
}
