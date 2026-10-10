import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { BRAND_MODELS, BRANDS_LIST } from '../../constants/vehicleData'
import AppIcon from '../../components/AppIcon'

export type VehiclePickerResult = { make: string; model: string | null; yearFrom: number | null; yearTo: number | null }

// Spec: 04-screens.md §21.2 + §23 correction #6/#8. 3-step flow (Make -> Model -> Year),
// each step full-screen. A make with no entry in BRAND_MODELS (or the "Other" row) uses a
// free-text model field instead of a model list. Year chips: current year + 1 down to 1950.
const POPULAR_MAKES = ['Toyota', 'Suzuki', 'Honda', 'Nissan', 'Mitsubishi', 'Mazda']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS: number[] = []
for (let y = CURRENT_YEAR + 1; y >= 1950; y--) YEARS.push(y)

type Step = 1 | 2 | 3

export default function VehiclePickerScreen({
  initial, onSelect, onClose,
}: {
  initial?: Partial<VehiclePickerResult>
  onSelect: (result: VehiclePickerResult) => void
  onClose: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const [step, setStep] = useState<Step>(1)
  const [make, setMake] = useState<string | null>(initial?.make || null)
  const [model, setModel] = useState<string | null>(initial?.model ?? null)
  const [customModel, setCustomModel] = useState('')
  const [yearFrom, setYearFrom] = useState<number | null>(initial?.yearFrom ?? null)
  const [yearTo, setYearTo] = useState<number | null>(initial?.yearTo ?? null)
  const [pickingField, setPickingField] = useState<'from' | 'to'>('from')
  const [makeQuery, setMakeQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')

  const finish = (f: number | null, t: number | null) => {
    if (!make) return
    onSelect({ make, model, yearFrom: f, yearTo: t })
  }

  const back = () => {
    if (step === 1) { onClose(); return }
    setStep((step - 1) as Step)
  }

  // ---- Step 1: Make ----
  const makeQ = makeQuery.trim().toLowerCase()
  const allMakesOrdered = BRANDS_LIST.filter(m => m !== 'Other')
  const otherMakes = allMakesOrdered.filter(m => !POPULAR_MAKES.includes(m)).sort((a, b) => a.localeCompare(b))
  const makeMatches = (m: string) => !makeQ || m.toLowerCase().includes(makeQ)

  const chooseMake = (m: string) => {
    setMake(m)
    setModel(null)
    setCustomModel('')
    setYearFrom(null)
    setYearTo(null)
    setStep(2)
  }

  function renderStep1() {
    return (
      <>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search make"
            placeholderTextColor={colors.textFaint}
            value={makeQuery}
            onChangeText={setMakeQuery}
          />
        </View>
        <ScrollView>
          {!makeQ && (
            <>
              <Text style={styles.sectionLabel}>POPULAR IN SRI LANKA</Text>
              {POPULAR_MAKES.map(m => (
                <TouchableOpacity key={m} style={styles.row} onPress={() => chooseMake(m)}>
                  <Text style={styles.rowText}>{m}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.sectionLabel}>ALL MAKES</Text>
            </>
          )}
          {otherMakes.filter(makeMatches).map(m => (
            <TouchableOpacity key={m} style={styles.row} onPress={() => chooseMake(m)}>
              <Text style={styles.rowText}>{m}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.row} onPress={() => chooseMake('Other')}>
            <Text style={styles.rowText}>Other</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    )
  }

  // ---- Step 2: Model ----
  const models = make ? (BRAND_MODELS[make] || []) : []
  const hasModelList = models.length > 0
  const modelQ = modelQuery.trim().toLowerCase()
  const sortedModels = [...models].sort((a, b) => a.localeCompare(b)).filter(m => !modelQ || m.toLowerCase().includes(modelQ))

  const chooseModel = (m: string | null) => {
    setModel(m)
    if (m === null) { finish(null, null); return }
    setStep(3)
  }

  function renderStep2() {
    if (!hasModelList) {
      return (
        <View style={styles.freeTextWrap}>
          <Text style={styles.freeTextLabel}>Type the model</Text>
          <TextInput
            style={styles.freeTextInput}
            placeholder="e.g. Model name"
            placeholderTextColor={colors.textFaint}
            value={customModel}
            onChangeText={t => setCustomModel(t.slice(0, 40))}
            maxLength={40}
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { setModel(customModel.trim() || null); setStep(3) }}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </TouchableOpacity>
          <Text style={styles.skipLink} onPress={() => chooseModel(null)}>Skip (fits all models)</Text>
        </View>
      )
    }
    return (
      <>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search model"
            placeholderTextColor={colors.textFaint}
            value={modelQuery}
            onChangeText={setModelQuery}
          />
        </View>
        <FlatList
          data={sortedModels}
          keyExtractor={m => m}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListHeaderComponent={!modelQ ? (
            <>
              <TouchableOpacity style={styles.row} onPress={() => chooseModel(null)}>
                <View>
                  <Text style={styles.rowText}>All {make} models</Text>
                  <Text style={styles.subLine}>Fits all models</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          ) : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => chooseModel(item)}>
              <Text style={styles.rowText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </>
    )
  }

  // ---- Step 3: Year ----
  const effectiveFrom = yearFrom !== null && yearTo !== null ? Math.min(yearFrom, yearTo) : yearFrom
  const effectiveTo = yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo

  const tapYear = (y: number) => {
    if (pickingField === 'from') {
      setYearFrom(y)
      if (yearTo === null) setPickingField('to')
    } else {
      setYearTo(y)
    }
  }

  const clearYears = () => {
    setYearFrom(null)
    setYearTo(null)
    setPickingField('from')
  }

  const isInRange = (y: number) => {
    if (effectiveFrom === null) return false
    if (effectiveTo === null) return y === effectiveFrom
    return y >= effectiveFrom && y <= effectiveTo
  }

  const doneLabel = () => {
    let s = `Done · ${make}`
    if (model) s += ` ${model}`
    if (effectiveFrom !== null) s += ` ${effectiveFrom}${effectiveTo !== null && effectiveTo !== effectiveFrom ? `–${effectiveTo}` : ''}`
    return s
  }

  function renderStep3() {
    return (
      <>
        <Text style={styles.yearTitle}>{model || `All ${make} models`}</Text>
        <View style={styles.yearBoxRow}>
          <TouchableOpacity
            style={[styles.yearBox, pickingField === 'from' && styles.yearBoxActive]}
            onPress={() => setPickingField('from')}
          >
            <Text style={styles.yearBoxLabel}>Year from</Text>
            <Text style={styles.yearBoxValue}>{effectiveFrom ?? '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.yearBox, pickingField === 'to' && styles.yearBoxActive]}
            onPress={() => setPickingField('to')}
          >
            <Text style={styles.yearBoxLabel}>Year to</Text>
            <Text style={styles.yearBoxValue}>{effectiveTo ?? '—'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.skipLink} onPress={clearYears}>Fits all years</Text>
        <ScrollView contentContainerStyle={styles.yearGrid}>
          {YEARS.map(y => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, isInRange(y) && styles.yearChipSelected]}
              onPress={() => tapYear(y)}
            >
              <Text style={[styles.yearChipText, isInRange(y) && styles.yearChipTextSelected]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.doneBtn} onPress={() => finish(effectiveFrom, effectiveTo)}>
          <Text style={styles.doneBtnText}>{doneLabel()}</Text>
        </TouchableOpacity>
      </>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{step === 1 ? 'Make' : step === 2 ? make : model || `All ${make} models`}</Text>
          <Text style={styles.subtitle}>Step {step} of 3</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'close' }} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      {step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    titleWrap: { flex: 1, alignItems: 'center' },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
    searchInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14.5, color: c.text,
    },
    sectionLabel: {
      fontSize: 11.5, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5,
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
    },
    row: { paddingHorizontal: 20, paddingVertical: 14 },
    rowText: { fontSize: 14.5, fontWeight: '600', color: c.text },
    subLine: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 20 },

    freeTextWrap: { padding: 20 },
    freeTextLabel: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 8 },
    freeTextInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text, marginBottom: 16,
    },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
    skipLink: { color: c.primary, fontWeight: '700', fontSize: 13.5, textAlign: 'center', marginTop: 14, marginBottom: 8 },

    yearTitle: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center', marginTop: 16 },
    yearBoxRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
    yearBox: {
      flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 14, backgroundColor: c.surfaceAlt,
    },
    yearBoxActive: { borderWidth: 2, borderColor: c.primary },
    yearBoxLabel: { fontSize: 11.5, color: c.textMuted },
    yearBoxValue: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 2 },
    yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 20 },
    yearChip: {
      width: 70, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
      backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
    },
    yearChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    yearChipText: { fontSize: 13.5, fontWeight: '600', color: c.text },
    yearChipTextSelected: { color: '#fff' },
    doneBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', margin: 20 },
    doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
  })
}
