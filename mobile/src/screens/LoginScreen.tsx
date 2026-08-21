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

type Props = {
  onOTPSent: (phoneNumber: string) => void
}

const PERKS = [
  { icon: '🔧', label: 'Service\nhistory' },
  { icon: '⛽', label: 'Fuel &\nmileage' },
  { icon: '📄', label: 'Verified\ntransfer' },
]

export default function LoginScreen({ onOTPSent }: Props) {
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<CountryCode>(COUNTRY_CODES[0])
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const handleSendOTP = async () => {
    const digits = phone.trim()
    if (digits.length < 6) {
      Alert.alert('Invalid number', 'Please enter a valid mobile number.')
      return
    }

    const fullNumber = `${country.dial}${digits.startsWith('0') ? digits.slice(1) : digits}`

    setLoading(true)
    try {
      await api.sendOTP(fullNumber)
      onOTPSent(fullNumber)
    } catch (error: any) {
      Alert.alert('Error', error.message)
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
          <View style={styles.heroRoad} />
          <Text style={styles.logo}>Vocksy</Text>
          <Text style={styles.tagline}>Your vehicle's digital service file</Text>
        </View>

        <View style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🚗</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Enter your mobile number</Text>

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
              keyboardType="phone-pad"
              maxLength={14}
              value={phone}
              onChangeText={setPhone}
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
              : <Text style={styles.buttonText}>Send OTP</Text>
            }
          </TouchableOpacity>

          <View style={styles.perksRow}>
            {PERKS.map(perk => (
              <View key={perk.label} style={styles.perk}>
                <Text style={styles.perkIcon}>{perk.icon}</Text>
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
          <Text style={m.title}>Select Country</Text>
          <TouchableOpacity onPress={handleClose} style={m.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={m.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={m.searchWrap}>
          <TextInput
            style={m.search}
            placeholder="Search country or code..."
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
            <Text style={m.empty}>No results for "{search}"</Text>
          }
        />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { flexGrow: 1 },

    hero: {
      backgroundColor: c.primary,
      paddingTop: topInset + 40, paddingBottom: 56, paddingHorizontal: 24,
      alignItems: 'center', overflow: 'hidden', position: 'relative',
    },
    heroRoad: {
      position: 'absolute', bottom: 34, left: -20, right: -20, height: 3,
      backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ rotate: '-2deg' }],
    },
    logo: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    tagline: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },

    badgeWrap: { alignItems: 'center', height: 0 },
    badge: {
      position: 'absolute', top: -32, alignSelf: 'center',
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
      borderWidth: 4, borderColor: c.background,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    badgeIcon: { fontSize: 26 },

    card: {
      backgroundColor: c.surface, borderRadius: 20,
      marginHorizontal: 20, marginTop: 40,
      paddingTop: 24, paddingHorizontal: 24, paddingBottom: 20,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
    },
    title: { fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 22 },
    inputRow: { flexDirection: 'row', marginBottom: 20 },
    prefix: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, justifyContent: 'center', marginRight: 8,
    },
    prefixFlag: { fontSize: 16 },
    prefixText: { fontSize: 16, fontWeight: '600', color: c.textBody },
    prefixChevron: { fontSize: 11, color: c.textMuted, marginLeft: 1 },
    input: {
      flex: 1, backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: c.text, letterSpacing: 0,
    },
    button: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    perksRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border,
    },
    perk: { flex: 1, alignItems: 'center' },
    perkIcon: { fontSize: 18 },
    perkLabel: { fontSize: 10, color: c.textMuted, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: 13 },
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
