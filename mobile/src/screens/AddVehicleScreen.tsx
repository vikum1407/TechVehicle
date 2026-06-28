import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import { VEHICLE_TYPE_OPTIONS } from '../constants/serviceData'
import { BRANDS_LIST, BRAND_MODELS } from '../constants/vehicleData'

type Props = {
  token: string
  onVehicleAdded: (vehicle: { id: string; registrationNo: string; make: string; model: string; year: number; fuelType: string; vehicleType: string | null; mileage: number }) => void
  onBack: () => void
}

const FUEL_TYPES = ['Petrol 92', 'Petrol 95', 'Diesel', 'Electric']
const OWNER_COUNT_OPTIONS = [
  { label: '1st Owner', value: 1 },
  { label: '2nd Owner', value: 2 },
  { label: '3rd+ Owner', value: 3 },
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
            placeholder={`Search ${title.toLowerCase()}...`}
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
            <Text style={m.empty}>No results for "{search}"</Text>
          }
        />
      </View>
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
      Alert.alert('Permission needed', 'Please allow photo library access in your device settings.')
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
      Alert.alert('Upload failed', e.message || 'Could not upload photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async () => {
    const actualBrand = brandIsOther ? brandCustom.trim() : brand
    const actualModel = (brandIsOther || modelIsOther) ? modelCustom.trim() : model

    if (!registrationNo.trim() || !actualBrand || !actualModel || !year || !fuelType || !vehicleType || !mileage) {
      Alert.alert('Missing fields', 'Please fill in all required fields including Brand, Model and Vehicle Type.')
      return
    }
    const yearNum = parseInt(year)
    if (yearNum < 1960 || yearNum > CURRENT_YEAR) {
      Alert.alert('Invalid year', `Year must be between 1960 and ${CURRENT_YEAR}.`)
      return
    }
    let parsedPurchaseDate: string | undefined
    if (purchaseDate.trim()) {
      const iso = parseDate(purchaseDate.trim())
      if (!iso) { Alert.alert('Invalid date', 'Purchase date must be DD/MM/YYYY.'); return }
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
      Alert.alert('Error', error.message)
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Add Vehicle</Text>
      <Text style={styles.subtitle}>Fields marked * are required</Text>

      {/* Registration */}
      <Text style={styles.label}>Registration Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. WP CAB-1234"
        value={registrationNo}
        onChangeText={setRegistrationNo}
        autoCapitalize="characters"
      />

      {/* Brand */}
      <Text style={styles.label}>Brand *</Text>
      <TouchableOpacity style={styles.selectorRow} onPress={() => setShowBrandPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.selectorText, !brand && styles.placeholder]}>
          {brandDisplay || 'Select brand'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      {brandIsOther && (
        <TextInput
          style={[styles.input, styles.customInput]}
          placeholder="Type brand name..."
          value={brandCustom}
          onChangeText={setBrandCustom}
          autoCapitalize="words"
        />
      )}

      {/* Model */}
      <Text style={styles.label}>Model *</Text>
      {!brand ? (
        <View style={[styles.selectorRow, styles.disabled]}>
          <Text style={styles.placeholder}>Select a brand first</Text>
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
              {modelDisplay || 'Select model'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          {modelIsOther && (
            <TextInput
              style={[styles.input, styles.customInput]}
              placeholder="Type model name..."
              value={modelCustom}
              onChangeText={setModelCustom}
              autoCapitalize="words"
              autoFocus
            />
          )}
        </>
      )}

      {/* Year */}
      <Text style={styles.label}>Year *</Text>
      <TextInput
        style={styles.input}
        placeholder={`e.g. ${CURRENT_YEAR - 5}`}
        keyboardType="number-pad"
        maxLength={4}
        value={year}
        onChangeText={setYear}
      />

      {/* Fuel Type */}
      <Text style={styles.label}>Fuel Type *</Text>
      <View style={styles.chipRow}>
        {FUEL_TYPES.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, fuelType === f && styles.chipSelected]}
            onPress={() => setFuelType(f)}
          >
            <Text style={[styles.chipText, fuelType === f && styles.chipTextSelected]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vehicle Type */}
      <Text style={styles.label}>Vehicle Type *</Text>
      <View style={styles.chipRow}>
        {VEHICLE_TYPE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, vehicleType === opt.value && styles.chipSelected]}
            onPress={() => setVehicleType(opt.value)}
          >
            <Text style={[styles.chipText, vehicleType === opt.value && styles.chipTextSelected]}>
              {opt.icon} {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mileage */}
      <Text style={styles.label}>Current Mileage (km) *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 45000"
        keyboardType="number-pad"
        value={mileage}
        onChangeText={setMileage}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Optional Details</Text>

      <Text style={styles.label}>Purchase Date</Text>
      <TextInput
        style={styles.input}
        placeholder="DD/MM/YYYY"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Owner History</Text>
      <View style={styles.chipRow}>
        {OWNER_COUNT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, ownerCount === o.value && styles.chipSelected]}
            onPress={() => setOwnerCount(o.value)}
          >
            <Text style={[styles.chipText, ownerCount === o.value && styles.chipTextSelected]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes about this vehicle</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any notes about condition, modifications, known issues..."
        value={vehicleNotes}
        onChangeText={setVehicleNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Vehicle Photo <Text style={styles.optional}>(optional)</Text></Text>
      <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
        {uploadingPhoto ? (
          <ActivityIndicator color="#1a73e8" />
        ) : photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoHint}>Tap to add a photo of your vehicle</Text>
          </View>
        )}
      </TouchableOpacity>
      {photoUrl && (
        <TouchableOpacity onPress={() => setPhotoUrl(null)} style={styles.removePhoto}>
          <Text style={styles.removePhotoText}>Remove photo</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save Vehicle</Text>
        }
      </TouchableOpacity>

      {/* Pickers */}
      <PickerModal
        visible={showBrandPicker}
        title="Brand"
        items={BRANDS_LIST}
        selected={brand}
        onSelect={handleBrandSelect}
        onClose={() => setShowBrandPicker(false)}
      />
      <PickerModal
        visible={showModelPicker}
        title="Model"
        items={modelItems}
        selected={model}
        onSelect={handleModelSelect}
        onClose={() => setShowModelPicker(false)}
      />
    </ScrollView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  content:     { padding: 24, paddingBottom: 48 },
  backBtn:     { marginTop: 8, marginBottom: 4, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title:       { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, marginTop: 16 },
  subtitle:    { fontSize: 13, color: '#888', marginBottom: 28 },
  label:       { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  sectionLabel:{ fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  customInput: { marginTop: 8 },
  textArea:    { minHeight: 80, paddingTop: 12 },
  optional:    { color: '#aaa', fontWeight: '400' },
  photoPicker: {
    height: 180, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0',
    borderStyle: 'dashed', overflow: 'hidden', marginBottom: 8,
    backgroundColor: '#fafafa', justifyContent: 'center', alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', gap: 8 },
  photoIcon: { fontSize: 36 },
  photoHint: { fontSize: 13, color: '#aaa' },
  removePhoto: { alignSelf: 'flex-end', marginBottom: 16 },
  removePhotoText: { fontSize: 12, color: '#e53935' },
  divider:     { height: 1, backgroundColor: '#e8e8e8', marginTop: 28, marginBottom: 8 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#e0e0e0', backgroundColor: '#fff',
  },
  chipSelected:     { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText:         { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  selectorRow: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: '#e0e0e0',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabled:    { opacity: 0.5 },
  selectorText:{ fontSize: 15, color: '#1a1a1a', flex: 1 },
  placeholder: { color: '#aaa' },
  chevron:     { fontSize: 20, color: '#aaa', marginLeft: 8 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
})

// Modal styles
const m = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  title:    { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: { padding: 4 },
  closeText:{ fontSize: 20, color: '#666' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee' },
  search: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  itemText:  { fontSize: 15, color: '#1a1a1a', flex: 1 },
  otherText: { color: '#1a73e8', fontStyle: 'italic' },
  check:     { fontSize: 16, color: '#1a73e8', fontWeight: '700', marginLeft: 8 },
  sep:       { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 20 },
  empty:     { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
})
