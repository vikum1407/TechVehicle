import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import AppIcon from '../../components/AppIcon'
import { api } from '../../config/api'
import { timeAgo } from '../../utils/martHelpers'

// Spec: 04-screens.md §9.1 "Who bought it?" — same sheet for selling (Mark Sold) and
// wanted (Mark Fulfilled, the "Who gave you the part?" wording per §19's owner view),
// so wording is type-aware rather than two near-duplicate components.
export default function WhoBoughtItSheet({
  visible, token, listingId, type, onClose, onDone,
}: {
  visible: boolean
  token: string
  listingId: string
  type: 'selling' | 'wanted'
  onClose: () => void
  onDone: () => void
}) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const isSelling = type === 'selling'

  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null) // threadId, or 'outside'
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setSelected(null)
    setError('')
    setLoading(true)
    api.getMartBuyers(token, listingId)
      .then(r => {
        setBuyers(r.items)
        if (r.items.length === 0) setSelected('outside')
      })
      .catch(() => setBuyers([]))
      .finally(() => setLoading(false))
  }, [visible, listingId])

  const confirm = async () => {
    if (!selected) return
    setSubmitting(true)
    setError('')
    try {
      await api.markMartSold(token, listingId, selected === 'outside' ? { outside: true } : { partnerThreadId: selected })
      onDone()
    } catch (e: any) {
      setError(e.message || t('mart.whoBoughtIt.couldntComplete'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MartBottomSheet visible={visible} onClose={onClose} topOffset={160}>
      <Text style={styles.title}>{isSelling ? t('mart.whoBoughtIt.whoBoughtIt') : t('mart.whoBoughtIt.whoGaveYouThePart')}</Text>
      <Text style={styles.help}>
        {isSelling
          ? t('mart.whoBoughtIt.helpSelling')
          : t('mart.whoBoughtIt.helpWanted')}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {buyers.map(b => (
            <TouchableOpacity
              key={b.threadId}
              style={[styles.row, selected === b.threadId && styles.rowSelected]}
              onPress={() => setSelected(b.threadId)}
            >
              {b.photoUrl ? (
                <Image source={{ uri: b.photoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{(b.name || '?')[0]}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{b.name}</Text>
                <Text style={styles.rowSub}>
                  {b.messageCount === 1
                    ? t('mart.whoBoughtIt.messagesOne', { count: b.messageCount, time: timeAgo(t, b.lastMessageAt) })
                    : t('mart.whoBoughtIt.messagesMany', { count: b.messageCount, time: timeAgo(t, b.lastMessageAt) })}
                </Text>
              </View>
              {selected === b.threadId ? <AppIcon icon={{ lib: 'ion', name: 'checkmark-circle' }} size={20} color={colors.primary} /> : null}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.row, selected === 'outside' && styles.rowSelected]}
            onPress={() => setSelected('outside')}
          >
            <View style={[styles.avatar, styles.avatarOutside]}>
              <AppIcon icon={{ lib: 'ion', name: 'globe-outline' }} size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{isSelling ? t('mart.whoBoughtIt.soldOutside') : t('mart.whoBoughtIt.gotItOutside')}</Text>
              <Text style={styles.rowSub}>{t('mart.whoBoughtIt.nobodyAskedToConfirm')}</Text>
            </View>
            {selected === 'outside' ? <AppIcon icon={{ lib: 'ion', name: 'checkmark-circle' }} size={20} color={colors.primary} /> : null}
          </TouchableOpacity>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, (!selected || submitting) && styles.submitBtnDisabled]}
        disabled={!selected || submitting}
        onPress={confirm}
      >
        <Text style={styles.submitBtnText}>{submitting ? t('mart.postAd.saving') : (isSelling ? t('mart.whoBoughtIt.markAsSold') : t('mart.whoBoughtIt.markAsFulfilled'))}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} disabled={submitting}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </MartBottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6 },
    help: { fontSize: 12.5, color: c.textMuted, marginBottom: 16, lineHeight: 18 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    rowSelected: { borderColor: c.primary, backgroundColor: c.surfaceAlt },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: 40, height: 40, borderRadius: 20 },
    avatarOutside: { backgroundColor: c.surfaceAlt },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    rowName: { fontSize: 14, fontWeight: '700', color: c.text },
    rowSub: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
    error: { fontSize: 12.5, color: c.error, marginTop: 4, marginBottom: 10 },
    submitBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelText: { textAlign: 'center', color: c.textMuted, fontWeight: '600', fontSize: 13.5, marginTop: 14, paddingBottom: 4 },
  })
}
