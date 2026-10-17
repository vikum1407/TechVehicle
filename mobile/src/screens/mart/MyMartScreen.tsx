import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon, { AppIconSpec } from '../../components/AppIcon'
import MartTag from '../../components/mart/MartTag'
import RatingBadge from '../../components/mart/RatingBadge'
import { openWhatsApp, localizedLabel } from '../../utils/martHelpers'
import { DISTRICTS } from '../../constants/districts'
import MartRulesScreen from './MartRulesScreen'
import DeleteAccountSheet from './DeleteAccountSheet'

// Spec: 04-screens.md §8 + §20. Edit opens the full MartEditProfileScreen (name,
// district, profile photo) for non-shop users — Step 3.4 replaced the
// name-and-district-only NameDistrictSheet this screen used before that step was
// built. "Delete my account" (also Step 3.4) lives in the ABOUT group below, as its
// own row, rather than nested inside Edit — Edit branches by tag (shop users go to
// ShopProfileScreen instead), so a row inside MartEditProfileScreen would be
// unreachable for Shop-tagged sellers. Favorites (Step 1.7) and Followings (Step 2.8)
// open real screens now; Reviews stays "Coming soon" — no dedicated "my own reviews"
// screen exists yet (Step 2.7 built the Seller Public Profile's reviews, not a
// standalone "my reviews" list).
//
// "Mart rules" row added later (found missing while answering a question about it):
// 04-screens.md §20.4 names "My Mart > Mart rules (read only)" as this screen's own
// explicit second entry point into MartRulesScreen, alongside the first-action gate —
// it was never wired in when My Mart itself was built, so there was no way to review
// the rules again after accepting them once.
export default function MyMartScreen({ token, onBack, onOpenMyAds, onOpenFavorites, onOpenShopProfile, onOpenFollowings, onOpenFollowers, onOpenBlockedUsers, onOpenEditProfile, onAccountDeleted }: {
  token: string
  onBack: () => void
  onOpenMyAds: () => void
  onOpenFavorites: () => void
  onOpenShopProfile: () => void
  onOpenFollowings: () => void
  onOpenFollowers: () => void
  onOpenBlockedUsers: () => void
  onOpenEditProfile: () => void
  onAccountDeleted: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [me, setMe] = useState<any | null>(null)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rulesVisible, setRulesVisible] = useState(false)
  const [deleteVisible, setDeleteVisible] = useState(false)

  const load = async () => {
    setLoading(true); setError(false)
    try {
      const [meData, config] = await Promise.all([api.getMartMe(token), api.getAppConfig(token)])
      setMe(meData)
      setWhatsapp(config.martSupportWhatsapp)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const comingSoon = () => Alert.alert(t('mart.myMart.comingSoonTitle'), t('mart.myMart.comingSoonMessage'))

  if (loading) return <View style={[styles.container, styles.centered]}><ActivityIndicator color={colors.primary} /></View>
  if (error || !me) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.headerTitle}>{t('mart.myMart.title')}</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}>
          <Text style={styles.errorText}>{t('mart.home.loadError')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}><Text style={styles.retryBtnText}>{t('common.retry')}</Text></TouchableOpacity>
        </View>
      </View>
    )
  }

  const meDistrict = me.district ? DISTRICTS.find(d => d.id === me.district) : null
  const districtLabel = meDistrict ? localizedLabel(language, meDistrict) : null
  const tagLabel = me.tag === 'shop' ? t('mart.common.shop') : t('mart.common.casualSeller')

  const activityRows: { icon: AppIconSpec; label: string; sub: string; onPress: () => void }[] = [
    {
      icon: { lib: 'ion', name: 'pricetags-outline' }, label: t('mart.myAds.title'),
      sub: t('mart.myMart.myAdsSub', { available: me.counts.available, reserved: me.counts.reserved, sold: me.counts.sold }),
      onPress: onOpenMyAds,
    },
    { icon: { lib: 'ion', name: 'heart-outline' }, label: t('mart.favorites.title'), sub: t('mart.myMart.favoritesSub', { count: me.counts.favorites }), onPress: onOpenFavorites },
    { icon: { lib: 'ion', name: 'people-outline' }, label: t('mart.myMart.followings'), sub: t('mart.myMart.followingsSub', { count: me.counts.followings }), onPress: onOpenFollowings },
    { icon: { lib: 'ion', name: 'person-add-outline' }, label: t('mart.myMart.followers'), sub: t('mart.myMart.followersSub', { count: me.counts.followers }), onPress: onOpenFollowers },
    {
      icon: { lib: 'ion', name: 'star-outline' }, label: t('mart.myMart.reviews'),
      sub: me.counts.reviews > 0 ? t('mart.myMart.reviewsSub', { count: me.counts.reviews }) : t('mart.myMart.reviewsSubEmpty'),
      onPress: comingSoon,
    },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackBtn onBack={onBack} colors={colors} />
        <Text style={styles.headerTitle}>{t('mart.myMart.title')}</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identityCard}>
          <View style={styles.avatarRow}>
            {me.photoUrl ? (
              <Image source={{ uri: me.photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{(me.displayName || '?')[0]}</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{me.displayName || t('mart.myMart.vocksyUser')}</Text>
              <View style={styles.tagRow}>
                <MartTag label={tagLabel} variant="gray" />
                {districtLabel ? <Text style={styles.districtText}>· {districtLabel}</Text> : null}
              </View>
              <RatingBadge avg={me.rating.avg} count={me.rating.count} label={t('mart.common.partsSales')} />
              {me.serviceRating ? <RatingBadge avg={me.serviceRating.avg} count={me.serviceRating.count} label={t('mart.common.service')} /> : null}
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => (me.tag === 'shop' ? onOpenShopProfile() : onOpenEditProfile())}>
            <Text style={styles.editBtnText}>{t('common.edit')}</Text>
          </TouchableOpacity>
        </View>

        {me.tag !== 'shop' ? (
          <View style={styles.hintRow}>
            <AppIcon icon={{ lib: 'ion', name: 'storefront-outline' }} size={16} color={colors.primary} />
            <Text style={styles.hintText}>
              {t('mart.myMart.shopHint')}
            </Text>
          </View>
        ) : null}

        <Text style={styles.groupLabel}>{t('mart.myMart.myActivity')}</Text>
        <View style={styles.groupCard}>
          {activityRows.map((row, i) => (
            <TouchableOpacity key={row.label} style={[styles.row, i > 0 && styles.rowDivider]} onPress={row.onPress}>
              <View style={styles.rowIconTile}><AppIcon icon={row.icon} size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowSub}>{row.sub}</Text>
              </View>
              <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {whatsapp ? (
          <>
            <Text style={styles.groupLabel}>{t('mart.myMart.help')}</Text>
            <View style={styles.groupCard}>
              <TouchableOpacity style={styles.row} onPress={() => openWhatsApp(whatsapp)}>
                <View style={styles.rowIconTile}><AppIcon icon={{ lib: 'ion', name: 'logo-whatsapp' }} size={18} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t('mart.myMart.customerService')}</Text>
                  <Text style={styles.rowSub}>{t('mart.myMart.chatOnWhatsapp')}</Text>
                </View>
                <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {me.counts.blocked > 0 ? (
          <>
            <Text style={styles.groupLabel}>{t('mart.myMart.privacy')}</Text>
            <View style={styles.groupCard}>
              <TouchableOpacity style={styles.row} onPress={onOpenBlockedUsers}>
                <View style={styles.rowIconTile}><AppIcon icon={{ lib: 'ion', name: 'person-remove-outline' }} size={18} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t('mart.myMart.blockedUsers')}</Text>
                  <Text style={styles.rowSub}>{t('mart.myMart.blockedCount', { count: me.counts.blocked })}</Text>
                </View>
                <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={styles.groupLabel}>{t('mart.myMart.about')}</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity style={styles.row} onPress={() => setRulesVisible(true)}>
            <View style={styles.rowIconTile}><AppIcon icon={{ lib: 'ion', name: 'document-text-outline' }} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('mart.myMart.martRules')}</Text>
            </View>
            <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowDivider]} onPress={() => setDeleteVisible(true)}>
            <View style={styles.rowIconTile}><AppIcon icon={{ lib: 'ion', name: 'trash-outline' }} size={18} color="#c0392b" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: '#c0392b' }]}>{t('mart.myMart.deleteMyAccount')}</Text>
            </View>
            <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={rulesVisible} animationType="slide" onRequestClose={() => setRulesVisible(false)}>
        <MartRulesScreen mode="readOnly" onBack={() => setRulesVisible(false)} />
      </Modal>

      <DeleteAccountSheet
        visible={deleteVisible}
        token={token}
        onClose={() => setDeleteVisible(false)}
        onDeleted={() => { setDeleteVisible(false); onAccountDeleted() }}
      />
    </View>
  )
}

function BackBtn({ onBack, colors }: { onBack: () => void; colors: Colors }) {
  return (
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    centeredFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { fontSize: 14, color: c.textMuted },
    retryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { padding: 16, paddingBottom: 40 },

    identityCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16 },
    avatarRow: { flexDirection: 'row', gap: 14 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: 64, height: 64, borderRadius: 32 },
    avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
    name: { fontSize: 17, fontWeight: '700', color: c.text },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 6 },
    districtText: { fontSize: 12.5, color: c.textMuted },
    editBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
    editBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },

    hintRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.primaryTint,
      borderRadius: 10, padding: 12, marginTop: 14,
    },
    hintText: { flex: 1, fontSize: 12, color: c.textSub, lineHeight: 17 },

    groupLabel: { fontSize: 11.5, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5, marginTop: 22, marginBottom: 8 },
    groupCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    rowIconTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 14.5, fontWeight: '600', color: c.text },
    rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  })
}
