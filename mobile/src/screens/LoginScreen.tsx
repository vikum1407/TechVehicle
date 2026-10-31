import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView, Modal, FlatList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { COUNTRY_CODES, isoToFlag, CountryCode } from '../constants/countryCodes'
import AppIcon, { AppIconSpec } from '../components/AppIcon'
import { useTranslation } from '../i18n/LanguageContext'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'

type Props = {
  onOTPSent: (phoneNumber: string) => void
}

export default function LoginScreen({ onOTPSent }: Props) {
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<CountryCode>(COUNTRY_CODES[0])
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { maxContentWidth, scale } = useResponsiveLayout()
  const styles = useMemo(() => makeStyles(colors, insets.top, maxContentWidth, scale), [colors, insets.top, maxContentWidth, scale])
  const { t } = useTranslation()

  const PERKS: { icon: AppIconSpec; label: string }[] = [
    { icon: { lib: 'mci', name: 'wrench' }, label: t('login.perk.serviceHistory') },
    { icon: { lib: 'mci', name: 'gas-station' }, label: t('login.perk.fuelMileage') },
    { icon: { lib: 'mci', name: 'file-document-check-outline' }, label: t('login.perk.verifiedTransfer') },
  ]

  const handleSendOTP = async () => {
    const digits = phone.trim()
    if (digits.length < 6) {
      Alert.alert(t('login.invalidNumber.title'), t('login.invalidNumber.message'))
      return
    }

    const normalised = digits.startsWith('0') ? digits.slice(1) : digits
    const fullNumber = `${country.dial}${normalised}`

    // Sri Lanka: must be +947XXXXXXXX (9 digits after +94, starting with 7)
    if (country.dial === '+94' && !/^7\d{8}$/.test(normalised)) {
      Alert.alert(t('login.invalidNumber.title'), t('login.invalidSLNumber'))
      return
    }

    setLoading(true)
    try {
      await api.sendOTP(fullNumber)
      onOTPSent(fullNumber)
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <View style={styles.heroRoad} />
            <Text style={styles.logo}>Vocksy</Text>
            <Text style={styles.tagline}>{t('login.tagline')}</Text>
          </View>
        </View>

        <View style={styles.badgeWrap}>
          <View style={styles.badge}>
            <AppIcon icon={{ lib: 'mci', name: 'car' }} size={scale(28)} color="#fff" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('login.signIn')}</Text>
          <Text style={styles.subtitle}>{t('login.enterMobile')}</Text>

          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.prefix} onPress={() => setShowCountryPicker(true)}>
              <Text style={styles.prefixFlag}>{isoToFlag(country.iso)}</Text>
              <Text style={styles.prefixText}>{country.dial}</Text>
              <Text style={styles.prefixChevron}>▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="7X XXX XXXX"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={14}
              value={phone}
              onChangeText={v => setPhone(v.replace(/[^0-9]/g, ''))}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t('login.sendOtp')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.perksRow}>
            {PERKS.map(perk => (
              <View key={perk.label} style={styles.perk}>
                <View style={styles.perkIcon}><AppIcon icon={perk.icon} size={scale(18)} color={colors.primary} /></View>
                <Text style={styles.perkLabel}>{perk.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <CountryPickerModal
        visible={showCountryPicker}
        selected={country}
        onSelect={(c) => { setCountry(c); setShowCountryPicker(false) }}
        onClose={() => setShowCountryPicker(false)}
      />
    </KeyboardAvoidingView>
  )
}

type CountryPickerProps = {
  visible: boolean
  selected: CountryCode
  onSelect: (country: CountryCode) => void
  onClose: () => void
}

function CountryPickerModal({ visible, selected, onSelect, onClose }: CountryPickerProps) {
  const [search, setSearch] = useState('')
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const m = useMemo(() => makeModalStyles(colors, insets.top), [colors, insets.top])
  const { t } = useTranslation()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRY_CODES
    return COUNTRY_CODES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q)
    )
  }, [search])

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={m.container}>
        <View style={m.header}>
          <Text style={m.title}>{t('login.selectCountry')}</Text>
          <TouchableOpacity onPress={handleClose} style={m.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={m.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={m.searchWrap}>
          <TextInput
            style={m.search}
            placeholder={t('login.searchCountry')}
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.iso}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={m.item}
              onPress={() => onSelect(item)}
              activeOpacity={0.6}
            >
              <Text style={m.itemFlag}>{isoToFlag(item.iso)}</Text>
              <Text style={m.itemText}>{item.name}</Text>
              <Text style={m.itemDial}>{item.dial}</Text>
              {selected.iso === item.iso && <Text style={m.check}>✓</Text>}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={m.sep} />}
          ListEmptyComponent={
            <Text style={m.empty}>{t('login.noResultsFor', { query: search })}</Text>
          }
        />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(c: Colors, topInset: number, maxContentWidth: number, scale: (n: number) => number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { flexGrow: 1 },

    hero: {
      backgroundColor: c.primary,
      paddingTop: topInset + 40, paddingBottom: 56, paddingHorizontal: 24,
      alignItems: 'center', overflow: 'hidden', position: 'relative',
    },
    heroInner: { width: '100%', maxWidth: maxContentWidth, alignItems: 'center' },
    heroRoad: {
      position: 'absolute', bottom: 34, left: -20, right: -20, height: 3,
      backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ rotate: '-2deg' }],
    },
    logo: { fontSize: scale(26), fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    tagline: { fontSize: scale(13), color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },

    badgeWrap: { alignItems: 'center', height: 0 },
    badge: {
      position: 'absolute', top: -scale(32), alignSelf: 'center',
      width: scale(64), height: scale(64), borderRadius: scale(32),
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
      borderWidth: 4, borderColor: c.background,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },

    card: {
      backgroundColor: c.surface, borderRadius: 20,
      alignSelf: 'center', width: '100%', maxWidth: maxContentWidth,
      marginHorizontal: 20, marginTop: 40,
      paddingTop: 24, paddingHorizontal: 24, paddingBottom: 20,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
    },
    title: { fontSize: scale(20), fontWeight: '800', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: scale(13), color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 22 },
    inputRow: { flexDirection: 'row', marginBottom: 20 },
    prefix: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, justifyContent: 'center', marginRight: 8,
    },
    prefixFlag: { fontSize: scale(16) },
    prefixText: { fontSize: scale(16), fontWeight: '600', color: c.textBody },
    prefixChevron: { fontSize: scale(11), color: c.textMuted, marginLeft: 1 },
    input: {
      flex: 1, backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: scale(16), color: c.text, letterSpacing: 0,
    },
    button: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: scale(16), fontWeight: '700' },

    perksRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border,
    },
    perk: { flex: 1, alignItems: 'center' },
    perkIcon: {},
    perkLabel: { fontSize: scale(10), color: c.textMuted, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: scale(13) },
  })
}

function makeModalStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: topInset + 12, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 18, color: c.textMuted },
    searchWrap: { paddingHorizontal: 20, paddingVertical: 12 },
    search: {
      backgroundColor: c.background, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text, letterSpacing: 0,
    },
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
    },
    itemFlag: { fontSize: 20 },
    itemText: { flex: 1, fontSize: 15, color: c.text },
    itemDial: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
    check: { fontSize: 16, color: c.primary, fontWeight: '700', marginLeft: 8 },
    sep: { height: 1, backgroundColor: c.border, marginLeft: 20 },
    empty: { textAlign: 'center', marginTop: 40, color: c.textMuted, fontSize: 14 },
  })
}
