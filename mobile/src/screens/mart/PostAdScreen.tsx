import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, Switch,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { DISTRICTS } from '../../constants/districts'
import { localizedLabel } from '../../utils/martHelpers'
import NameDistrictSheet from './NameDistrictSheet'
import MartRulesScreen from './MartRulesScreen'
import CategoryPickerScreen, { CategoryPickerResult } from './CategoryPickerScreen'
import VehiclePickerScreen, { VehiclePickerResult } from './VehiclePickerScreen'
import DistrictPickerScreen from './DistrictPickerScreen'

const MAX_PHOTOS = 8
const TITLE_MAX = 100
const DESCRIPTION_MAX = 3000
const PRICE_MAX = 100_000_000

type Photo = { localUri: string; url: string | null; uploading: boolean; error: string | null }

// Spec: 04-screens.md §2. Milestone 2 Step 2.1 adds the Selling|Wanted switch at the top
// of this form (disabled in edit mode, same as the spec says) and the Wanted-mode field
// differences: Condition and delivery toggle hidden, photos optional (0 allowed), Price
// becomes a Budget Range (min optional, max required if any budget given). This is also
// the first real caller of the Step 1.1 pickers and the first-action gate (§22) — the
// gate runs here before the form is shown at all.
//
// Step 1.5: `editing` turns this into the Edit screen (same form, prefilled, PATCH
// instead of POST) per §2's "Entry: ... also used for Edit (same form, prefilled)."
export type EditingListing = {
  listingId: string
  listing: {
    type: 'selling' | 'wanted'
    categoryId: string; categoryTypeId: string | null; condition: string | null
    make: string | null; model: string | null; yearFrom: number | null; yearTo: number | null
    title: string; description: string | null; price: number | null
    budgetMin: number | null; budgetMax: number | null
    district: string; deliveryAvailable: boolean; photoUrls: string[]
  }
}

