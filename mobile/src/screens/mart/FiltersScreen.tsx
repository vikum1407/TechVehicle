import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Modal, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'
import { MART_CATEGORIES } from '../../constants/martCategories'
import { DISTRICTS } from '../../constants/districts'
import VehiclePickerScreen, { VehiclePickerResult } from './VehiclePickerScreen'
import DistrictPickerScreen from './DistrictPickerScreen'

export type MartFilters = {
  categoryId: string | null
  make: string | null
  model: string | null
  yearFrom: number | null
  yearTo: number | null
  condition: 'new' | 'used' | null
  priceMin: number | null
  priceMax: number | null
  district: string | null
}

export const DEFAULT_MART_FILTERS: MartFilters = {
  categoryId: null, make: null, model: null, yearFrom: null, yearTo: null,
  condition: null, priceMin: null, priceMax: null, district: null,
}

export function activeFilterCount(f: MartFilters): number {
  let n = 0
  if (f.categoryId) n++
  if (f.make) n++
  if (f.condition) n++
  if (f.priceMin !== null || f.priceMax !== null) n++
  if (f.district) n++
  return n
}

function toQuery(f: MartFilters): Record<string, string | number | undefined> {
  return {
    categoryId: f.categoryId || undefined,
    make: f.make || undefined,
    model: f.model || undefined,
    yearFrom: f.yearFrom || undefined,
    yearTo: f.yearTo || undefined,
    condition: f.condition || undefined,
    priceMin: f.priceMin ?? undefined,
    priceMax: f.priceMax ?? undefined,
    district: f.district || undefined,
  }
}

