import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, Switch,
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

const NAME_MAX = 60
const ABOUT_MAX = 300
const ADDRESS_MAX = 100

type Logo = { localUri: string | null; url: string | null; uploading: boolean; error: string | null }

// Spec: 04-screens.md §15 "Shop profile setup — Direction A Single Form". Entry: My
// Mart > Edit, only when the user's tag is 'shop' (MyMartScreen branches on that before
// pushing here — this screen itself also defensively checks `eligible` from the GET,
// since tag could theoretically change between load and open). Data lives only in
// MartShopProfile — a Garage's own fields are read once for prefill (GET response's
// `prefill`) but never written back to Garage.
export default function ShopProfileScreen({ token, onBack, onSaved }: {
  token: string
  onBack: () => void
  onSaved: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [eligible, setEligible] = useState(true)
  const [fromGarage, setFromGarage] = useState(false)

  const [logo, setLogo] = useState<Logo>({ localUri: null, url: null, uploading: false, error: null })
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [district, setDistrict] = useState<string | null>(null)
  const [townAddress, setTownAddress] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')

  const [districtPickerOpen, setDistrictPickerOpen] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; contactPhone?: string; district?: string; websiteUrl?: string; googleMapsUrl?: string }>({})
  const [submitError, setSubmitError] = useState('')

  const load = async () => {
    setLoading(true); setLoadError(false)
    try {
      const data = await api.getMartShopProfile(token)
      setEligible(data.eligible)
      if (data.profile) {
        const p = data.profile
        setLogo({ localUri: null, url: p.logoUrl, uploading: false, error: null })
        setName(p.name)
        setAbout(p.about || '')
        setContactPhone(p.contactPhone)
        setDistrict(p.district)
        setTownAddress(p.townAddress || '')
        setWebsiteUrl(p.websiteUrl || '')
        setGoogleMapsUrl(p.googleMapsUrl || '')
        setFromGarage(false)
      } else if (data.prefill) {
        const pf = data.prefill
        setName(pf.name)
        setAbout(pf.about || '')
        setContactPhone(pf.contactPhone || '')
        setDistrict(pf.district)
        setTownAddress(pf.townAddress || '')
        setWebsiteUrl(pf.websiteUrl || '')
        setGoogleMapsUrl(pf.googleMapsUrl || '')
        setFromGarage(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const uploadLogo = async (localUri: string) => {
    setLogo(prev => ({ ...prev, localUri, uploading: true, error: null }))
    try {
      const url = await api.uploadPhoto(token, localUri, 'mart')
      setLogo(prev => ({ ...prev, url, uploading: false }))
    } catch (e: any) {
      setLogo(prev => ({ ...prev, uploading: false, error: e.message || 'Upload failed' }))
    }
  }

  const changeLogoPressed = async () => {
    // Same "isPicking" guard as OfferSheet/PostAdScreen's photo pickers — blocks a
    // fast double-tap from opening the native picker twice while the first pick
    // is still resolving (2026-09-05 Profile-photo-picker bug, same fix pattern).
    if (isPicking) return
    setIsPicking(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo library access to change your logo.'); return }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
      if (result.canceled || result.assets.length === 0) return
      const compressed = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })
      await uploadLogo(compressed.uri)
    } finally {
      setIsPicking(false)
    }
  }

  const districtLabel = district ? DISTRICTS.find(d => d.id === district)?.en : null

  const validate = () => {
    const trimmedName = name.trim()
    const next: typeof errors = {}
    if (trimmedName.length < 1) next.name = 'Enter a shop name'
    if (!contactPhone.trim() || !/^0?7\d{8}$/.test(contactPhone.replace(/[\s-]/g, ''))) next.contactPhone = 'Enter a valid phone number'
    if (!district) next.district = 'Select a district'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (logo.uploading) { setSubmitError('Wait for the logo to finish uploading'); return }
    if (logo.error) { setSubmitError('Remove or retry the failed logo photo'); return }
    if (!validate()) return
    setSaving(true)
    setSubmitError('')
    try {
      await api.putMartShopProfile(token, {
        name: name.trim(),
        logoUrl: logo.url,
        about: about.trim() || null,
        contactPhone: contactPhone.trim(),
        district: district!,
        townAddress: townAddress.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        googleMapsUrl: googleMapsUrl.trim() || null,
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
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.title}>Shop details</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}><ActivityIndicator color={colors.primary} /></View>
      </View>
    )
  }

  if (loadError || !eligible) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><BackBtn onBack={onBack} colors={colors} /><Text style={styles.title}>Shop details</Text><View style={{ width: 22 }} /></View>
        <View style={styles.centeredFlex}>
          <Text style={styles.errorText}>{eligible ? "Couldn't load. Check your connection." : 'Only Shop sellers can set up a shop profile.'}</Text>
          {!eligible ? null : <TouchableOpacity style={styles.retryBtn} onPress={load}><Text style={styles.retryBtnText}>Try again</Text></TouchableOpacity>}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackBtn onBack={onBack} colors={colors} />
        <Text style={styles.title}>Shop details</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {fromGarage ? (
          <View style={styles.infoBox}>
            <AppIcon icon={{ lib: 'ion', name: 'business-outline' }} size={18} color={colors.primary} />
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: '700' }}>Filled from your Garage.</Text> Changes here only affect your Mart shop. Your Garage details stay as they are.
            </Text>
          </View>
        ) : null}

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <View style={styles.logoRow}>
          <View style={styles.logoTile}>
            {logo.localUri || logo.url ? (
              <Image source={{ uri: logo.localUri || logo.url! }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoInitial}>{(name || '?')[0]?.toUpperCase()}</Text>
            )}
            {logo.uploading ? (
              <View style={styles.logoOverlay}><ActivityIndicator color="#fff" size="small" /></View>
            ) : logo.error ? (
              <TouchableOpacity style={styles.logoOverlay} onPress={() => logo.localUri && uploadLogo(logo.localUri)}>
                <AppIcon icon={{ lib: 'ion', name: 'refresh' }} size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.changeLogoBtn} onPress={changeLogoPressed} disabled={isPicking}>
            <Text style={styles.changeLogoBtnText}>Change logo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Shop name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Perera Auto Spares"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={t => setName(t.slice(0, NAME_MAX))}
          maxLength={NAME_MAX}
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

        <Text style={styles.label}>About your shop</Text>
        <TextInput
          style={styles.textArea}
          placeholder="What you sell, opening hours, anything buyers should know"
          placeholderTextColor={colors.textFaint}
          value={about}
          onChangeText={t => setAbout(t.slice(0, ABOUT_MAX))}
          maxLength={ABOUT_MAX}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Phone / WhatsApp</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 077 123 4567"
          placeholderTextColor={colors.textFaint}
          value={contactPhone}
          onChangeText={t => setContactPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
          keyboardType="number-pad"
          maxLength={10}
        />
        {errors.contactPhone ? <Text style={styles.errorText}>{errors.contactPhone}</Text> : null}

        <Text style={styles.label}>District</Text>
        <TouchableOpacity style={styles.input} onPress={() => setDistrictPickerOpen(true)}>
          <Text style={districtLabel ? styles.inputValueText : styles.inputPlaceholderText}>
            {districtLabel || 'Select your district'}
          </Text>
        </TouchableOpacity>
        {errors.district ? <Text style={styles.errorText}>{errors.district}</Text> : null}

        <Text style={styles.label}>Town / address</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Nugegoda"
          placeholderTextColor={colors.textFaint}
          value={townAddress}
          onChangeText={t => setTownAddress(t.slice(0, ADDRESS_MAX))}
          maxLength={ADDRESS_MAX}
        />

        <Text style={styles.label}>Website (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. www.yourshop.lk"
          placeholderTextColor={colors.textFaint}
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Google Maps link (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste a Google Maps link"
          placeholderTextColor={colors.textFaint}
          value={googleMapsUrl}
          onChangeText={setGoogleMapsUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={styles.alertsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Wanted request alerts</Text>
            <Text style={styles.alertsHint}>Get notified of requests for your parts — coming soon</Text>
          </View>
          <Switch value={false} disabled trackColor={{ false: colors.borderMid, true: colors.primaryTint }} />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} disabled={saving} onPress={handleSave}>
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
    errorText: { fontSize: 12, color: c.error, marginTop: 6 },
    retryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { padding: 20, paddingBottom: 20 },

    infoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.surfaceAlt,
      borderRadius: 12, padding: 12, marginBottom: 16,
    },
    infoBoxText: { flex: 1, fontSize: 12.5, color: c.textSub, lineHeight: 18 },
    submitError: { fontSize: 13, color: c.error, backgroundColor: c.accentTint, borderRadius: 8, padding: 10, marginBottom: 14 },

    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
    logoTile: {
      width: 72, height: 72, borderRadius: 14, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    logoImage: { width: '100%', height: '100%' },
    logoInitial: { color: '#fff', fontSize: 26, fontWeight: '700' },
    logoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    changeLogoBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    changeLogoBtnText: { color: c.primary, fontWeight: '700', fontSize: 13.5 },

    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 18 },
    input: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text, justifyContent: 'center',
    },
    inputValueText: { fontSize: 14.5, color: c.text },
    inputPlaceholderText: { fontSize: 14.5, color: c.textFaint },
    textArea: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14, color: c.text, minHeight: 72, textAlignVertical: 'top',
    },

    alertsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 12 },
    alertsHint: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },

    bottomBar: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 16, paddingBottom: bottomInset + 16,
    },
    saveBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  })
}
