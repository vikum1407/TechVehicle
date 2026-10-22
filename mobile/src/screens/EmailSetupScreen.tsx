import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  Modal, FlatList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useTranslation } from '../i18n/LanguageContext'
import AppIcon, { AppIconSpec } from '../components/AppIcon'
import { SRI_LANKA_CITIES } from '../constants/cities'

type Props = {
  token: string
  onDone: () => void
}

const OTHER = 'Other'
const CITY_ITEMS = [...SRI_LANKA_CITIES, OTHER]

export default function EmailSetupScreen({ token, onDone }: Props) {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [cityCustom, setCityCustom] = useState('')
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const cityIsOther = city === OTHER
  const actualCity = cityIsOther ? cityCustom.trim() : city

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      await api.saveEmail(token, email.trim(), actualCity)
      onDone()
    } catch (e: any) {
      setError(e.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSave = isValidEmail && actualCity.length > 0

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.iconWrap}>
          <AppIcon icon={{ lib: 'mci', name: 'email-outline' }} size={28} color={colors.primary} />
        </View>

        <Text style={styles.title}>{t('emailSetup.title')}</Text>
        <Text style={styles.subtitle}>{t('emailSetup.subtitle')}</Text>

        <View style={styles.reasons}>
          <ReasonRow icon={{ lib: 'mci', name: 'key-outline' }} text={t('emailSetup.reason1')} color={colors.primary} />
          <ReasonRow icon={{ lib: 'mci', name: 'calendar-month-outline' }} text={t('emailSetup.reason2')} color={colors.primary} />
          <ReasonRow icon={{ lib: 'mci', name: 'bell-outline' }} text={t('emailSetup.reason3')} color={colors.primary} />
        </View>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={email}
          onChangeText={t => { setEmail(t); setError('') }}
          placeholder={t('profile.emailPlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.cityLabel}>{t('emailSetup.cityLabel')}</Text>
        <TouchableOpacity style={styles.selectorRow} onPress={() => setShowCityPicker(true)} activeOpacity={0.7}>
          <Text style={[styles.selectorText, !city && styles.placeholder]}>
            {city || t('emailSetup.selectCity')}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        {cityIsOther && (
          <TextInput
            style={[styles.input, styles.customInput]}
            placeholder={t('emailSetup.typeCityName')}
            value={cityCustom}
            onChangeText={setCityCustom}
            autoCapitalize="words"
          />
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{t('emailSetup.save')}</Text>}
        </TouchableOpacity>

      </ScrollView>

      <PickerModal
        visible={showCityPicker}
        title={t('emailSetup.cityLabel')}
        items={CITY_ITEMS}
        selected={city}
        onSelect={c => { setCity(c); setCityCustom(''); setShowCityPicker(false) }}
        onClose={() => setShowCityPicker(false)}
      />
    </KeyboardAvoidingView>
  )
}

function ReasonRow({ icon, text, color }: { icon: AppIconSpec; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <AppIcon icon={icon} size={16} color={color} />
      <Text style={{ fontSize: 14, color: '#555', flex: 1 }}>{text}</Text>
    </View>
  )
}

// ── Reusable searchable picker modal (mirrors AddVehicleScreen's own, kept
// self-contained here rather than shared, to avoid touching that screen) ──────
type PickerModalProps = {
  visible: boolean
  title: string
  items: string[]
  selected: string
  onSelect: (item: string) => void
  onClose: () => void
}

function PickerModal({ visible, title, items, selected, onSelect, onClose }: PickerModalProps) {
  const [search, setSearch] = useState('')
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const m = useMemo(() => makeModalStyles(colors, insets.top), [colors, insets.top])
  const { t } = useTranslation()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter(i => i.toLowerCase().includes(q)) : items
  }, [items, search])

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  const handleSelect = (item: string) => {
    setSearch('')
    onSelect(item)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={m.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={m.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={m.searchWrap}>
            <TextInput
              style={m.search}
              placeholder={t('addVehicle.searchFor', { title })}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={m.item}
                onPress={() => handleSelect(item)}
                activeOpacity={0.6}
              >
                <Text style={[m.itemText, item === OTHER && m.otherText]}>{item}</Text>
                {selected === item && <Text style={m.check}>✓</Text>}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={m.sep} />}
            ListEmptyComponent={
              <Text style={m.empty}>{t('addVehicle.noResultsFor', { query: search })}</Text>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeModalStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: topInset + 12, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title:    { fontSize: 18, fontWeight: '700', color: c.text },
    closeBtn: { padding: 4 },
    closeText:{ fontSize: 20, color: c.textSub },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
    search: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: c.text,
      borderWidth: 1, borderColor: c.borderMid,
    },
    item: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
    },
    itemText:  { fontSize: 15, color: c.text, flex: 1 },
    otherText: { color: c.primary, fontStyle: 'italic' },
    check:     { fontSize: 16, color: c.primary, fontWeight: '700', marginLeft: 8 },
    sep:       { height: 1, backgroundColor: c.border, marginHorizontal: 20 },
    empty:     { textAlign: 'center', color: c.textFaint, marginTop: 40, fontSize: 14 },
  })
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 28, paddingTop: 60, paddingBottom: 60, alignItems: 'center' },

    iconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    },

    title: {
      fontSize: 22, fontWeight: '800', color: c.text,
      textAlign: 'center', marginBottom: 10,
    },
    subtitle: {
      fontSize: 14, color: c.textSub, textAlign: 'center',
      lineHeight: 20, marginBottom: 24,
    },

    reasons: {
      width: '100%', backgroundColor: c.surface,
      borderRadius: 14, padding: 16, marginBottom: 24,
    },

    input: {
      width: '100%', borderWidth: 1.5, borderColor: c.borderMid,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: c.text, backgroundColor: c.surface,
    },
    inputError: { borderColor: c.error },
    errorText: { color: c.error, fontSize: 13, marginTop: 6, alignSelf: 'flex-start' },
    customInput: { marginTop: 10 },

    cityLabel: {
      width: '100%', fontSize: 13, fontWeight: '600', color: c.textSub,
      marginTop: 20, marginBottom: 8,
    },
    selectorRow: {
      width: '100%', backgroundColor: c.surface, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1.5, borderColor: c.borderMid,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    selectorText: { fontSize: 16, color: c.text, flex: 1 },
    placeholder: { color: c.textFaint },
    chevron: { fontSize: 20, color: c.textFaint, marginLeft: 8 },

    saveBtn: {
      width: '100%', backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center', marginTop: 24,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  })
}
