import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import { api } from '../../config/api'

// Spec: 04-screens.md §20 "My Mart > Edit ... Delete account: warning text listing
// what is removed ... a text field where the user types DELETE, a red button. Then
// call DELETE /auth/account and sign out." Milestone 3 Step 3.4. This deletes the
// WHOLE account (not just Mart data) — backend's deleteUserAccount() wipes vehicles/
// garage/notifications too, same as the existing manual deleteAccount.ts script.
export default function DeleteAccountSheet({
  visible, token, onClose, onDeleted,
}: {
  visible: boolean
  token: string
  onClose: () => void
  onDeleted: () => void
}) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const REMOVED = [
    t('mart.deleteAccount.removedAds'),
    t('mart.deleteAccount.removedChats'),
    t('mart.deleteAccount.removedRatings'),
    t('mart.deleteAccount.removedFavorites'),
    t('mart.deleteAccount.removedVehicles'),
  ]

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText.trim() === 'DELETE' && !deleting

  const handleClose = () => {
    setConfirmText('')
    setError('')
    onClose()
  }

  const doDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.deleteAccount(token)
      onDeleted()
    } catch (e: any) {
      setError(e.message || t('mart.deleteAccount.couldntDelete'))
      setDeleting(false)
    }
  }

  return (
    <MartBottomSheet
      visible={visible}
      onClose={handleClose}
      topOffset={220}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={deleting}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]} onPress={doDelete} disabled={!canDelete}>
              <Text style={styles.deleteBtnText}>{deleting ? t('mart.deleteAccount.deleting') : t('mart.myMart.deleteMyAccount')}</Text>
            </TouchableOpacity>
          </View>
        </>
      }
    >
      <Text style={styles.title}>{t('mart.deleteAccount.title')}</Text>
      <Text style={styles.warning}>{t('mart.deleteAccount.warning')}</Text>

      <View style={styles.bulletList}>
        {REMOVED.map(r => (
          <View key={r} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{r}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>{t('mart.deleteAccount.typeToConfirm')}</Text>
      <TextInput
        style={styles.input}
        placeholder="DELETE"
        placeholderTextColor={colors.textFaint}
        value={confirmText}
        onChangeText={setConfirmText}
        autoCapitalize="characters"
        autoCorrect={false}
      />

    </MartBottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    warning: { fontSize: 13, color: c.textSub, marginTop: 8 },

    bulletList: { marginTop: 14, gap: 8 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c0392b', marginTop: 6 },
    bulletText: { flex: 1, fontSize: 13.5, color: c.textBody, lineHeight: 19 },

    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginTop: 20, marginBottom: 8 },
    input: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text, letterSpacing: 1,
    },

    error: { fontSize: 12.5, color: c.error, marginTop: 14 },

    btnRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    cancelBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    deleteBtn: { flex: 1.6, backgroundColor: '#c0392b', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    deleteBtnDisabled: { opacity: 0.5 },
    deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}
