import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import AppIcon from '../../components/AppIcon'
import { api } from '../../config/api'
import { formatBudget } from '../../utils/martHelpers'
import NameDistrictSheet from './NameDistrictSheet'
import MartRulesScreen from './MartRulesScreen'

const PHOTOS_MAX = 3
const NOTE_MAX = 300
const PRICE_MAX = 100_000_000

type Photo = { localUri: string; url: string | null; uploading: boolean; error: string | null }

// Spec: 04-screens.md §14.1 "Send an offer" bottom sheet — opened from "I have this" on
// a Wanted feed card or Wanted Detail's sticky button. Every field is optional (an empty
// offer is still allowed, per 02-data-model.md §4.3); sending just opens/finds the chat
// either way. A second attempt (OFFER_EXISTS) is handled transparently by
// api.postMartOffer — this sheet never needs to show that as an error, it just gets the
// existing thread id back and calls onSent the same as a fresh send.
export default function OfferSheet({
  visible, token, listingId, title, districtLabel, ownerName, budgetMin, budgetMax, onClose, onSent,
}: {
  visible: boolean
  token: string
  listingId: string
  title: string
  districtLabel: string
  ownerName: string
  budgetMin: number | null
  budgetMax: number | null
  onClose: () => void
  onSent: (threadId: string) => void
}) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [gateStep, setGateStep] = useState<'nameDistrict' | 'rules' | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  const remainingSlots = PHOTOS_MAX - photos.length

  const uploadAt = async (index: number, localUri: string) => {
    setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, uploading: true, error: null } : p)))
    try {
      const url = await api.uploadPhoto(token, localUri, 'mart')
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, url, uploading: false } : p)))
    } catch (e: any) {
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, uploading: false, error: e.message || t('mart.common.uploadFailed') } : p)))
    }
  }

  const addAssets = async (uris: string[]) => {
    const startIndex = photos.length
    setPhotos(prev => [...prev, ...uris.map(() => ({ localUri: '', url: null, uploading: true, error: null }))])
    for (let i = 0; i < uris.length; i++) {
      const compressed = await ImageManipulator.manipulateAsync(uris[i], [{ resize: { width: 1280 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })
      const index = startIndex + i
      setPhotos(prev => prev.map((p, idx) => (idx === index ? { ...p, localUri: compressed.uri } : p)))
      await uploadAt(index, compressed.uri)
    }
  }

  const addPhotoPressed = async () => {
    // Guards against a second tap re-opening the picker while the first pick is still
    // resolving — same fix as the Profile photo picker's "opening twice" bug (2026-09-05):
    // `photos.length` (what `remainingSlots` is derived from) doesn't update until the
    // picker has already resolved, so it can't be relied on alone to block a fast re-tap.
    if (remainingSlots <= 0 || isPicking) return
    setIsPicking(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) { Alert.alert(t('mart.common.permissionNeeded'), t('mart.common.allowPhotoLibrary')); return }
      // legacy:true — see PostAdScreen.tsx's pickFromLibrary for why (a real on-device
      // "Uri lacks 'file' scheme" picker regression found 2026-10-16).
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], legacy: true, allowsMultipleSelection: true, selectionLimit: remainingSlots })
      if (result.canceled || result.assets.length === 0) return
      await addAssets(result.assets.map(a => a.uri))
    } finally {
      setIsPicking(false)
    }
  }

  const removePhoto = (index: number) => setPhotos(prev => prev.filter((_, i) => i !== index))
  const retryPhoto = (index: number) => { const p = photos[index]; if (p) uploadAt(index, p.localUri) }

  const reset = () => { setPrice(''); setNote(''); setPhotos([]); setError('') }

  const handleSend = async () => {
    if (photos.some(p => p.uploading)) { setError(t('mart.offer.waitForPhotos')); return }
    if (photos.some(p => p.error)) { setError(t('mart.offer.retryFailedPhoto')); return }
    setSending(true)
    setError('')
    try {
      const result = await api.postMartOffer(token, listingId, {
        price: price ? Number(price) : undefined,
        note: note.trim() || undefined,
        photos: photos.map(p => p.url!),
      })
      reset()
      onSent(result.threadId)
    } catch (e: any) {
      // Same gate pattern as ChatThreadScreen (and PostAdScreen's own gate) — this
      // sheet never had it, so a first-ever "I have this" tap showed the raw backend
      // error text ("Please accept the Mart rules") instead of the real gate sheet.
      if (e.code === 'PROFILE_REQUIRED') { setGateStep('nameDistrict'); return }
      if (e.code === 'RULES_REQUIRED') { setGateStep('rules'); return }
      setError(e.message || t('mart.offer.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
    <MartBottomSheet visible={visible && !gateStep} onClose={onClose} topOffset={140}>
      <Text style={styles.title}>{t('mart.offer.title')}</Text>

      <View style={styles.summaryBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.summarySub}>{districtLabel} · {ownerName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.summaryBudgetLabel}>{t('mart.common.budget')}</Text>
          <Text style={styles.summaryBudget}>{formatBudget(t, budgetMin, budgetMax)}</Text>
        </View>
      </View>

      <Text style={styles.label}>{t('mart.offer.yourPrice')}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.pricePrefix}>{t('mart.common.rsPrefix')}</Text>
        <TextInput
          style={styles.priceInput}
          placeholder={t('mart.offer.pricePlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={price}
          onChangeText={v => setPrice(v.replace(/[^0-9]/g, '').slice(0, String(PRICE_MAX).length))}
          keyboardType="number-pad"
        />
      </View>

      <Text style={styles.label}>{t('mart.offer.photosLabel', { max: PHOTOS_MAX })}</Text>
      <View style={styles.photoRow}>
        {photos.map((p, i) => (
          <View key={i} style={styles.photoTile}>
            {p.localUri ? <Image source={{ uri: p.localUri }} style={styles.photoImage} /> : null}
            {p.uploading ? (
              <View style={styles.photoOverlay}><ActivityIndicator color="#fff" size="small" /></View>
            ) : p.error ? (
              <TouchableOpacity style={styles.photoOverlay} onPress={() => retryPhoto(i)}>
                <AppIcon icon={{ lib: 'ion', name: 'refresh' }} size={16} color="#fff" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
              <AppIcon icon={{ lib: 'ion', name: 'close' }} size={10} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {remainingSlots > 0 && (
          <TouchableOpacity style={styles.photoAddTile} onPress={addPhotoPressed} disabled={isPicking}>
            <AppIcon icon={{ lib: 'ion', name: 'camera-outline' }} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>{t('mart.common.noteOptional')}</Text>
      <TextInput
        style={styles.noteInput}
        placeholder={t('mart.offer.notePlaceholder')}
        placeholderTextColor={colors.textFaint}
        value={note}
        onChangeText={v => setNote(v.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        multiline
        numberOfLines={2}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} disabled={sending} onPress={handleSend}>
        <Text style={styles.sendBtnText}>{sending ? t('mart.offer.sending') : t('mart.offer.sendOffer')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} disabled={sending}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </MartBottomSheet>

    <NameDistrictSheet
      visible={gateStep === 'nameDistrict'}
      token={token}
      onDone={() => { setGateStep(null); handleSend() }}
      onClose={() => setGateStep(null)}
    />

    {gateStep === 'rules' ? (
      <Modal visible animationType="slide" onRequestClose={() => setGateStep(null)}>
        <MartRulesScreen
          mode="firstAction"
          token={token}
          onBack={() => setGateStep(null)}
          onAccepted={() => { setGateStep(null); handleSend() }}
        />
      </Modal>
    ) : null}
    </>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 14 },
    summaryBox: {
      flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, gap: 10,
    },
    summaryTitle: { fontSize: 13.5, fontWeight: '700', color: c.text },
    summarySub: { fontSize: 11.5, color: c.textMuted, marginTop: 3 },
    summaryBudgetLabel: { fontSize: 11, color: c.textMuted },
    summaryBudget: { fontSize: 13, fontWeight: '700', color: c.accentTintText, marginTop: 2 },

    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 16 },
    priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14 },
    pricePrefix: { fontSize: 14.5, color: c.textMuted, marginRight: 6 },
    priceInput: { flex: 1, paddingVertical: 12, fontSize: 14.5, color: c.text },

    photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    photoTile: { width: 64, height: 64, borderRadius: 10, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    photoImage: { width: '100%', height: '100%' },
    photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    photoRemove: {
      position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    photoAddTile: {
      width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt,
    },

    noteInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14, color: c.text, minHeight: 60, textAlignVertical: 'top',
    },
    error: { fontSize: 12.5, color: c.error, marginTop: 14 },
    sendBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelText: { textAlign: 'center', color: c.textMuted, fontWeight: '600', fontSize: 13.5, marginTop: 14, paddingBottom: 4 },
  })
}
