import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import { VEHICLE_TYPE_OPTIONS } from '../constants/serviceData'
import { BRANDS_LIST, BRAND_MODELS } from '../constants/vehicleData'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import DateField from '../components/DateField'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  onVehicleAdded: (vehicle: { id: string; registrationNo: string; make: string; model: string; year: number; fuelType: string; vehicleType: string | null; mileage: number }) => void
  onBack: () => void
}

const FUEL_TYPES = ['Petrol 92', 'Petrol 95', 'Diesel', 'Electric']
const OWNER_COUNT_OPTIONS: { labelKey: TranslationKey; value: number }[] = [
  { labelKey: 'addVehicle.owner1st', value: 1 },
  { labelKey: 'addVehicle.owner2nd', value: 2 },
  { labelKey: 'addVehicle.owner3rdPlus', value: 3 },
]
const CURRENT_YEAR = new Date().getFullYear()
const OTHER = 'Other'

const parseDate = (str: string): string | null => {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const parsed = new Date(`${y}-${m}-${d}`)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

// ── Reusable searchable picker modal ─────────────────────────────────────────
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AddVehicleScreen({ token, onVehicleAdded, onBack }: Props) {
  const [registrationNo, setRegistrationNo] = useState('')
  const [brand, setBrand]           = useState('')
  const [brandCustom, setBrandCustom] = useState('')
  const [model, setModel]           = useState('')
  const [modelCustom, setModelCustom] = useState('')
  const [year, setYear]             = useState('')
  const [fuelType, setFuelType]     = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [mileage, setMileage]       = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [ownerCount, setOwnerCount] = useState<number | null>(null)
  const [vehicleNotes, setVehicleNotes] = useState('')
  const [photoUrl, setPhotoUrl]     = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [showBrandPicker, setShowBrandPicker] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeMainStyles(colors), [colors])
  const ms = useMemo(() => makeModalStyles(colors, 0), [colors])
  const { t } = useTranslation()

  const brandIsOther = brand === OTHER
  const modelItems   = brand && !brandIsOther ? [...(BRAND_MODELS[brand] ?? []), OTHER] : []
  const modelIsOther = model === OTHER

  const handleBrandSelect = (b: string) => {
    setBrand(b)
    setBrandCustom('')
    setModel('')       // reset model when brand changes
    setModelCustom('')
    setShowBrandPicker(false)
  }

  const handleModelSelect = (mod: string) => {
    setModel(mod)
    setModelCustom('')
    setShowModelPicker(false)
  }

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t('addVehicle.permissionNeeded.title'), t('addVehicle.permissionNeeded.message'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const url = await api.uploadPhoto(token, compressed.uri)
      setPhotoUrl(url)
    } catch (e: any) {
      Alert.alert(t('addVehicle.uploadFailed.title'), e.message || t('addVehicle.uploadFailed.message'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async () => {
    const actualBrand = brandIsOther ? brandCustom.trim() : brand
    const actualModel = (brandIsOther || modelIsOther) ? modelCustom.trim() : model

    if (!registrationNo.trim() || !actualBrand || !actualModel || !year || !fuelType || !vehicleType || !mileage) {
      Alert.alert(t('addVehicle.missingFields.title'), t('addVehicle.missingFields.message'))
      return
    }
    const yearNum = parseInt(year)
    if (yearNum < 1960 || yearNum > CURRENT_YEAR) {
      Alert.alert(t('addVehicle.invalidYear.title'), t('addVehicle.invalidYear.message', { year: CURRENT_YEAR }))
      return
    }
    let parsedPurchaseDate: string | undefined
    if (purchaseDate.trim()) {
      const iso = parseDate(purchaseDate.trim())
      if (!iso) { Alert.alert(t('addVehicle.invalidDate.title'), t('addVehicle.invalidDate.message')); return }
      parsedPurchaseDate = iso
    }

    setLoading(true)
    try {
      const newVehicle = await api.addVehicle(token, {
        registrationNo: registrationNo.trim(),
        make: actualBrand,
        model: actualModel,
        year: yearNum,
        fuelType,
        vehicleType: vehicleType || undefined,
        mileage: parseInt(mileage),
        purchaseDate: parsedPurchaseDate,
        ownerCount: ownerCount ?? undefined,
        vehicleNotes: vehicleNotes.trim() || undefined,
        photoUrl: photoUrl || undefined,
      })
      onVehicleAdded({ ...newVehicle, vehicleType: vehicleType || null })
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message)
    } finally {
      setLoading(false)
    }
  }

  const brandDisplay = brandIsOther
    ? (brandCustom || OTHER)
    : (brand || '')

  const modelDisplay = modelIsOther
    ? (modelCustom || OTHER)
    : (model || '')

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title={t('addVehicle.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>{t('addVehicle.requiredNote')}</Text>

      {/* Registration */}
      <FormField
        label={t('addVehicle.registrationNumber')}
        required
        placeholder="e.g. WP CAB-1234"
        value={registrationNo}
        onChangeText={setRegistrationNo}
        autoCapitalize="characters"
      />

      {/* Brand */}
      <Text style={styles.label}>{t('addVehicle.brandLabel')}</Text>
      <TouchableOpacity style={styles.selectorRow} onPress={() => setShowBrandPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.selectorText, !brand && styles.placeholder]}>
          {brandDisplay || t('addVehicle.selectBrand')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      {brandIsOther && (
        <TextInput
          style={[styles.input, styles.customInput]}
          placeholder={t('addVehicle.typeBrandName')}
          value={brandCustom}
          onChangeText={setBrandCustom}
          autoCapitalize="words"
        />
      )}

      {/* Model */}
      <Text style={styles.label}>{t('addVehicle.modelLabel')}</Text>
      {!brand ? (
        <View style={[styles.selectorRow, styles.disabled]}>
          <Text style={styles.placeholder}>{t('addVehicle.selectBrandFirst')}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      ) : brandIsOther ? (
        <TextInput
          style={styles.input}
          placeholder="e.g. Corolla, Vezel, Alto"
          value={modelCustom}
          onChangeText={setModelCustom}
          autoCapitalize="words"
        />
      ) : (
        <>
          <TouchableOpacity style={styles.selectorRow} onPress={() => setShowModelPicker(true)} activeOpacity={0.7}>
            <Text style={[styles.selectorText, !model && styles.placeholder]}>
              {modelDisplay || t('addVehicle.selectModel')}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          {modelIsOther && (
            <TextInput
              style={[styles.input, styles.customInput]}
              placeholder={t('addVehicle.typeModelName')}
              value={modelCustom}
              onChangeText={setModelCustom}
              autoCapitalize="words"
              autoFocus
            />
          )}
        </>
      )}

      {/* Year */}
      <FormField
        label={t('addVehicle.year')}
        required
        placeholder={`e.g. ${CURRENT_YEAR - 5}`}
        keyboardType="number-pad"
        maxLength={4}
        value={year}
        onChangeText={setYear}
      />

      {/* Fuel Type */}
      <Text style={styles.label}>{t('addVehicle.fuelTypeLabel')}</Text>
      <View style={styles.chipRow}>
        {FUEL_TYPES.map(f => (
          <Chip key={f} label={f} selected={fuelType === f} onPress={() => setFuelType(f)} />
        ))}
      </View>

      {/* Vehicle Type */}
      <Text style={styles.label}>{t('addVehicle.vehicleTypeLabel')}</Text>
      <View style={styles.chipRow}>
        {VEHICLE_TYPE_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={`${opt.icon} ${opt.label}`}
            selected={vehicleType === opt.value}
            onPress={() => setVehicleType(opt.value)}
          />
        ))}
      </View>

      {/* Mileage */}
      <FormField
        label={t('addVehicle.currentMileage')}
        required
        placeholder="e.g. 45000"
        keyboardType="number-pad"
        value={mileage}
        onChangeText={setMileage}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>{t('addVehicle.optionalDetails')}</Text>

      <DateField label={t('addVehicle.purchaseDate')} value={purchaseDate} onChange={setPurchaseDate} maximumDate={new Date()} />

      <Text style={styles.label}>{t('addVehicle.ownerHistory')}</Text>
      <View style={styles.chipRow}>
        {OWNER_COUNT_OPTIONS.map(o => (
          <Chip key={o.value} label={t(o.labelKey)} selected={ownerCount === o.value} onPress={() => setOwnerCount(o.value)} />
        ))}
      </View>

      <FormField
        label={t('addVehicle.notesLabel')}
        style={styles.textArea}
        placeholder={t('addVehicle.notesPlaceholder')}
        value={vehicleNotes}
        onChangeText={setVehicleNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>{t('addVehicle.vehiclePhoto')} <Text style={styles.optional}>{t('addVehicle.optionalParen')}</Text></Text>
      <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
        {uploadingPhoto ? (
          <ActivityIndicator color={colors.primary} />
        ) : photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoHint}>{t('addVehicle.tapToAddPhoto')}</Text>
          </View>
        )}
      </TouchableOpacity>
      {photoUrl && (
        <TouchableOpacity onPress={() => setPhotoUrl(null)} style={styles.removePhoto}>
          <Text style={styles.removePhotoText}>{t('addVehicle.removePhoto')}</Text>
        </TouchableOpacity>
      )}

      <Button title={t('addVehicle.saveVehicle')} onPress={handleSubmit} loading={loading} />

      {/* Pickers */}
      <PickerModal
        visible={showBrandPicker}
        title={t('addVehicle.brand')}
        items={BRANDS_LIST}
        selected={brand}
        onSelect={handleBrandSelect}
        onClose={() => setShowBrandPicker(false)}
      />
      <PickerModal
        visible={showModelPicker}
        title={t('addVehicle.model')}
        items={modelItems}
        selected={model}
        onSelect={handleModelSelect}
        onClose={() => setShowModelPicker(false)}
      />
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeMainStyles(c: Colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.background },
    content:     { padding: 24, paddingBottom: 48 },
    subtitle:    { fontSize: 13, color: c.textMuted, marginBottom: 28 },
    label:       { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 16 },
    sectionLabel:{ fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 15, color: c.text,
      borderWidth: 1, borderColor: c.borderMid,
    },
    customInput: { marginTop: 8 },
    textArea:    { minHeight: 80, paddingTop: 12 },
    optional:    { color: c.textFaint, fontWeight: '400' },
    photoPicker: {
      height: 180, borderRadius: 12, borderWidth: 1.5, borderColor: c.borderMid,
      borderStyle: 'dashed', overflow: 'hidden', marginBottom: 8,
      backgroundColor: c.surfaceAlt, justifyContent: 'center', alignItems: 'center',
    },
    photoPreview: { width: '100%', height: '100%' },
    photoPlaceholder: { alignItems: 'center', gap: 8 },
    photoIcon: { fontSize: 36 },
    photoHint: { fontSize: 13, color: c.textFaint },
    removePhoto: { alignSelf: 'flex-end', marginBottom: 16 },
    removePhotoText: { fontSize: 12, color: c.error },
    divider:     { height: 1, backgroundColor: c.border, marginTop: 28, marginBottom: 8 },
    chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    selectorRow: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 16,
      borderWidth: 1, borderColor: c.borderMid,
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
    },
    disabled:    { opacity: 0.5 },
    selectorText:{ fontSize: 15, color: c.text, flex: 1 },
    placeholder: { color: c.textFaint },
    chevron:     { fontSize: 20, color: c.textFaint, marginLeft: 8 },
  })
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
