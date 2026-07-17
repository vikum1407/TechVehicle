import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import {
  SelectedItem, NO_BRAND_ITEMS, ITEM_BRANDS, CATEGORY_BRANDS,
  getServiceCategories, todayDMY, parseDMY,
} from '../constants/serviceData'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import Button from '../components/Button'

type Props = {
  token: string
  vehicleId: string
  vehicleType?: string | null
  currentMileage: number
  onRecordAdded: () => void
  onBack: () => void
}

// ─── Structured sub-form definitions ────────────────────────────────────────
type StructuredTextField = {
  type: 'text'
  key: string
  label: string
  placeholder: string
  keyboard?: 'default' | 'decimal-pad' | 'number-pad'
}
type StructuredChipsField = {
  type: 'chips'
  key: string
  label: string
  options: string[]
}
type StructuredField = StructuredTextField | StructuredChipsField

const STRUCTURED_ITEMS: Record<string, StructuredField[]> = {
  'Oil Change': [
    { type: 'chips', key: 'oilBrand', label: 'Oil Brand', options: ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline'] },
    { type: 'chips', key: 'oilGrade', label: 'Oil Grade (viscosity)', options: ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', '20W-50'] },
    { type: 'chips', key: 'oilType',  label: 'Oil Type', options: ['Mineral', 'Semi-synthetic', 'Full synthetic'] },
  ],
  'Tyre Change': [
    { type: 'chips', key: 'tyreBrand',    label: 'Tyre Brand',         options: ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop'] },
    { type: 'text',  key: 'tyreSize',     label: 'Tyre Size',          placeholder: 'e.g. 185/65R15' },
    { type: 'chips', key: 'tyresChanged', label: 'How many tyres?',    options: ['1', '2', '4'] },
  ],
  'Emission Test / Carbon Test': [
    { type: 'text',  key: 'co',      label: 'CO %',            placeholder: 'e.g. 0.8',  keyboard: 'decimal-pad' },
    { type: 'text',  key: 'hc',      label: 'HC ppm',          placeholder: 'e.g. 120',  keyboard: 'number-pad'  },
    { type: 'text',  key: 'co2',     label: 'CO₂ %',           placeholder: 'e.g. 14.2', keyboard: 'decimal-pad' },
    { type: 'text',  key: 'lambda',  label: 'Lambda',          placeholder: 'e.g. 1.01', keyboard: 'decimal-pad' },
    { type: 'chips', key: 'result',  label: 'Test Result',     options: ['Pass', 'Fail'] },
    { type: 'text',  key: 'station', label: 'Testing Station', placeholder: 'e.g. Werahera Testing Station' },
  ],
  'AC Gas Refill': [
    { type: 'chips', key: 'refrigerantType', label: 'Refrigerant Type',       options: ['R134a', 'R1234yf', 'R22 (old)'] },
    { type: 'text',  key: 'quantityGrams',   label: 'Quantity Filled (grams)', placeholder: 'e.g. 450', keyboard: 'number-pad' },
  ],
}

export default function AddServiceRecordScreen({ token, vehicleId, vehicleType, currentMileage, onRecordAdded, onBack }: Props) {
  const [categories, setCategories] = useState<{ title: string; items: string[] }[]>(
    () => getServiceCategories(vehicleType)
  )
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [otherText, setOtherText] = useState('')
  const [customBrands, setCustomBrands] = useState<Record<string, string>>({})
  const [structuredData, setStructuredData] = useState<Record<string, Record<string, string>>>({})
  const [date, setDate] = useState(todayDMY())
  const [mileage, setMileage] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)

  useEffect(() => {
    api.getServiceCategoriesRemote(vehicleType).then(setCategories).catch(() => {
      // fallback to local data already set in initial state
    })
  }, [vehicleType])
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const isSelected = (name: string) => selectedItems.some(i => i.name === name)

  const toggleService = (name: string, category: string) => {
    if (isSelected(name)) {
      setSelectedItems(prev => prev.filter(i => i.name !== name))
      // Clear structured data when item is deselected
      if (STRUCTURED_ITEMS[name]) {
        setStructuredData(prev => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    } else {
      setSelectedItems(prev => [...prev, { name, category, brand: '' }])
    }
  }

  const setBrandForItem = (itemName: string, brand: string) => {
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand } : i))
    setCustomBrands(prev => ({ ...prev, [itemName]: '' }))
  }

  const setCustomBrandForItem = (itemName: string, value: string) => {
    setCustomBrands(prev => ({ ...prev, [itemName]: value }))
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand: value } : i))
  }

  const setStructuredField = (itemName: string, key: string, value: string) => {
    setStructuredData(prev => ({
      ...prev,
      [itemName]: { ...(prev[itemName] || {}), [key]: value },
    }))
  }

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can attach up to 5 photos per service record.')
      return
    }
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert('Permission needed', `Please allow ${source} access in your device settings.`)
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] })

    if (result.canceled || !result.assets[0]) return

    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const url = await api.uploadPhoto(token, compressed.uri)
      setPhotos(prev => [...prev, url])
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const removePhoto = (url: string) => {
    setPhotos(prev => prev.filter(p => p !== url))
  }

  const handleSubmit = async () => {
    setSaveAttempted(true)
    const extras = otherText.trim()
      ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }]
      : []
    const allItems = [...selectedItems, ...extras]

    if (allItems.length === 0) {
      Alert.alert('Select a service', 'Please tap at least one service done.')
      return
    }
    const isoDate = parseDMY(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }
    if (!mileage.trim()) {
      Alert.alert('Mileage required', 'Please enter the odometer reading at the time of this service.')
      return
    }
    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum) || mileageNum <= 0) {
      Alert.alert('Invalid mileage', 'Please enter a valid mileage in km.')
      return
    }
    if (!cost.trim()) {
      Alert.alert('Cost required', 'Please enter the total cost for this service.')
      return
    }
    if (isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
      Alert.alert('Invalid cost', 'Please enter a valid cost greater than 0.')
      return
    }

    // For items whose brand lives in structuredData (Oil Change, Tyre Change, AC Gas Refill),
    // use that brand in the description so history cards still show "Oil Change (Castrol)"
    const brandForItem = (name: string, itemBrand: string): string => {
      const sd = structuredData[name] || {}
      if (name === 'Oil Change')     return sd.oilBrand        || itemBrand
      if (name === 'Tyre Change')    return sd.tyreBrand       || itemBrand
      if (name === 'AC Gas Refill')  return sd.refrigerantType || itemBrand
      return itemBrand
    }
    const description = allItems
      .map(i => { const b = brandForItem(i.name, i.brand); return b ? `${i.name} (${b})` : i.name })
      .join(', ')
    const brands = [...new Set(allItems.map(i => brandForItem(i.name, i.brand)).filter(Boolean))].join(', ')
    const selectedNames = new Set(allItems.map(i => i.name))
    const filteredStructured = Object.fromEntries(
      Object.entries(structuredData).filter(([k]) => selectedNames.has(k))
    )
    const hasStructured = Object.keys(filteredStructured).length > 0

    const doSave = async () => {
      setLoading(true)
      try {
        await api.addServiceRecord(token, vehicleId, {
          date: isoDate,
          description,
          mileage: mileageNum,
          brand: brands || undefined,
          cost: parseFloat(cost),
          notes: notes.trim() || undefined,
          photos: photos.length > 0 ? photos : undefined,
          structuredData: hasStructured ? filteredStructured : undefined,
        })
        onRecordAdded()
      } catch (error: any) {
        Alert.alert('Error', error.message)
      } finally {
        setLoading(false)
      }
    }

    // Warn (don't block) if mileage is higher than current — could be a typo
    if (mileageNum > currentMileage + 500) {
      Alert.alert(
        'Check mileage',
        `The mileage you entered (${mileageNum.toLocaleString()} km) is higher than the vehicle's current recorded mileage of ${currentMileage.toLocaleString()} km. Is this correct?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, save', onPress: doSave },
        ]
      )
      return
    }

    await doSave()
  }

  const itemsNeedingBrand = selectedItems.filter(i => !NO_BRAND_ITEMS.has(i.name))
  const itemsWithStructured = selectedItems.filter(i => STRUCTURED_ITEMS[i.name])

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title="Add Service Record" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>
        Tap everything that was done <Text style={styles.requiredStar}>*</Text>
      </Text>
      {saveAttempted && selectedItems.length === 0 && !otherText.trim() && (
        <Text style={styles.fieldError}>Please select at least one service</Text>
      )}

      {categories.map(cat => (
        <View key={cat.title}>
          <Text style={styles.catLabel}>{cat.title}</Text>
          <View style={styles.chipRow}>
            {cat.items.map(item => {
              const sel = isSelected(item)
              const hasStructure = !!STRUCTURED_ITEMS[item]
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => toggleService(item, cat.title)}
                  activeOpacity={0.7}
                >
                  {sel && <Text style={styles.check}>✓ </Text>}
                  <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{item}</Text>
                  {hasStructure && !sel && (
                    <Text style={styles.detailDot}> ·</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ))}

      <FormField
        label="Other (not listed above)"
        value={otherText}
        onChangeText={setOtherText}
        placeholder="Type anything else that was done..."
      />

      {/* ── Structured details section ────────────────────── */}
      {itemsWithStructured.length > 0 && (
        <View style={styles.structuredSection}>
          <Text style={styles.structuredTitle}>
            {itemsWithStructured.length === 1
              ? `${itemsWithStructured[0].name} Details`
              : 'Service Details'}
          </Text>
          <Text style={styles.structuredSub}>Saved for analytics and predictions</Text>

          {itemsWithStructured.map(item => {
            const fields = STRUCTURED_ITEMS[item.name]
            const values = structuredData[item.name] || {}
            return (
              <View key={item.name} style={styles.structuredBlock}>
                <Text style={styles.structuredItemName}>{item.name}</Text>

                {fields.map(field => {
                  if (field.type === 'chips') {
                    return (
                      <View key={field.key} style={styles.structuredFieldWrap}>
                        <Text style={styles.structuredFieldLabel}>{field.label}</Text>
                        <View style={styles.chipRow}>
                          {field.options.map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.structuredChip, values[field.key] === opt && styles.structuredChipSelected]}
                              onPress={() => setStructuredField(item.name, field.key, values[field.key] === opt ? '' : opt)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.structuredChipText, values[field.key] === opt && styles.structuredChipTextSelected]}>
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )
                  }

                  return (
                    <View key={field.key} style={styles.structuredFieldWrap}>
                      <Text style={styles.structuredFieldLabel}>{field.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={values[field.key] || ''}
                        onChangeText={v => setStructuredField(item.name, field.key, v)}
                        placeholder={field.placeholder}
                        keyboardType={field.keyboard || 'default'}
                      />
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      )}

      {/* ── Brand picker ──────────────────────────────────── */}
      {itemsNeedingBrand.length > 0 && (
        <View style={styles.brandsSection}>
          <Text style={styles.brandsSectionTitle}>Parts Brand (optional)</Text>
          <Text style={styles.brandsSectionSub}>Select brand for each replaced part</Text>

          {itemsNeedingBrand.map(item => {
            const brands = ITEM_BRANDS[item.name] || CATEGORY_BRANDS[item.category] || CATEGORY_BRANDS['General & Other']
            return (
              <View key={item.name} style={styles.brandRow}>
                <Text style={styles.brandItemName}>{item.name}</Text>
                <View style={styles.chipRow}>
                  {brands.map(b => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.brandChip, item.brand === b && styles.brandChipSelected]}
                      onPress={() => setBrandForItem(item.name, b)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.brandChipText, item.brand === b && styles.brandChipTextSelected]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={customBrands[item.name] || ''}
                  onChangeText={v => setCustomBrandForItem(item.name, v)}
                  placeholder="Or type brand..."
                />
              </View>
            )
          })}
        </View>
      )}

      {/* ── Date / Mileage / Cost ─────────────────────────── */}
      <View style={styles.row}>
        <View style={styles.half}>
          <FormField
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.half}>
          <FormField
            label="Mileage (km)"
            required
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <FormField
        label="Total Cost (LKR)"
        required
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4500"
        keyboardType="number-pad"
      />

      <Text style={styles.catLabel}>Photos (optional, max 5)</Text>
      <View style={styles.photoRow}>
        {photos.map((url) => (
          <View key={url} style={styles.photoThumb}>
            <Image source={{ uri: url }} style={styles.thumbImg} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(url)}>
              <Text style={styles.photoRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 5 && (
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={() => pickPhoto('camera')}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.photoBtnText}>📷 Camera</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={() => pickPhoto('gallery')}
              disabled={uploadingPhoto}
            >
              <Text style={styles.photoBtnText}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FormField
        label="Notes (optional)"
        style={styles.multiline}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        multiline
        numberOfLines={2}
      />

      {selectedItems.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{selectedItems.length} service{selectedItems.length > 1 ? 's' : ''} selected</Text>
          {selectedItems.map(i => (
            <Text key={i.name} style={styles.summaryLine}>
              • {i.name}{i.brand ? ` — ${i.brand}` : ''}
            </Text>
          ))}
        </View>
      )}

      <Button title="Save Record" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 56 },
    subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 16 },
    catLabel: { fontSize: 12, fontWeight: '700', color: c.textSub, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: c.borderMid, backgroundColor: c.surface,
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    check: { fontSize: 13, color: '#fff' },
    chipText: { fontSize: 14, color: c.textSub },
    chipTextSelected: { color: '#fff', fontWeight: '600' },
    detailDot: { fontSize: 12, color: c.textFaint },
    brandsSection: {
      backgroundColor: c.surface, borderRadius: 14,
      padding: 16, marginTop: 24,
      borderWidth: 1, borderColor: c.primaryTint,
    },
    brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: c.primary, marginBottom: 2 },
    brandsSectionSub: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
    brandRow: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 14 },
    brandItemName: { fontSize: 14, fontWeight: '600', color: c.textBody, marginBottom: 8 },
    brandChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 18, borderWidth: 1.5,
      borderColor: c.borderMid, backgroundColor: c.surfaceAlt,
    },
    brandChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    brandChipText: { fontSize: 12, color: c.textSub },
    brandChipTextSelected: { color: '#fff', fontWeight: '600' },
    structuredSection: {
      backgroundColor: c.primaryTint, borderRadius: 14,
      padding: 16, marginTop: 24,
      borderWidth: 1.5, borderColor: c.primaryTintText + '44',
    },
    structuredTitle: { fontSize: 15, fontWeight: '700', color: c.primaryTintText, marginBottom: 2 },
    structuredSub: { fontSize: 12, color: c.textSub, marginBottom: 4 },
    structuredBlock: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 14 },
    structuredItemName: { fontSize: 14, fontWeight: '700', color: c.primaryTintText, marginBottom: 10 },
    structuredFieldWrap: { marginBottom: 12 },
    structuredFieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSub, marginBottom: 6 },
    structuredChip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: c.border, backgroundColor: c.surface,
    },
    structuredChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    structuredChipText: { fontSize: 13, color: c.textSub, fontWeight: '500' },
    structuredChipTextSelected: { color: '#fff', fontWeight: '700' },
    input: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 15, color: c.text,
      borderWidth: 1, borderColor: c.borderMid,
    },
    multiline: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    summary: { backgroundColor: c.primaryTint, borderRadius: 12, padding: 16, marginTop: 20 },
    summaryLabel: { fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 8 },
    summaryLine: { fontSize: 13, color: c.textBody, marginBottom: 4, lineHeight: 20 },
    requiredStar: { color: c.error, fontWeight: '700' },
    fieldError: { color: c.error, fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: -4 },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
    photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    thumbImg: { width: 80, height: 80 },
    photoRemove: {
      position: 'absolute', top: 2, right: 2,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
      width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    },
    photoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    photoActions: { flexDirection: 'row', gap: 8 },
    photoBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.primaryTint, minWidth: 100,
    },
    photoBtnText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  })
}
