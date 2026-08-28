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
import DateField from '../components/DateField'
import Button from '../components/Button'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

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
  labelKey: TranslationKey
  placeholder: string
  keyboard?: 'default' | 'decimal-pad' | 'number-pad'
}
type StructuredChipsField = {
  type: 'chips'
  key: string
  labelKey: TranslationKey
  options: string[]
}
type StructuredField = StructuredTextField | StructuredChipsField

const STRUCTURED_ITEMS: Record<string, StructuredField[]> = {
  'Oil Change': [
    { type: 'chips', key: 'oilBrand', labelKey: 'addService.field.oilBrand', options: ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline'] },
    { type: 'chips', key: 'oilGrade', labelKey: 'addService.field.oilGrade', options: ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', '20W-50'] },
    { type: 'chips', key: 'oilType',  labelKey: 'addService.field.oilType', options: ['Mineral', 'Semi-synthetic', 'Full synthetic'] },
  ],
  'Tyre Change': [
    { type: 'chips', key: 'tyreBrand',    labelKey: 'addService.field.tyreBrand',    options: ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop'] },
    { type: 'text',  key: 'tyreSize',     labelKey: 'addService.field.tyreSize',     placeholder: 'e.g. 185/65R15' },
    { type: 'chips', key: 'tyresChanged', labelKey: 'addService.field.tyresChanged', options: ['1', '2', '4'] },
  ],
  'Emission Test / Carbon Test': [
    { type: 'text',  key: 'co',      labelKey: 'addService.field.co',      placeholder: 'e.g. 0.8',  keyboard: 'decimal-pad' },
    { type: 'text',  key: 'hc',      labelKey: 'addService.field.hc',      placeholder: 'e.g. 120',  keyboard: 'number-pad'  },
    { type: 'text',  key: 'co2',     labelKey: 'addService.field.co2',     placeholder: 'e.g. 14.2', keyboard: 'decimal-pad' },
    { type: 'text',  key: 'lambda',  labelKey: 'addService.field.lambda',  placeholder: 'e.g. 1.01', keyboard: 'decimal-pad' },
    { type: 'chips', key: 'result',  labelKey: 'addService.field.result',  options: ['Pass', 'Fail'] },
    { type: 'text',  key: 'station', labelKey: 'addService.field.station', placeholder: 'e.g. Werahera Testing Station' },
  ],
  'AC Gas Refill': [
    { type: 'chips', key: 'refrigerantType', labelKey: 'addService.field.refrigerantType', options: ['R134a', 'R1234yf', 'R22 (old)'] },
    { type: 'text',  key: 'quantityGrams',   labelKey: 'addService.field.quantityGrams',   placeholder: 'e.g. 450', keyboard: 'number-pad' },
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
  const { t } = useTranslation()

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
      Alert.alert(t('addService.limitReached.title'), t('addService.limitReached.message'))
      return
    }
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        t('addService.permissionNeeded.title'),
        t('addService.permissionNeeded.message', { source: t(source === 'camera' ? 'addService.cameraAccess' : 'addService.galleryAccess') })
      )
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
      Alert.alert(t('addService.uploadFailed.title'), e.message || t('addService.uploadFailed.message'))
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
      Alert.alert(t('addService.selectService.title'), t('addService.selectService.message'))
      return
    }
    const isoDate = parseDMY(date)
    if (!isoDate) {
      Alert.alert(t('addService.invalidDate.title'), t('addService.invalidDate.message'))
      return
    }
    if (!mileage.trim()) {
      Alert.alert(t('addService.mileageRequired.title'), t('addService.mileageRequired.message'))
      return
    }
    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum) || mileageNum <= 0) {
      Alert.alert(t('addService.invalidMileage.title'), t('addService.invalidMileage.message'))
      return
    }
    if (!cost.trim()) {
      Alert.alert(t('addService.costRequired.title'), t('addService.costRequired.message'))
      return
    }
    if (isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
      Alert.alert(t('addService.invalidCost.title'), t('addService.invalidCost.message'))
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
        Alert.alert(t('common.error'), error.message)
      } finally {
        setLoading(false)
      }
    }

    // Warn (don't block) if mileage is higher than current — could be a typo
    if (mileageNum > currentMileage + 500) {
      Alert.alert(
        t('addService.checkMileage.title'),
        t('addService.checkMileage.message', { entered: mileageNum.toLocaleString(), current: currentMileage.toLocaleString() }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('addService.yesSave'), onPress: doSave },
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
      <ScreenHeader title={t('addService.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>
        {t('addService.subtitle')} <Text style={styles.requiredStar}>*</Text>
      </Text>
      {saveAttempted && selectedItems.length === 0 && !otherText.trim() && (
        <Text style={styles.fieldError}>{t('addService.selectAtLeastOne')}</Text>
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
        label={t('addService.other')}
        value={otherText}
        onChangeText={setOtherText}
        placeholder={t('addService.otherPlaceholder')}
      />

      {/* ── Structured details section ────────────────────── */}
      {itemsWithStructured.length > 0 && (
        <View style={styles.structuredSection}>
          <Text style={styles.structuredTitle}>
            {itemsWithStructured.length === 1
              ? t('addService.itemDetails', { name: itemsWithStructured[0].name })
              : t('addService.serviceDetails')}
          </Text>
          <Text style={styles.structuredSub}>{t('addService.savedForAnalytics')}</Text>

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
                        <Text style={styles.structuredFieldLabel}>{t(field.labelKey)}</Text>
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
                      <Text style={styles.structuredFieldLabel}>{t(field.labelKey)}</Text>
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
          <Text style={styles.brandsSectionTitle}>{t('addService.partsBrand')}</Text>
          <Text style={styles.brandsSectionSub}>{t('addService.selectBrandSub')}</Text>

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
                  placeholder={t('addService.orTypeBrand')}
                />
              </View>
            )
          })}
        </View>
      )}

      {/* ── Date / Mileage / Cost ─────────────────────────── */}
      <View style={styles.row}>
        <View style={styles.half}>
          <DateField label={t('common.date')} value={date} onChange={setDate} maximumDate={new Date()} />
        </View>
        <View style={styles.half}>
          <FormField
            label={t('addService.mileage')}
            required
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <FormField
        label={t('addService.totalCost')}
        required
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4500"
        keyboardType="number-pad"
      />

      <Text style={styles.catLabel}>{t('addService.photos')}</Text>
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
                : <Text style={styles.photoBtnText}>📷 {t('addService.cameraBtn')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={() => pickPhoto('gallery')}
              disabled={uploadingPhoto}
            >
              <Text style={styles.photoBtnText}>🖼 {t('addService.galleryBtn')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FormField
        label={t('addService.notes')}
        style={styles.multiline}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('addService.notesPlaceholder')}
        multiline
        numberOfLines={2}
      />

      {selectedItems.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            {t('addService.servicesSelected', { count: selectedItems.length, s: selectedItems.length > 1 ? 's' : '' })}
          </Text>
          {selectedItems.map(i => (
            <Text key={i.name} style={styles.summaryLine}>
              • {i.name}{i.brand ? ` — ${i.brand}` : ''}
            </Text>
          ))}
        </View>
      )}

      <Button title={t('addService.saveRecord')} onPress={handleSubmit} loading={loading} />
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
    summary: { backgroundColor: c.primaryTint, borderRadius: 12, padding: 16, marginTop: 20, marginBottom: 20 },
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
