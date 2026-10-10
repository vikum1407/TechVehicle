import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, Switch,
  ActivityIndicator, Alert, Modal, StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { DISTRICTS } from '../../constants/districts'
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

// Spec: 04-screens.md §2 (Selling only — Wanted posting is Milestone 2 Step 2.1, so the
// Selling|Wanted switch isn't built yet; this screen always posts type:"selling"). This is
// also the first real caller of the Step 1.1 pickers and the first-action gate (§22) —
// the gate runs here before the form is shown at all.
export default function PostAdScreen({ token, onBack, onPosted }: {
  token: string
  onBack: () => void
  onPosted: (listingId: string) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [gateStep, setGateStep] = useState<'loading' | 'nameDistrict' | 'rules' | 'form'>('loading')

  const [category, setCategory] = useState<CategoryPickerResult | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [condition, setCondition] = useState<'new' | 'used' | null>(null)
  const [vehicle, setVehicle] = useState<VehiclePickerResult | null>(null)
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [district, setDistrict] = useState<string | null>(null)
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false)
  const [deliveryAvailable, setDeliveryAvailable] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

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
    if (!category) return 'Select category'
    const cat = MART_CATEGORIES.find(c => c.id === category.categoryId)
    if (!cat) return 'Select category'
    const type = category.categoryTypeId ? cat.types.find(t => t.id === category.categoryTypeId) : null
    return type ? type.en : `All ${cat.en}`
  }

  const vehicleLabel = () => {
    if (!vehicle) return 'Select vehicle'
    let s = vehicle.make
    if (vehicle.model) s += ` ${vehicle.model}`
    else s += ' · all models'
    if (vehicle.yearFrom) s += ` ${vehicle.yearFrom}${vehicle.yearTo && vehicle.yearTo !== vehicle.yearFrom ? `–${vehicle.yearTo}` : ''}`
    return s
  }

  const districtLabel = district ? DISTRICTS.find(d => d.id === district)?.en : null

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
      const compressed = await ImageManipulator.manipulateAsync(
        uris[i],
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const index = startIndex + i
      setPhotos(prev => prev.map((p, idx) => (idx === index ? { ...p, localUri: compressed.uri } : p)))
      await uploadAt(index, compressed.uri)
    }
  }

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo library access to add photos.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7, mediaTypes: ['images'],
      allowsMultipleSelection: true, selectionLimit: remainingSlots,
    })
    if (result.canceled || result.assets.length === 0) return
    await addAssets(result.assets.map(a => a.uri))
  }

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) { Alert.alert('Permission needed', 'Allow camera access to take a photo.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || result.assets.length === 0) return
    await addAssets([result.assets[0].uri])
  }

  const addPhotoPressed = () => {
    if (remainingSlots <= 0) return
    Alert.alert('Add photos', undefined, [
      { text: 'Take Photo', onPress: pickFromCamera },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const removePhoto = (index: number) => setPhotos(prev => prev.filter((_, i) => i !== index))
  const retryPhoto = (index: number) => { const p = photos[index]; if (p) uploadAt(index, p.localUri) }

  // ---- Submit ----
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (photos.length === 0) e.photos = 'Add at least 1 photo'
    else if (photos.some(p => p.uploading)) e.photos = 'Wait for photos to finish uploading'
    else if (photos.some(p => p.error)) e.photos = 'Remove or retry the failed photo'
    if (!category) e.category = 'Select a category'
    if (!condition) e.condition = 'Select New or Used'
    if (!vehicle) e.vehicle = 'Select a vehicle make'
    if (!title.trim()) e.title = 'Enter a title'
    const priceNum = Number(price)
    if (!price || !Number.isInteger(priceNum) || priceNum < 1 || priceNum > PRICE_MAX) e.price = 'Enter a valid price'
    if (!district) e.district = 'Select a district'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await api.postMartListing(token, {
        type: 'selling',
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId: category!.categoryId,
        categoryTypeId: category!.categoryTypeId,
        condition,
        make: vehicle!.make,
        model: vehicle!.model,
        yearFrom: vehicle!.yearFrom,
        yearTo: vehicle!.yearTo,
        price: Number(price),
        district,
        deliveryAvailable,
        photoUrls: photos.map(p => p.url!),
      })
      onPosted(result.id)
    } catch (err: any) {
      setSubmitError(err.message || "Couldn't post your ad. Check your connection and try again.")
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
        <Text style={styles.title}>Post Ad</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <Text style={styles.label}>Photos (up to {MAX_PHOTOS})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoTile}>
              {p.localUri ? <Image source={{ uri: p.localUri }} style={styles.photoImage} /> : null}
              {p.uploading ? (
                <View style={styles.photoOverlay}><ActivityIndicator color="#fff" size="small" /></View>
              ) : p.error ? (
                <TouchableOpacity style={styles.photoOverlay} onPress={() => retryPhoto(i)}>
                  <AppIcon icon={{ lib: 'ion', name: 'refresh' }} size={18} color="#fff" />
                  <Text style={styles.photoRetryText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                <AppIcon icon={{ lib: 'ion', name: 'close' }} size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {remainingSlots > 0 && (
            <TouchableOpacity style={styles.photoAddTile} onPress={addPhotoPressed}>
              <AppIcon icon={{ lib: 'ion', name: 'add' }} size={22} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </ScrollView>
        {errors.photos ? <Text style={styles.errorText}>{errors.photos}</Text> : null}

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setCategoryPickerOpen(true)}>
          <Text style={category ? styles.fieldValue : styles.fieldPlaceholder}>{categoryLabel()}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

        <Text style={styles.label}>Condition</Text>
        <View style={styles.segmentRow}>
          {(['new', 'used'] as const).map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.segmentBtn, condition === c && styles.segmentBtnActive]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.segmentText, condition === c && styles.segmentTextActive]}>
                {c === 'new' ? 'New' : 'Used'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.condition ? <Text style={styles.errorText}>{errors.condition}</Text> : null}

        <Text style={styles.label}>Compatible Vehicle</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setVehiclePickerOpen(true)}>
          <Text style={vehicle ? styles.fieldValue : styles.fieldPlaceholder}>{vehicleLabel()}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.vehicle ? <Text style={styles.errorText}>{errors.vehicle}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Brake Pads (Front) — Toyota Axio"
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={t => setTitle(t.slice(0, TITLE_MAX))}
          maxLength={TITLE_MAX}
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Describe the part's condition, fitment notes, etc."
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={t => setDescription(t.slice(0, DESCRIPTION_MAX))}
          maxLength={DESCRIPTION_MAX}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Price</Text>
        <View style={styles.priceRow}>
          <Text style={styles.pricePrefix}>Rs.</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="0.00"
            placeholderTextColor={colors.textFaint}
            value={price}
            onChangeText={t => setPrice(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
        </View>
        {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}

        <Text style={styles.label}>Location</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setDistrictPickerOpen(true)}>
          <Text style={district ? styles.fieldValue : styles.fieldPlaceholder}>{districtLabel || 'Select district'}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {errors.district ? <Text style={styles.errorText}>{errors.district}</Text> : null}

        <View style={styles.deliveryRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Can arrange delivery</Text>
            <Text style={styles.deliveryHint}>You'll coordinate delivery directly with the buyer</Text>
          </View>
          <Switch
            value={deliveryAvailable}
            onValueChange={setDeliveryAvailable}
            trackColor={{ false: colors.borderMid, true: colors.primaryTint }}
            thumbColor={deliveryAvailable ? colors.primary : colors.surfaceAlt}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} disabled={submitting} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>{submitting ? 'Posting…' : 'Post Ad'}</Text>
        </TouchableOpacity>
      </View>

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