export default function PostAdScreen({ token, editing, initialType, onBack, onPosted }: {
  token: string
  editing?: EditingListing
  initialType?: 'selling' | 'wanted'
  onBack: () => void
  onPosted: (listingId: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [gateStep, setGateStep] = useState<'loading' | 'nameDistrict' | 'rules' | 'form'>('loading')

  const [type, setType] = useState<'selling' | 'wanted'>(editing?.listing.type ?? initialType ?? 'selling')
  const isSelling = type === 'selling'
  const [category, setCategory] = useState<CategoryPickerResult | null>(
    editing ? { categoryId: editing.listing.categoryId, categoryTypeId: editing.listing.categoryTypeId } : null
  )
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [condition, setCondition] = useState<'new' | 'used' | null>((editing?.listing.condition as 'new' | 'used' | null) ?? null)
  const [vehicle, setVehicle] = useState<VehiclePickerResult | null>(
    editing?.listing.make ? { make: editing.listing.make, model: editing.listing.model, yearFrom: editing.listing.yearFrom, yearTo: editing.listing.yearTo } : null
  )
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false)
  const [title, setTitle] = useState(editing?.listing.title ?? '')
  const [description, setDescription] = useState(editing?.listing.description ?? '')
  const [price, setPrice] = useState(editing?.listing.price != null ? String(editing.listing.price) : '')
  const [budgetMin, setBudgetMin] = useState(editing?.listing.budgetMin != null ? String(editing.listing.budgetMin) : '')
  const [budgetMax, setBudgetMax] = useState(editing?.listing.budgetMax != null ? String(editing.listing.budgetMax) : '')
  const [district, setDistrict] = useState<string | null>(editing?.listing.district ?? null)
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false)
  const [deliveryAvailable, setDeliveryAvailable] = useState(editing?.listing.deliveryAvailable ?? false)
  const [photos, setPhotos] = useState<Photo[]>(
    editing ? editing.listing.photoUrls.map(url => ({ localUri: url, url, uploading: false, error: null })) : []
  )
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isPicking, setIsPicking] = useState(false)

  useEffect(() => { checkGate() }, [])

  const checkGate = async () => {
    try {
      const me = await api.getMartMe(token)
      if (!me.displayName || !me.district) { setGateStep('nameDistrict'); return }
      if (!district) setDistrict(me.district)
      if (!me.rulesAccepted) { setGateStep('rules'); return }
      setGateStep('form')
    } catch {
      // Fails open to the form rather than trapping the user on a dead loading
      // screen — the server re-checks profile/rules on submit regardless.
      setGateStep('form')
    }
  }

  const categoryLabel = () => {
    if (!category) return t('mart.postAd.selectCategory')
    const cat = MART_CATEGORIES.find(c => c.id === category.categoryId)
    if (!cat) return t('mart.postAd.selectCategory')
    const type = category.categoryTypeId ? cat.types.find(ty => ty.id === category.categoryTypeId) : null
    return type ? type.en : t('mart.postAd.allCategory', { category: localizedLabel(language, cat) })
  }

  const vehicleLabel = () => {
    if (!vehicle) return t('mart.postAd.selectVehicle')
    let s = vehicle.make
    if (vehicle.model) s += ` ${vehicle.model}`
    else s += ` · ${t('mart.postAd.allModels')}`
    if (vehicle.yearFrom) s += ` ${vehicle.yearFrom}${vehicle.yearTo && vehicle.yearTo !== vehicle.yearFrom ? `–${vehicle.yearTo}` : ''}`
    return s
  }

  const selectedDistrict = district ? DISTRICTS.find(d => d.id === district) : null
  const districtLabel = selectedDistrict ? localizedLabel(language, selectedDistrict) : null

  // ---- Photos ----
  const remainingSlots = MAX_PHOTOS - photos.length

  const uploadAt = async (index: number, localUri: string) => {
    setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, uploading: true, error: null } : p)))
    try {
      const url = await api.uploadPhoto(token, localUri, 'mart')
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, url, uploading: false } : p)))
    } catch (e: any) {
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, uploading: false, error: e.message || 'Upload failed' } : p)))
    }
  }

  const addAssets = async (uris: string[]) => {
    const startIndex = photos.length
    const newPhotos: Photo[] = uris.map(() => ({ localUri: '', url: null, uploading: true, error: null }))
    setPhotos(prev => [...prev, ...newPhotos])

    // Uploaded one by one, in order, per the spec — not in parallel.
    for (let i = 0; i < uris.length; i++) {
      const index = startIndex + i
      try {
        // 2026-10-17: manipulateAsync had no try/catch at all — a failure here (e.g. a
        // picker-returned URI it can't open) threw unhandled and left this tile stuck
        // invisible forever (localUri still ''), with no error shown. Still unresolved
        // as of 2026-10-17 (traced so far to device-level OOM in the system Photo
        // Picker's own thumbnail grid, not this code — see DECISIONS-MADE.md), but this
        // error-surfacing fix is correct regardless of that root cause.
        const compressed = await ImageManipulator.manipulateAsync(
          uris[i],
          [{ resize: { width: 1280 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        )
        setPhotos(prev => prev.map((p, idx) => (idx === index ? { ...p, localUri: compressed.uri } : p)))
        await uploadAt(index, compressed.uri)
      } catch (e: any) {
        setPhotos(prev => prev.map((p, idx) => (idx === index ? { ...p, uploading: false, error: e?.message || t('mart.postAd.couldntProcessPhoto') } : p)))
      }
    }
  }

  const pickFromLibrary = async () => {
    if (isPicking) return
    setIsPicking(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) { Alert.alert(t('mart.common.permissionNeeded'), t('mart.common.allowPhotoLibrary')); return }
      // `legacy: true` found 2026-10-16: on at least one real device (Samsung J5), the
      // default (non-legacy) Android picker started throwing a native
      // "Uri lacks 'file' scheme" IllegalArgumentException after working fine for weeks
      // — a device/OS-level regression (this device's system Photo Picker component,
      // likely updated via a background Google Play system update, stopped handing off
      // a URI expo-image-picker's modern code path can resolve to file://). `legacy`
      // forces the older, more broadly-compatible picker intent. Confirmed fixed on
      // that device; kept since it's zero-risk (Android-only, officially supported
      // option) and protects against the same regression recurring elsewhere.
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7, mediaTypes: ['images'], legacy: true,
        allowsMultipleSelection: true, selectionLimit: remainingSlots,
      })
      if (result.canceled || result.assets.length === 0) return
      await addAssets(result.assets.map(a => a.uri))
    } finally {
      setIsPicking(false)
    }
  }

  const pickFromCamera = async () => {
    if (isPicking) return
    setIsPicking(true)
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) { Alert.alert(t('mart.common.permissionNeeded'), t('mart.postAd.allowCamera')); return }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
      if (result.canceled || result.assets.length === 0) return
      await addAssets([result.assets[0].uri])
    } finally {
      setIsPicking(false)
    }
  }

  const addPhotoPressed = () => {
    // Same isPicking guard as the Profile photo picker's "opening twice" fix (2026-09-05)
    // and OfferSheet's own copy of this pattern — `remainingSlots` alone can't block a
    // fast re-tap since `photos.length` doesn't change until the picker has resolved.
    if (remainingSlots <= 0 || isPicking) return
    Alert.alert(t('mart.postAd.addPhotos'), undefined, [
      { text: t('mart.postAd.takePhoto'), onPress: pickFromCamera },
      { text: t('mart.postAd.chooseFromLibrary'), onPress: pickFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  const removePhoto = (index: number) => setPhotos(prev => prev.filter((_, i) => i !== index))
  const retryPhoto = (index: number) => { const p = photos[index]; if (p) uploadAt(index, p.localUri) }

  // ---- Submit ----
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (isSelling && photos.length === 0) e.photos = t('mart.postAd.addAtLeastOnePhoto')
    else if (photos.some(p => p.uploading)) e.photos = t('mart.offer.waitForPhotos')
    else if (photos.some(p => p.error)) e.photos = t('mart.offer.retryFailedPhoto')
    if (!category) e.category = t('mart.postAd.selectCategoryError')
    if (isSelling && !condition) e.condition = t('mart.postAd.selectNewOrUsed')
    if (isSelling && !vehicle) e.vehicle = t('mart.postAd.selectVehicleMake')
    if (!title.trim()) e.title = t('mart.postAd.enterTitle')
    if (isSelling) {
      const priceNum = Number(price)
      if (!price || !Number.isInteger(priceNum) || priceNum < 1 || priceNum > PRICE_MAX) e.price = t('mart.postAd.enterValidPrice')
    } else if (budgetMin || budgetMax) {
      const maxNum = Number(budgetMax)
      if (!budgetMax || !Number.isInteger(maxNum) || maxNum < 1 || maxNum > PRICE_MAX) e.price = t('mart.postAd.enterValidMaxBudget')
      else if (budgetMin) {
        const minNum = Number(budgetMin)
        if (!Number.isInteger(minNum) || minNum < 1 || minNum > maxNum) e.price = t('mart.postAd.minNotAboveMax')
      }
    }
    if (!district) e.district = t('mart.postAd.selectDistrictError')
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSubmitting(true)
    setSubmitError('')
    const body = {
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: category!.categoryId,
      categoryTypeId: category!.categoryTypeId,
      condition: isSelling ? condition : undefined,
      make: vehicle?.make,
      model: vehicle?.model,
      yearFrom: vehicle?.yearFrom,
      yearTo: vehicle?.yearTo,
      price: isSelling ? Number(price) : undefined,
      budgetMin: !isSelling && budgetMin ? Number(budgetMin) : undefined,
      budgetMax: !isSelling && budgetMax ? Number(budgetMax) : undefined,
      district,
      deliveryAvailable: isSelling ? deliveryAvailable : false,
      photoUrls: photos.map(p => p.url!),
    }
    try {
      if (editing) {
        await api.patchMartListing(token, editing.listingId, body)
        onPosted(editing.listingId)
      } else {
        const result = await api.postMartListing(token, body)
        onPosted(result.id)
      }
    } catch (err: any) {
      setSubmitError(err.message || (editing ? t('mart.postAd.couldntSaveChanges') : t('mart.postAd.couldntPostAd')))
    } finally {
      setSubmitting(false)
    }
  }

  if (gateStep === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (gateStep === 'nameDistrict') {
    return (
      <View style={styles.container}>
        <NameDistrictSheet
          visible
          token={token}
          onDone={checkGate}
          onClose={onBack}
        />
      </View>
    )
  }

  if (gateStep === 'rules') {
    return (
      <MartRulesScreen
        mode="firstAction"
        token={token}
        onBack={onBack}
        onAccepted={checkGate}
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{editing ? t('mart.postAd.editAd') : isSelling ? t('mart.postAd.postAd') : t('mart.postAd.postWantedAd')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <Text style={styles.label}>{t('mart.postAd.whatAreYouPosting')}</Text>
        <View style={[styles.segmentRow, editing && { opacity: 0.6 }]}>
          {(['selling', 'wanted'] as const).map(ty => (
            <TouchableOpacity
              key={ty}
              style={[styles.segmentBtn, type === ty && styles.segmentBtnActive]}
              disabled={!!editing}
              onPress={() => setType(ty)}
            >
              <Text style={[styles.segmentText, type === ty && styles.segmentTextActive]}>
                {ty === 'selling' ? t('mart.home.selling') : t('mart.home.wanted')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{isSelling ? t('mart.postAd.photosLabel', { max: MAX_PHOTOS }) : t('mart.postAd.photosLabelOptional', { max: MAX_PHOTOS })}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoTile}>
              {p.localUri ? <Image source={{ uri: p.localUri }} style={styles.photoImage} /> : null}
              {p.uploading ? (
                <View style={styles.photoOverlay}><ActivityIndicator color="#fff" size="small" /></View>
              ) : p.error ? (
                <TouchableOpacity style={styles.photoOverlay} onPress={() => retryPhoto(i)}>
                  <AppIcon icon={{ lib: 'ion', name: 'refresh' }} size={18} color="#fff" />
                  <Text style={styles.photoRetryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                <AppIcon icon={{ lib: 'ion', name: 'close' }} size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {remainingSlots > 0 && (
            <TouchableOpacity style={styles.photoAddTile} onPress={addPhotoPressed} disabled={isPicking}>
              <AppIcon icon={{ lib: 'ion', name: 'add' }} size={22} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </ScrollView>
        {errors.photos ? <Text style={styles.errorText}>{errors.photos}</Text> : null}

        <Text style={styles.label}>{t('mart.postAd.category')}</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setCategoryPickerOpen(true)}>
          <Text style={category ? styles.fieldValue : styles.fieldPlaceholder}>{categoryLabel()}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

        {isSelling ? (
          <>
            <Text style={styles.label}>{t('mart.detail.condition')}</Text>
            <View style={styles.segmentRow}>
              {(['new', 'used'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.segmentBtn, condition === c && styles.segmentBtnActive]}
                  onPress={() => setCondition(c)}
                >
                  <Text style={[styles.segmentText, condition === c && styles.segmentTextActive]}>
                    {c === 'new' ? t('mart.common.conditionNew') : t('mart.common.conditionUsed')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.condition ? <Text style={styles.errorText}>{errors.condition}</Text> : null}
          </>
        ) : null}

        <Text style={styles.label}>{t('mart.postAd.compatibleVehicle')}</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setVehiclePickerOpen(true)}>
          <Text style={vehicle ? styles.fieldValue : styles.fieldPlaceholder}>{vehicleLabel()}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.vehicle ? <Text style={styles.errorText}>{errors.vehicle}</Text> : null}

        <Text style={styles.label}>{t('mart.postAd.titleLabel')}</Text>
        <TextInput
          style={styles.textInput}
          placeholder={t('mart.postAd.titlePlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={v => setTitle(v.slice(0, TITLE_MAX))}
          maxLength={TITLE_MAX}
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

        <Text style={styles.label}>{t('mart.common.description')}</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder={t('mart.postAd.descriptionPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={v => setDescription(v.slice(0, DESCRIPTION_MAX))}
          maxLength={DESCRIPTION_MAX}
          multiline
          numberOfLines={4}
        />

        {isSelling ? (
          <>
            <Text style={styles.label}>{t('mart.postAd.price')}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.pricePrefix}>{t('mart.common.rsPrefix')}</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                placeholderTextColor={colors.textFaint}
                value={price}
                onChangeText={v => setPrice(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('mart.postAd.budgetRange')}</Text>
            <View style={styles.budgetRow}>
              <View style={[styles.priceRow, { flex: 1 }]}>
                <Text style={styles.pricePrefix}>{t('mart.common.rsPrefix')}</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder={t('mart.postAd.minOptional')}
                  placeholderTextColor={colors.textFaint}
                  value={budgetMin}
                  onChangeText={v => setBudgetMin(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.priceRow, { flex: 1 }]}>
                <Text style={styles.pricePrefix}>{t('mart.common.rsPrefix')}</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder={t('mart.offer.pricePlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={budgetMax}
                  onChangeText={v => setBudgetMax(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </>
        )}
        {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}

        <Text style={styles.label}>{t('mart.postAd.location')}</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setDistrictPickerOpen(true)}>
          <Text style={district ? styles.fieldValue : styles.fieldPlaceholder}>{districtLabel || t('mart.postAd.selectDistrict')}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.district ? <Text style={styles.errorText}>{errors.district}</Text> : null}

        {isSelling ? (
          <View style={styles.deliveryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('mart.postAd.canArrangeDelivery')}</Text>
              <Text style={styles.deliveryHint}>{t('mart.postAd.deliveryHint')}</Text>
            </View>
            <Switch
              value={deliveryAvailable}
              onValueChange={setDeliveryAvailable}
              trackColor={{ false: colors.borderMid, true: colors.primaryTint }}
              thumbColor={deliveryAvailable ? colors.primary : colors.surfaceAlt}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} disabled={submitting} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>
            {submitting ? (editing ? t('mart.postAd.saving') : t('mart.postAd.posting')) : (editing ? t('mart.postAd.saveChanges') : isSelling ? t('mart.postAd.postAd') : t('mart.postAd.postWantedAd'))}
          </Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={categoryPickerOpen} animationType="slide" onRequestClose={() => setCategoryPickerOpen(false)}>
        <CategoryPickerScreen onSelect={setCategory} onClose={() => setCategoryPickerOpen(false)} />
      </Modal>
      <Modal visible={vehiclePickerOpen} animationType="slide" onRequestClose={() => setVehiclePickerOpen(false)}>
        <VehiclePickerScreen initial={vehicle || undefined} onSelect={setVehicle} onClose={() => setVehiclePickerOpen(false)} />
      </Modal>
      <Modal visible={districtPickerOpen} animationType="slide" onRequestClose={() => setDistrictPickerOpen(false)}>
        <DistrictPickerScreen selected={district} onSelect={setDistrict} onClose={() => setDistrictPickerOpen(false)} />
      </Modal>
    </View>
  )
}

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    centered: { alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { padding: 20, paddingBottom: 20 },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 18 },
    errorText: { fontSize: 12, color: c.error, marginTop: 6 },
    submitError: { fontSize: 13, color: c.error, backgroundColor: c.accentTint, borderRadius: 8, padding: 10, marginBottom: 10 },

    photoStrip: { flexDirection: 'row' },
    photoTile: {
      width: 76, height: 76, borderRadius: 10, marginRight: 10, backgroundColor: c.surfaceAlt,
      overflow: 'hidden',
    },
    photoImage: { width: '100%', height: '100%' },
    photoOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center',
    },
    photoRetryText: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 },
    photoRemove: {
      position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
      backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    photoAddTile: {
      width: 76, height: 76, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt,
    },

    fieldRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    },
    fieldValue: { fontSize: 14.5, color: c.text },
    fieldPlaceholder: { fontSize: 14.5, color: c.textFaint },

    segmentRow: { flexDirection: 'row', gap: 10 },
    segmentBtn: {
      flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
      backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
    },
    segmentBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { fontSize: 14, fontWeight: '600', color: c.textBody },
    segmentTextActive: { color: '#fff' },

    textInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text,
    },
    textArea: { minHeight: 90, textAlignVertical: 'top' },

    priceRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14,
    },
    pricePrefix: { fontSize: 14.5, color: c.textMuted, marginRight: 6 },
    priceInput: { flex: 1, paddingVertical: 12, fontSize: 14.5, color: c.text },
    budgetRow: { flexDirection: 'row', gap: 10 },

    deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 12 },
    deliveryHint: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },

    bottomBar: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 16, paddingBottom: bottomInset + 16,
    },
    submitBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  })
}
