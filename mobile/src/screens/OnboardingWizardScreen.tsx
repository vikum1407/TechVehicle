import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  vehicleType?: string | null
  mileage: number
}

type Props = {
  token: string
  vehicle: Vehicle
  onDone: () => void
}

// ── Step 1: Major milestones ──────────────────────────────────────────────────

type Milestone = {
  id: string
  labelKey: TranslationKey
  questionKey: TranslationKey
  serviceCategory: string
  icon: string
}

const MILESTONES: Milestone[] = [
  { id: 'oil',       icon: '🛢️', labelKey: 'onboarding.milestone.oil.label',       questionKey: 'onboarding.milestone.oil.question',       serviceCategory: 'Oil & Filter Change' },
  { id: 'timing',    icon: '⚙️', labelKey: 'onboarding.milestone.timing.label',    questionKey: 'onboarding.milestone.timing.question',    serviceCategory: 'Timing Belt / Chain' },
  { id: 'brakes',    icon: '🛑', labelKey: 'onboarding.milestone.brakes.label',    questionKey: 'onboarding.milestone.brakes.question',    serviceCategory: 'Brake Pads' },
  { id: 'battery',   icon: '🔋', labelKey: 'onboarding.milestone.battery.label',   questionKey: 'onboarding.milestone.battery.question',   serviceCategory: 'Battery' },
  { id: 'chain',     icon: '⛓️', labelKey: 'onboarding.milestone.chain.label',     questionKey: 'onboarding.milestone.chain.question',     serviceCategory: 'Chain & Sprocket' },
  { id: 'hydraulic', icon: '💧', labelKey: 'onboarding.milestone.hydraulic.label', questionKey: 'onboarding.milestone.hydraulic.question', serviceCategory: 'Hydraulic Oil' },
]

const MILESTONE_FOR: Record<string, string[]> = {
  oil:       ['motorcycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy'],
  timing:    ['car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck'],
  brakes:    ['motorcycle', 'electric-cycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy', 'electric'],
  battery:   ['motorcycle', 'electric-cycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy', 'electric'],
  chain:     ['motorcycle', 'electric-cycle', 'three-wheeler'],
  hydraulic: ['heavy', 'truck'],
}

type MilestoneState = { added: boolean; year: string; mileage: string }
const emptyMS = (): MilestoneState => ({ added: false, year: '', mileage: '' })

// ── Step 2: Quick-add past records ───────────────────────────────────────────

type QuickRecord = { id: string; description: string; year: string; mileage: string; cost: string }
const emptyQR = (): QuickRecord => ({ id: Math.random().toString(36).slice(2), description: '', year: '', mileage: '', cost: '' })

// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingWizardScreen({ token, vehicle, onDone }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [milestones, setMilestones] = useState<Record<string, MilestoneState>>(
    Object.fromEntries(MILESTONES.map(m => [m.id, emptyMS()]))
  )
  const [quickRecords, setQuickRecords] = useState<QuickRecord[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newRecord, setNewRecord] = useState<QuickRecord>(emptyQR())
  const [saving, setSaving] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const visibleMilestones = vehicle.vehicleType
    ? MILESTONES.filter(m => MILESTONE_FOR[m.id]?.includes(vehicle.vehicleType!))
    : MILESTONES

  const toggleMilestone = (id: string) =>
    setMilestones(prev => ({ ...prev, [id]: { ...prev[id], added: !prev[id].added } }))

  const updateMilestone = (id: string, field: 'year' | 'mileage', value: string) =>
    setMilestones(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const addedMilestones = visibleMilestones.filter(m => milestones[m.id].added)

  const handleSaveQuickRecord = () => {
    if (!newRecord.description.trim()) {
      Alert.alert(t('history.quickAdd.required.title'), t('history.quickAdd.required.message'))
      return
    }
    if (editingId) {
      setQuickRecords(prev => prev.map(r => (r.id === editingId ? { ...newRecord, id: editingId } : r)))
    } else {
      setQuickRecords(prev => [...prev, { ...newRecord }])
    }
    setNewRecord(emptyQR())
    setEditingId(null)
    setShowAddForm(false)
  }

  const startAddQuickRecord = () => {
    setNewRecord(emptyQR())
    setEditingId(null)
    setShowAddForm(true)
  }

  const startEditQuickRecord = (r: QuickRecord) => {
    setNewRecord({ ...r })
    setEditingId(r.id)
    setShowAddForm(true)
  }

  const removeQuickRecord = (id: string) =>
    setQuickRecords(prev => prev.filter(r => r.id !== id))

  const handleFinish = async () => {
    const milestoneRecords = addedMilestones.map(m => {
      const s = milestones[m.id]
      const yearNum = parseInt(s.year)
      const isoDate = (!isNaN(yearNum) && yearNum >= 1990)
        ? new Date(`${yearNum}-01-01`).toISOString()
        : new Date().toISOString()
      return { date: isoDate, description: m.serviceCategory, mileage: s.mileage.trim() ? parseInt(s.mileage) : undefined, notes: 'Added from setup wizard (historical record)' }
    })

    const quickRecs = quickRecords.map(r => {
      const yearNum = parseInt(r.year)
      const isoDate = (!isNaN(yearNum) && yearNum >= 1990)
        ? new Date(`${yearNum}-01-01`).toISOString()
        : new Date().toISOString()
      return {
        date: isoDate,
        description: r.description.trim(),
        mileage: r.mileage.trim() ? parseInt(r.mileage) : undefined,
        cost: r.cost.trim() ? parseFloat(r.cost) : undefined,
        notes: 'Added from setup wizard (historical record)',
      }
    })

    const allRecords = [...milestoneRecords, ...quickRecs]
    if (allRecords.length === 0) { onDone(); return }

    setSaving(true)
    try {
      await Promise.all(allRecords.map(r => api.addServiceRecord(token, vehicle.id, r)))
      onDone()
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('onboarding.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Step indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
      </View>
      <Text style={styles.stepLabel}>{t('onboarding.stepLabel', { step })}</Text>

      <View style={styles.header}>
        <Text style={styles.title}>{step === 1 ? t('onboarding.title1') : t('onboarding.title2')}</Text>
        <Text style={styles.subtitle}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.registrationNo}</Text>
        <Text style={styles.intro}>
          {step === 1 ? t('onboarding.intro1') : t('onboarding.intro2')}
        </Text>
      </View>

      {/* ── Step 1: Milestones ── */}
      {step === 1 && visibleMilestones.map(m => {
        const s = milestones[m.id]
        const hasData = s.added && (s.year.trim() || s.mileage.trim())
        return (
          <View key={m.id} style={[styles.card, s.added && styles.cardActive]}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => toggleMilestone(m.id)} activeOpacity={0.7}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{m.icon}</Text>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardLabel}>{t(m.labelKey)}</Text>
                  <Text style={styles.cardQuestion}>{t(m.questionKey)}</Text>
                </View>
              </View>
              <View style={[styles.toggle, s.added && styles.toggleActive, hasData && styles.toggleDone]}>
                <Text style={[styles.toggleText, s.added && styles.toggleTextActive]}>{s.added ? t('onboarding.yesAdded') : t('onboarding.addToggle')}</Text>
              </View>
            </TouchableOpacity>
            {s.added && (
              <View style={styles.cardFields}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>{t('onboarding.approxYear')}</Text>
                    <TextInput style={styles.input} value={s.year} onChangeText={v => updateMilestone(m.id, 'year', v)} placeholder="e.g. 2022" keyboardType="number-pad" maxLength={4} placeholderTextColor="#bbb" />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>{t('history.quickAdd.mileageAtTime')}</Text>
                    <TextInput style={styles.input} value={s.mileage} onChangeText={v => updateMilestone(m.id, 'mileage', v)} placeholder="e.g. 40000" keyboardType="number-pad" placeholderTextColor="#bbb" />
                  </View>
                </View>
                <Text style={styles.fieldHint}>{t('onboarding.fieldHint')}</Text>
              </View>
            )}
          </View>
        )
      })}

      {step === 1 && (
        <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
          <Text style={styles.nextBtnText}>
            {addedMilestones.length > 0
              ? t('onboarding.continueWithRecords', { count: addedMilestones.length, s: addedMilestones.length !== 1 ? 's' : '' })
              : t('onboarding.continueNothing')}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Step 2: Quick-add past records ── */}
      {step === 2 && (
        <>
          {quickRecords.map(r => (
            <TouchableOpacity key={r.id} style={styles.quickCard} onPress={() => startEditQuickRecord(r)} activeOpacity={0.7}>
              <View style={styles.quickCardTop}>
                <Text style={styles.quickCardDesc} numberOfLines={1}>{r.description}</Text>
                <TouchableOpacity onPress={() => removeQuickRecord(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.quickCardRemove}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.quickCardMeta}>
                {r.year ? `${r.year}` : t('onboarding.yearUnknown')}
                {r.mileage ? ` · ${parseInt(r.mileage).toLocaleString()} km` : ''}
                {r.cost ? ` · LKR ${parseFloat(r.cost).toLocaleString()}` : ''}
              </Text>
            </TouchableOpacity>
          ))}

          {!showAddForm && (
            <TouchableOpacity style={styles.addRecordBtn} onPress={startAddQuickRecord}>
              <Text style={styles.addRecordBtnText}>{t('onboarding.addPastRecord')}</Text>
            </TouchableOpacity>
          )}

          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>{editingId ? t('onboarding.editPastRecordTitle') : t('onboarding.addPastRecordTitle')}</Text>
              <Text style={styles.fieldLabel}>{t('history.quickAdd.whatWasDone')}</Text>
              <TextInput
                style={styles.input}
                value={newRecord.description}
                onChangeText={v => setNewRecord(p => ({ ...p, description: v }))}
                placeholder="e.g. Full service, Tyre change, Timing belt"
                placeholderTextColor="#bbb"
                autoFocus
              />
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>{t('onboarding.yearApprox')}</Text>
                  <TextInput style={styles.input} value={newRecord.year} onChangeText={v => setNewRecord(p => ({ ...p, year: v }))} placeholder="e.g. 2021" keyboardType="number-pad" maxLength={4} placeholderTextColor="#bbb" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>{t('addService.mileage')}</Text>
                  <TextInput style={styles.input} value={newRecord.mileage} onChangeText={v => setNewRecord(p => ({ ...p, mileage: v }))} placeholder={t('history.optional')} keyboardType="number-pad" placeholderTextColor="#bbb" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>{t('history.costLkr')}</Text>
              <TextInput style={styles.input} value={newRecord.cost} onChangeText={v => setNewRecord(p => ({ ...p, cost: v }))} placeholder={t('history.optional')} keyboardType="number-pad" placeholderTextColor="#bbb" />
              <View style={styles.addFormActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddForm(false); setEditingId(null) }}>
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveQuickRecord}>
                  <Text style={styles.confirmBtnText}>{editingId ? t('onboarding.saveRecordConfirm') : t('onboarding.addRecordConfirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.doneBtn, saving && styles.doneBtnDisabled]}
            onPress={handleFinish}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.doneBtnText}>
                  {(addedMilestones.length + quickRecords.length) > 0
                    ? t('onboarding.saveAndGoToDashboard', { count: addedMilestones.length + quickRecords.length, s: (addedMilestones.length + quickRecords.length) !== 1 ? 's' : '' })
                    : t('onboarding.goToDashboard')}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep(1)} style={styles.backLink}>
            <Text style={styles.backLinkText}>{t('onboarding.backToStep1')}</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.footer}>{t('onboarding.footer')}</Text>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 48 },
    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 52, marginBottom: 4 },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.borderMid },
    stepDotActive: { backgroundColor: c.primary },
    stepLine: { width: 48, height: 2, backgroundColor: c.borderMid, marginHorizontal: 6 },
    stepLineActive: { backgroundColor: c.primary },
    stepLabel: { textAlign: 'center', fontSize: 12, color: c.textMuted, marginBottom: 20 },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: c.primary, fontWeight: '600', marginBottom: 10 },
    intro: { fontSize: 14, color: c.textSub, lineHeight: 20 },
    card: { backgroundColor: c.surface, borderRadius: 14, marginBottom: 10, borderWidth: 1.5, borderColor: c.borderMid, overflow: 'hidden' },
    cardActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    cardLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12, marginRight: 12 },
    cardIcon: { fontSize: 24, marginTop: 2 },
    cardTextWrap: { flex: 1 },
    cardLabel: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    cardQuestion: { fontSize: 13, color: c.textSub, lineHeight: 18 },
    toggle: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.surfaceAlt, minWidth: 70, alignItems: 'center' },
    toggleActive: { backgroundColor: c.primary, borderColor: c.primary },
    toggleDone: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
    toggleText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    toggleTextActive: { color: '#fff' },
    cardFields: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: c.primaryTint, backgroundColor: c.primaryTint },
    fieldRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    fieldHalf: { flex: 1 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSub, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.borderMid },
    fieldHint: { fontSize: 11, color: c.textFaint, marginTop: 8 },
    nextBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    quickCard: { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.primaryTint },
    quickCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    quickCardDesc: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    quickCardRemove: { fontSize: 16, color: c.textFaint, paddingLeft: 12 },
    quickCardMeta: { fontSize: 12, color: c.textMuted },
    addRecordBtn: { borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
    addRecordBtnText: { fontSize: 15, color: c.primary, fontWeight: '700' },
    addForm: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.borderMid },
    addFormTitle: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 12 },
    addFormActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: c.borderMid, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
    confirmBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    confirmBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    doneBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 8 },
    doneBtnDisabled: { opacity: 0.6 },
    doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    backLink: { alignItems: 'center', paddingVertical: 8 },
    backLinkText: { fontSize: 14, color: c.textMuted },
    footer: { textAlign: 'center', fontSize: 12, color: c.textFaint, marginTop: 16 },
  })
}