// Spec: 04-screens.md §4. "Save this search" (Phase 2) is shown disabled, no function.
export default function FiltersScreen({ token, initial, onClose, onApply }: {
  token: string
  initial: MartFilters
  onClose: () => void
  onApply: (filters: MartFilters) => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom])

  const [draft, setDraft] = useState<MartFilters>(initial)
  const [priceMinText, setPriceMinText] = useState(initial.priceMin !== null ? String(initial.priceMin) : '')
  const [priceMaxText, setPriceMaxText] = useState(initial.priceMax !== null ? String(initial.priceMax) : '')
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false)
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  const priceInvalid = draft.priceMin !== null && draft.priceMax !== null && draft.priceMin > draft.priceMax

  useEffect(() => {
    if (priceInvalid) { setCount(null); return }
    setCountLoading(true)
    const handle = setTimeout(() => {
      api.getMartListingsCount(token, toQuery(draft))
        .then(r => setCount(r.count))
        .catch(() => setCount(null))
        .finally(() => setCountLoading(false))
    }, 400)
    return () => clearTimeout(handle)
  }, [draft, priceInvalid])

  const vehicleLabel = () => {
    if (!draft.make) return 'Any vehicle'
    let s = draft.make
    if (draft.model) s += ` ${draft.model}`
    if (draft.yearFrom) s += ` ${draft.yearFrom}${draft.yearTo && draft.yearTo !== draft.yearFrom ? `–${draft.yearTo}` : ''}`
    return s
  }

  const districtLabel = draft.district ? DISTRICTS.find(d => d.id === draft.district)?.en : null

  const reset = () => {
    setDraft(DEFAULT_MART_FILTERS)
    setPriceMinText('')
    setPriceMaxText('')
  }

  const applyVehicle = (v: VehiclePickerResult) => setDraft(prev => ({ ...prev, make: v.make, model: v.model, yearFrom: v.yearFrom, yearTo: v.yearTo }))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'close' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity onPress={reset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          <TouchableOpacity
            style={[styles.chip, !draft.categoryId && styles.chipActive]}
            onPress={() => setDraft(prev => ({ ...prev, categoryId: null }))}
          >
            <Text style={[styles.chipText, !draft.categoryId && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {MART_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, draft.categoryId === cat.id && styles.chipActive]}
              onPress={() => setDraft(prev => ({ ...prev, categoryId: cat.id }))}
            >
              <Text style={[styles.chipText, draft.categoryId === cat.id && styles.chipTextActive]}>{cat.en}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Compatible Vehicle</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setVehiclePickerOpen(true)}>
          <Text style={draft.make ? styles.fieldValue : styles.fieldPlaceholder}>{vehicleLabel()}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.label}>Condition</Text>
        <View style={styles.segmentRow}>
          {([null, 'new', 'used'] as const).map(c => (
            <TouchableOpacity
              key={c ?? 'any'}
              style={[styles.segmentBtn, draft.condition === c && styles.segmentBtnActive]}
              onPress={() => setDraft(prev => ({ ...prev, condition: c }))}
            >
              <Text style={[styles.segmentText, draft.condition === c && styles.segmentTextActive]}>
                {c === null ? 'Any' : c === 'new' ? 'New' : 'Used'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Price Range (Rs.)</Text>
        <View style={styles.priceRow}>
          <TextInput
            style={styles.priceInput}
            placeholder="Min"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={priceMinText}
            onChangeText={t => { const v = t.replace(/[^0-9]/g, ''); setPriceMinText(v); setDraft(prev => ({ ...prev, priceMin: v ? Number(v) : null })) }}
          />
          <Text style={styles.priceDash}>—</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="Max"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={priceMaxText}
            onChangeText={t => { const v = t.replace(/[^0-9]/g, ''); setPriceMaxText(v); setDraft(prev => ({ ...prev, priceMax: v ? Number(v) : null })) }}
          />
        </View>
        {priceInvalid ? <Text style={styles.errorText}>Min must not be above Max</Text> : null}

        <Text style={styles.label}>Location</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setDistrictPickerOpen(true)}>
          <Text style={draft.district ? styles.fieldValue : styles.fieldPlaceholder}>{districtLabel || 'Select district'}</Text>
          <AppIcon icon={{ lib: 'ion', name: 'chevron-forward' }} size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.saveSearchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Save this search</Text>
            <Text style={styles.saveSearchHint}>Get notified of new matches — coming soon</Text>
          </View>
          <Switch value={false} disabled trackColor={{ false: colors.borderMid, true: colors.primaryTint }} />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.applyBtn, priceInvalid && styles.applyBtnDisabled]}
          disabled={priceInvalid}
          onPress={() => onApply(draft)}
        >
          <Text style={styles.applyBtnText}>
            {priceInvalid ? 'Show Results' : countLoading && count === null ? 'Show Results' : count !== null ? `Show ${count} Results` : 'Show Results'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={vehiclePickerOpen} animationType="slide" onRequestClose={() => setVehiclePickerOpen(false)}>
        <VehiclePickerScreen
          initial={draft.make ? { make: draft.make, model: draft.model, yearFrom: draft.yearFrom, yearTo: draft.yearTo } : undefined}
          onSelect={v => { applyVehicle(v); setVehiclePickerOpen(false) }}
          onClose={() => setVehiclePickerOpen(false)}
        />
      </Modal>
      <Modal visible={districtPickerOpen} animationType="slide" onRequestClose={() => setDistrictPickerOpen(false)}>
        <DistrictPickerScreen
          selected={draft.district}
          onSelect={id => setDraft(prev => ({ ...prev, district: id }))}
          onClose={() => setDistrictPickerOpen(false)}
        />
      </Modal>
    </View>
  )
}

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    resetText: { fontSize: 14, fontWeight: '700', color: c.accent },
    body: { padding: 20 },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 8, marginTop: 18 },
    errorText: { fontSize: 12, color: c.error, marginTop: 6 },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.borderMid,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textBody },
    chipTextActive: { color: '#fff' },

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

    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    priceInput: {
      flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text,
    },
    priceDash: { color: c.textMuted, fontSize: 14 },

    saveSearchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 12, opacity: 0.6 },
    saveSearchHint: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },

    bottomBar: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 16, paddingBottom: bottomInset + 16,
    },
    applyBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    applyBtnDisabled: { opacity: 0.6 },
    applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  })
}
