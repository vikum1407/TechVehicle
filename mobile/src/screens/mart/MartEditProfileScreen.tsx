import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import DistrictPickerScreen from './DistrictPickerScreen'
import { DISTRICTS } from '../../constants/districts'

const NAME_MIN = 2
const NAME_MAX = 40

type Photo = { localUri: string | null; url: string | null; uploading: boolean; error: string | null }

// Spec: 04-screens.md §20 "My Mart > Edit (name, district, profile photo)...".
// Milestone 3 Step 3.4. Replaces the name-and-district-only NameDistrictSheet as My
// Mart's "Edit" destination for non-shop users (Shop-tagged users still go to
// ShopProfileScreen, unchanged) — this is the "full Edit screen with a photo picker"
// Step 1.6's own notes said would land in Milestone 3. "Delete my account" itself
// lives one level up, as its own row in My Mart's ABOUT group (not nested in here) —
// placed where BOTH shop and casual users can reach it, since Edit branches by tag
// and a shop user never opens this screen at all.
export default function MartEditProfileScreen({ token, onBack, onSaved }: {
  token: string
  onBack: () => void
  onSaved: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [initialPhotoUrl, setInitialPhotoUrl] = useState<string | null>(null)

  const [photo, setPhoto] = useState<Photo>({ localUri: null, url: null, uploading: false, error: null })
  const [name, setName] = useState('')
  const [district, setDistrict] = useState<string | null>(null)
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const load = async () => {
    setLoading(true); setLoadError(false)
    try {
      const me = await api.getMartMe(token)
      setName(me.displayName || '')
      setDistrict(me.district || null)
      setInitialPhotoUrl(me.photoUrl || null)
      setPhoto({ localUri: null, url: me.photoUrl || null, uploading: false, error: null })
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const trimmedName = name.trim()
  const canSave = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX && !!district && !saving && !photo.uploading
  const districtLabel = district ? DISTRICTS.find(d => d.id === district)?.en : null

  const uploadPhoto = async (localUri: string) => {
    setPhoto(prev => ({ ...prev, localUri, uploading: true, error: null }))
    try {
      const url = await api.uploadPhoto(token, localUri, 'mart')
      setPhoto(prev => ({ ...prev, url, uploading: false }))
    } catch (e: any) {
      setPhoto(prev => ({ ...prev, uploading: false, error: e.message || 'Upload failed' }))
    }
  }

  const changePhotoPressed = async () => {
    // Same isPicking guard + legacy:true as the other Mart photo pickers fixed
    // 2026-10-16 (a real on-device "Uri lacks 'file' scheme" picker regression).
    if (isPicking) return
    setIsPicking(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.'); return }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], legacy: true })
      if (result.canceled || result.assets.length === 0) return
      const compressed = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })
      await uploadPhoto(compressed.uri)
    } finally {
      setIsPicking(false)
    }
  }

  const handleSave = async () => {
    if (photo.uploading) { setSubmitError('Wait for the photo to finish uploading'); return }
    if (photo.error) { setSubmitError('Remove or retry the failed photo'); return }
    if (!canSave) return
    setSaving(true)
    setSubmitError('')
    try {
      await api.patchMartMe(token, {
        displayName: trimmedName,
        district: district!,
        ...(photo.url !== initialPhotoUrl ? { profilePhotoUrl: photo.url || undefined } : {}),
      })
      onSaved()
    } catch (e: any) {
      setSubmitError(e.message || "Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.title}>Edit profile</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}><ActivityIndicator color={colors.primary} /></View>
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.title}>Edit profile</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}>
          <Text style={styles.errorText}>Couldn't load. Check your connection.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}><Text style={styles.retryBtnText}>Try again</Text></TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackBtn onBack={onBack} colors={colors} />
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <View style={styles.photoRow}>
            <View style={styles.avatarTile}>
              {photo.localUri || photo.url ? (
                <Image source={{ uri: photo.localUri || photo.url! }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{(name || '?')[0]?.toUpperCase()}</Text>
              )}
              {photo.uploading ? (
                <View style={styles.avatarOverlay}><ActivityIndicator color="#fff" size="small" /></View>
              ) : photo.error ? (
                <TouchableOpacity style={styles.avatarOverlay} onPress={() => photo.localUri && uploadPhoto(photo.localUri)}>
                  <AppIcon icon={{ lib: 'ion', name: 'refresh' }} size={18} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity style={styles.changePhotoBtn} onPress={changePhotoPressed} disabled={isPicking}>
              <Text style={styles.changePhotoBtnText}>Change photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kasun Perera"
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={t => setName(t.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
          />
          <Text style={styles.hint}>Others will see your first name and last initial</Text>

          <Text style={styles.label}>District</Text>
          <TouchableOpacity style={styles.input} onPress={() => setDistrictPickerOpen(true)}>
            <Text style={districtLabel ? styles.inputValueText : styles.inputPlaceholderText}>
              {districtLabel || 'Select your district'}
            </Text>
          </TouchableOpacity>

        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} disabled={!canSave} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={districtPickerOpen} animationType="slide" onRequestClose={() => setDistrictPickerOpen(false)}>
        <DistrictPickerScreen selected={district} onSelect={setDistrict} onClose={() => setDistrictPickerOpen(false)} />
      </Modal>
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

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    centeredFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { fontSize: 14, color: c.textMuted },
    retryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { padding: 20, paddingBottom: 20 },

    submitError: { fontSize: 13, color: c.error, backgroundColor: c.accentTint, borderRadius: 8, padding: 10, marginBottom: 16 },

    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
    avatarTile: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitial: { color: '#fff', fontSize: 26, fontWeight: '700' },
    avatarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    changePhotoBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    changePhotoBtnText: { color: c.primary, fontWeight: '700', fontSize: 13.5 },

    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 20 },
    input: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text, justifyContent: 'center',
    },
    inputValueText: { fontSize: 14.5, color: c.text },
    inputPlaceholderText: { fontSize: 14.5, color: c.textFaint },
    hint: { fontSize: 11.5, color: c.textMuted, marginTop: 6 },

    bottomBar: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 16, paddingBottom: bottomInset + 16,
    },
    saveBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  })
}
