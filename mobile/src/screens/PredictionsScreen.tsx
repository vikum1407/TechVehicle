import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator,
  TextInput, Alert, Modal, Platform, KeyboardAvoidingView,
} from 'react-native'
import { api } from '../config/api'
import { ITEM_BRANDS } from '../constants/serviceData'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type ExtraFieldConfig = {
  key: string
  labelKey: TranslationKey
  type: 'chips' | 'text' | 'number'
  options?: string[]
  placeholder?: string
}

// Extra structured fields shown in the setup card per service type
const SETUP_EXTRA_FIELDS: Record<string, ExtraFieldConfig[]> = {
  'Oil Change': [
    { key: 'oilGrade', labelKey: 'predictions.field.oilGrade', type: 'chips', options: ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', '20W-50'] },
    { key: 'oilType',  labelKey: 'predictions.field.oilType',  type: 'chips', options: ['Mineral', 'Semi-synthetic', 'Full synthetic'] },
  ],
  'Tyre Change': [
    { key: 'tyreSize',    labelKey: 'predictions.field.tyreSize',      type: 'text',  placeholder: 'e.g. 185/65R15' },
    { key: 'tyresChanged', labelKey: 'predictions.field.tyresReplaced', type: 'chips', options: ['1', '2', '4'] },
  ],
  'AC Gas Refill': [
    { key: 'refrigerantType', labelKey: 'predictions.field.refrigerantType', type: 'chips', options: ['R134a', 'R1234yf', 'R22'] },
    { key: 'quantityGrams',   labelKey: 'predictions.field.quantity',        type: 'number', placeholder: 'grams, e.g. 500' },
  ],
  'Brake Fluid': [
    { key: 'fluidType', labelKey: 'predictions.field.fluidType', type: 'chips', options: ['DOT 3', 'DOT 4', 'DOT 5.1'] },
  ],
  'Coolant Flush': [
    { key: 'coolantType', labelKey: 'predictions.field.coolantType', type: 'chips', options: ['Green (Conventional)', 'Red/Pink (Long-life)', 'Blue (OAT)', 'HOAT'] },
  ],
  'Transmission Oil (Auto)': [
    { key: 'fluidType', labelKey: 'predictions.field.fluidType', type: 'chips', options: ['ATF', 'CVT Fluid', 'DCT Fluid'] },
  ],
  'Gear Oil (Manual)': [
    { key: 'gearOilGrade', labelKey: 'predictions.field.oilGrade', type: 'chips', options: ['75W-90', '80W-90', '85W-90', 'GL-4', 'GL-5'] },
  ],
}

// Maps the first keyword of a prediction to { structuredKey, brandLookupKey }
// structuredKey = the field name stored in structuredData JSON
// brandLookupKey = the key in ITEM_BRANDS to pull the chip list from
const SETUP_BRAND_MAP: Record<string, { structuredKey: string; brandLookupKey: string }> = {
  'Oil Change':               { structuredKey: 'oilBrand',  brandLookupKey: 'Oil Change' },
  'Timing Belt':              { structuredKey: 'brandName', brandLookupKey: 'Timing Belt' },
  'Drive Belts':              { structuredKey: 'brandName', brandLookupKey: 'Drive Belts' },
  'Coolant Flush':            { structuredKey: 'brandName', brandLookupKey: 'Coolant Flush' },
  'Brake Pads (Front)':       { structuredKey: 'brandName', brandLookupKey: 'Brake Pads (Front)' },
  'Brake Fluid':              { structuredKey: 'brandName', brandLookupKey: 'Brake Fluid' },
  'Transmission Oil (Auto)':  { structuredKey: 'brandName', brandLookupKey: 'Transmission Oil (Auto)' },
  'Gear Oil (Manual)':        { structuredKey: 'brandName', brandLookupKey: 'Gear Oil (Manual)' },
  'Power Steering Fluid':     { structuredKey: 'brandName', brandLookupKey: 'Power Steering Fluid' },
  'Battery':                  { structuredKey: 'brandName', brandLookupKey: 'Battery' },
  'AC Filter':                { structuredKey: 'brandName', brandLookupKey: 'AC Filter' },
  'Air Filter':               { structuredKey: 'brandName', brandLookupKey: 'Air Filter' },
  'Fuel Filter':              { structuredKey: 'brandName', brandLookupKey: 'Fuel Filter' },
  'Spark Plugs':              { structuredKey: 'brandName', brandLookupKey: 'Spark Plugs' },
  'Glow Plugs':               { structuredKey: 'brandName', brandLookupKey: 'Glow Plugs (Diesel)' },
  'Shock Absorbers':          { structuredKey: 'brandName', brandLookupKey: 'Shock Absorbers (Front)' },
  'Water Pump':               { structuredKey: 'brandName', brandLookupKey: 'Water Pump' },
  'Chain & Sprocket':         { structuredKey: 'brandName', brandLookupKey: 'Chain & Sprocket' },
  'Chain Lubrication':        { structuredKey: 'brandName', brandLookupKey: 'Chain & Sprocket' },
  'Tyre Change':              { structuredKey: 'tyreBrand', brandLookupKey: 'Tyre Change' },
}

type Prediction = {
  id: string
  group: string
  name: string
  source: string
  keywords: string[]
  status: 'overdue' | 'due_soon' | 'ok' | 'no_data'
  lastDoneKm: number | null
  lastDoneDate: string | null
  lastRecordId: string | null
  dueAtKm: number | null
  remainingKm: number | null
  dueAtDate: string | null
  remainingDays: number | null
  customKmInterval: number | null
  customDaysInterval: number | null
}

type Tab = 'services' | 'setup'

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  currentMileage: number
  initialTab?: Tab
  readOnly?: boolean
  onBack: () => void
  onLogNow?: (serviceName: string) => void
  onEditRecord?: (recordId: string) => void
}

function statusConfig(c: Colors, t: (key: any, params?: Record<string, string | number>) => string) {
  return {
    overdue:  { color: '#c62828', bg: c.surface, badge: `⚠️ ${t('predictions.status.overdue')}`,  badgeColor: '#c62828', badgeBg: '#fdecea' },
    due_soon: { color: '#e65100', bg: c.surface, badge: `🔔 ${t('predictions.status.dueSoon')}`, badgeColor: '#e65100', badgeBg: '#fff3e0' },
    ok:       { color: '#2e7d32', bg: c.surface, badge: `✓ ${t('predictions.status.ok')}`,        badgeColor: '#2e7d32', badgeBg: '#f1f8e9' },
    no_data:  { color: '#999',    bg: c.surface, badge: `? ${t('predictions.status.noRecord')}`, badgeColor: '#777',    badgeBg: c.surfaceAlt },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function kmStr(km: number) {
  return km.toLocaleString() + ' km'
}

type SetupEntry = { date: string; mileage: string; brand: string; extras: Record<string, string> }

export default function PredictionsScreen({ token, vehicleId, vehicleName, currentMileage, initialTab = 'services', readOnly = false, onBack, onLogNow, onEditRecord }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [setupEntries, setSetupEntries] = useState<Record<string, SetupEntry>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideKm, setOverrideKm] = useState('')
  const [overrideDays, setOverrideDays] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()
  const STATUS_CONFIG = useMemo(() => statusConfig(colors, t), [colors, t])

  // Allow parent to switch tab via prop change (e.g. from notification)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getPredictions(token, vehicleId)
      setPredictions(data)
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const urgent  = predictions.filter(p => p.status === 'overdue' || p.status === 'due_soon')
  const ok      = predictions.filter(p => p.status === 'ok')
  const noData  = predictions.filter(p => p.status === 'no_data')

  const getEntry = (id: string): SetupEntry => setupEntries[id] || { date: '', mileage: '', brand: '', extras: {} }
  const setEntry = (id: string, field: 'date' | 'mileage' | 'brand', value: string) =>
    setSetupEntries(prev => ({ ...prev, [id]: { ...getEntry(id), [field]: value } }))
  const setExtra = (id: string, key: string, value: string) =>
    setSetupEntries(prev => ({ ...prev, [id]: { ...getEntry(id), extras: { ...getEntry(id).extras, [key]: value } } }))

  const handleSave = async (p: Prediction) => {
    const entry = getEntry(p.id)
    const raw = entry.date.trim()
    if (!raw) {
      Alert.alert(t('predictions.dateRequired.title'), t('predictions.dateRequired.message'))
      return
    }
    const parts = raw.split('/')
    if (parts.length !== 2) {
      Alert.alert(t('predictions.invalidFormat.title'), t('predictions.invalidFormat.message'))
      return
    }
    const month = parseInt(parts[0], 10)
    const year  = parseInt(parts[1], 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1990 || year > currentYear) {
      Alert.alert(t('predictions.invalidDate.title'), t('predictions.invalidDate.message', { year: currentYear }))
      return
    }

    const isoDate    = new Date(year, month - 1, 15).toISOString()
    const mileageNum = entry.mileage.trim() ? parseInt(entry.mileage, 10) : undefined

    const brandConfig  = SETUP_BRAND_MAP[p.keywords[0]]
    const extraFields  = SETUP_EXTRA_FIELDS[p.keywords[0]] || []
    const structured: Record<string, string | number> = {}
    if (brandConfig && entry.brand) structured[brandConfig.structuredKey] = entry.brand
    for (const ef of extraFields) {
      const val = (entry.extras || {})[ef.key]
      if (val) structured[ef.key] = ef.type === 'number' ? Number(val) : val
    }
    const structuredData = Object.keys(structured).length > 0
      ? { [p.keywords[0]]: structured }
      : undefined

    setSavingId(p.id)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description: p.keywords[0],
        mileage: mileageNum,
        notes: 'Added via Prediction Setup',
        structuredData,
      })
      await load()
    } catch {
      Alert.alert(t('common.error'), t('predictions.saveFailed'))
    } finally {
      setSavingId(null)
    }
  }

  const renderServiceCard = (p: Prediction) => {
    const cfg = STATUS_CONFIG[p.status]

    let distanceLine = ''
    if (p.remainingKm !== null) {
      if (p.remainingKm < 0) {
        distanceLine = t('predictions.overdueByKm', { km: kmStr(Math.abs(p.remainingKm)) })
      } else {
        distanceLine = t('predictions.dueInKm', { km: kmStr(p.remainingKm) })
        if (p.dueAtKm) distanceLine += t('predictions.atKmSuffix', { km: kmStr(p.dueAtKm) })
      }
    }

    let timeLine = ''
    if (p.remainingDays !== null) {
      if (p.remainingDays < 0) {
        timeLine = t('predictions.daysOverdue', { days: Math.abs(p.remainingDays) })
      } else if (p.remainingDays === 0) {
        timeLine = t('predictions.dueToday')
      } else {
        timeLine = t('predictions.daysRemaining', { days: p.remainingDays })
        if (p.dueAtDate) timeLine += t('predictions.bySuffix', { date: formatDate(p.dueAtDate) })
      }
    }

    let lastLine = ''
    if (p.lastDoneDate && p.lastDoneKm) {
      lastLine = t('predictions.lastDoneAt', { date: formatDate(p.lastDoneDate), km: kmStr(p.lastDoneKm) })
    } else if (p.lastDoneDate) {
      lastLine = t('predictions.lastDone', { date: formatDate(p.lastDoneDate) })
    }

    return (
      <TouchableOpacity key={p.id} activeOpacity={0.75} onPress={() => setSelectedPrediction(p)}>
        <View style={[styles.card, { borderLeftColor: cfg.color, backgroundColor: cfg.bg }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{p.name}</Text>
            <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
              <Text style={[styles.badgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
            </View>
          </View>
          {distanceLine !== '' && <Text style={[styles.distanceLine, { color: cfg.color }]}>{distanceLine}</Text>}
          {timeLine      !== '' && <Text style={styles.timeLine}>{timeLine}</Text>}
          {lastLine      !== '' && <Text style={styles.lastLine}>{lastLine}</Text>}
          <Text style={styles.source}>{p.source}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderSetupCard = (p: Prediction) => {
    const entry       = getEntry(p.id)
    const isSaving    = savingId === p.id
    const brandConfig  = SETUP_BRAND_MAP[p.keywords[0]]
    const brandOptions = brandConfig ? ITEM_BRANDS[brandConfig.brandLookupKey] : undefined
    const extraFields  = SETUP_EXTRA_FIELDS[p.keywords[0]] || []

    return (
      <View key={p.id} style={styles.setupCard}>
        <View style={styles.setupCardHeader}>
          <Text style={styles.setupCardName}>{p.name}</Text>
        </View>
        <Text style={styles.setupQuestion}>{t('predictions.whenLastDone')}</Text>

        <View style={styles.setupFields}>
          <View style={[styles.setupField, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.setupFieldLabel}>{t('predictions.monthYear')}</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="06/2023"
              placeholderTextColor={colors.textFaint}
              value={entry.date}
              onChangeText={v => setEntry(p.id, 'date', v)}
              keyboardType="numbers-and-punctuation"
              maxLength={7}
            />
          </View>
          <View style={[styles.setupField, { flex: 1 }]}>
            <Text style={styles.setupFieldLabel}>{t('predictions.odometerKmOpt')}</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="e.g. 54000"
              placeholderTextColor={colors.textFaint}
              value={entry.mileage}
              onChangeText={t => setEntry(p.id, 'mileage', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {brandOptions && brandOptions.length > 0 && (
          <View style={styles.brandSection}>
            <Text style={styles.setupFieldLabel}>{t('predictions.brandUsedOptional')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow}>
              {brandOptions.map(brand => (
                <TouchableOpacity
                  key={brand}
                  style={[styles.brandChip, entry.brand === brand && styles.brandChipSelected]}
                  onPress={() => setEntry(p.id, 'brand', entry.brand === brand ? '' : brand)}
                >
                  <Text style={[styles.brandChipText, entry.brand === brand && styles.brandChipTextSelected]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {extraFields.map(ef => (
          <View key={ef.key} style={styles.brandSection}>
            <Text style={styles.setupFieldLabel}>{t(ef.labelKey)} {t('addVehicle.optionalParen')}</Text>
            {ef.type === 'chips' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow}>
                {(ef.options || []).map(opt => {
                  const selected = (entry.extras[ef.key] || '') === opt
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.brandChip, selected && styles.brandChipSelected]}
                      onPress={() => setExtra(p.id, ef.key, selected ? '' : opt)}
                    >
                      <Text style={[styles.brandChipText, selected && styles.brandChipTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            ) : (
              <TextInput
                style={styles.setupInput}
                placeholder={ef.placeholder || ''}
                placeholderTextColor={colors.textFaint}
                value={entry.extras[ef.key] || ''}
                onChangeText={v => setExtra(p.id, ef.key, ef.type === 'number' ? v.replace(/[^0-9]/g, '') : v)}
                keyboardType={ef.type === 'number' ? 'number-pad' : 'default'}
              />
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.setupSaveBtn, isSaving && { opacity: 0.6 }]}
          onPress={() => handleSave(p)}
          disabled={isSaving}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.setupSaveBtnText}>{t('predictions.saveAndStartPredicting')}</Text>
          }
        </TouchableOpacity>

        <Text style={styles.setupSource}>{p.source}</Text>
      </View>
    )
  }

  const tabBar = (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'services' && styles.tabBtnActive]}
        onPress={() => setActiveTab('services')}
      >
        <Text style={[styles.tabBtnText, activeTab === 'services' && styles.tabBtnTextActive]}>
          {t('predictions.tab.upcomingServices')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'setup' && styles.tabBtnActive]}
        onPress={() => setActiveTab('setup')}
      >
        <Text style={[styles.tabBtnText, activeTab === 'setup' && styles.tabBtnTextActive]}>
          {t('predictions.tab.setup')}
        </Text>
        {noData.length > 0 && (
          <View style={[styles.tabBadge, activeTab === 'setup' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'setup' && styles.tabBadgeTextActive]}>
              {noData.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )

  const servicesContent = (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Setup nudge banner — shown on services tab when items need setup */}
      {noData.length > 0 && (
        <TouchableOpacity style={styles.setupNudge} onPress={() => setActiveTab('setup')} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupNudgeTitle}>
              {t('predictions.setupNudge.title', { count: noData.length, s: noData.length > 1 ? 's' : '' })}
            </Text>
            <Text style={styles.setupNudgeBody}>
              {t('predictions.setupNudge.body')}
            </Text>
          </View>
          <Text style={styles.setupNudgeArrow}>→</Text>
        </TouchableOpacity>
      )}

      {urgent.length === 0 && ok.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('predictions.empty.noServices.title')}</Text>
          <Text style={styles.emptyBody}>
            {t('predictions.empty.noServices.body')}
          </Text>
        </View>
      )}

      {urgent.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>{t('predictions.needsAttention')}</Text>
          {urgent.map(renderServiceCard)}
        </View>
      )}

      {ok.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>{t('predictions.onTrack')}</Text>
          {ok.map(renderServiceCard)}
        </View>
      )}
    </ScrollView>
  )

  const setupContent = (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={styles.scrollContent}
    >
      {noData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('predictions.allSet.title')}</Text>
          <Text style={styles.emptyBody}>
            {t('predictions.allSet.body')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.setupBanner}>
            <Text style={styles.setupBannerTitle}>{t('predictions.setupBanner.title')}</Text>
            <Text style={styles.setupBannerBody}>
              {t('predictions.setupBanner.body')}
            </Text>
          </View>
          {noData.map(renderSetupCard)}
        </>
      )}
    </ScrollView>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title={t('predictions.tab.upcomingServices')} onBack={onBack} />

      <View style={styles.mileageBanner}>
        <Text style={styles.mileageLabel}>{t('predictions.currentMileage')}</Text>
        <Text style={styles.mileageValue}>{currentMileage.toLocaleString()} km</Text>
      </View>

      {tabBar}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
      ) : (
        activeTab === 'services' ? servicesContent : setupContent
      )}

      {/* Prediction detail bottom-sheet */}
      {selectedPrediction && (() => {
        const p = selectedPrediction
        const cfg = STATUS_CONFIG[p.status]
        return (
          <Modal transparent animationType="slide" onRequestClose={() => setSelectedPrediction(null)}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedPrediction(null)} />
            <View style={styles.detailSheet}>
              <View style={styles.detailHandle} />
              <View style={styles.detailHeader}>
                <Text style={styles.detailName}>{p.name}</Text>
                <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
                  <Text style={[styles.badgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>{t('predictions.lastDoneLabel')}</Text>
                <Text style={styles.detailRowValue}>
                  {p.lastDoneDate
                    ? `${formatDate(p.lastDoneDate)}${p.lastDoneKm ? ` · ${kmStr(p.lastDoneKm)}` : ''}`
                    : t('predictions.noRecordYet')}
                </Text>
              </View>

              {p.lastRecordId && onEditRecord && (
                <TouchableOpacity
                  onPress={() => { const id = p.lastRecordId!; setSelectedPrediction(null); onEditRecord(id) }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.detailEditLink}>✏️ {t('predictions.editRecordLink')}</Text>
                </TouchableOpacity>
              )}

              {(p.dueAtKm !== null || p.dueAtDate !== null) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>{t('predictions.dueAtLabel')}</Text>
                  <Text style={styles.detailRowValue}>
                    {[
                      p.dueAtKm   ? kmStr(p.dueAtKm)       : null,
                      p.dueAtDate ? formatDate(p.dueAtDate) : null,
                    ].filter(Boolean).join(t('predictions.orJoiner'))}
                  </Text>
                </View>
              )}

              {(p.remainingKm !== null || p.remainingDays !== null) && (
                <View style={[styles.detailRemaining, { borderColor: cfg.color }]}>
                  {p.remainingKm !== null && (
                    <Text style={[styles.detailRemainingMain, { color: cfg.color }]}>
                      {p.remainingKm < 0
                        ? t('predictions.overdueByKm', { km: kmStr(Math.abs(p.remainingKm)) })
                        : t('predictions.kmRemaining', { km: kmStr(p.remainingKm) })}
                    </Text>
                  )}
                  {p.remainingDays !== null && (
                    <Text style={styles.detailRemainingSecondary}>
                      {p.remainingDays < 0
                        ? t('predictions.daysOverdue', { days: Math.abs(p.remainingDays) })
                        : p.remainingDays === 0 ? t('predictions.dueToday')
                        : t('predictions.daysRemaining', { days: p.remainingDays })}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.detailSource}>{p.source}</Text>

              <TouchableOpacity
                style={styles.detailLogBtn}
                onPress={() => {
                  setSelectedPrediction(null)
                  onLogNow?.(p.name)
                }}
              >
                <Text style={styles.detailLogBtnText}>{t('predictions.logItNow')}</Text>
              </TouchableOpacity>

              {/* Interval row */}
              {p.group !== 'tyre_change' && (
                <View style={styles.intervalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.intervalLabel}>
                      {p.customKmInterval != null || p.customDaysInterval != null
                        ? t('predictions.customInterval')
                        : t('predictions.manufacturerInterval')}
                    </Text>
                    <Text style={styles.intervalValue}>
                      {[
                        (p.customKmInterval ?? null) != null
                          ? `${(p.customKmInterval as number).toLocaleString()} km`
                          : null,
                        (p.customDaysInterval ?? null) != null
                          ? t('predictions.daysUnit', { days: p.customDaysInterval as number })
                          : null,
                      ].filter(Boolean).join(' · ') || t('predictions.setIntervalBelow')}
                    </Text>
                  </View>
                  {!readOnly && (
                    <TouchableOpacity
                      style={styles.customizeBtn}
                      onPress={() => {
                        setOverrideKm(p.customKmInterval != null ? String(p.customKmInterval) : '')
                        setOverrideDays(p.customDaysInterval != null ? String(p.customDaysInterval) : '')
                        setShowOverrideModal(true)
                      }}
                    >
                      <Text style={styles.customizeBtnText}>✏️ {t('predictions.customize')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Override editor modal — nested inside the sheet modal */}
            <Modal
              transparent
              animationType="fade"
              visible={showOverrideModal}
              onRequestClose={() => setShowOverrideModal(false)}
            >
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => setShowOverrideModal(false)}
              />
              <View style={styles.overrideCard}>
                <Text style={styles.overrideTitle}>{t('predictions.override.title')}</Text>
                <Text style={styles.overrideSubtitle}>{p.name}</Text>

                <Text style={styles.overrideFieldLabel}>{t('predictions.override.everyXKm')}</Text>
                <TextInput
                  style={styles.overrideInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 3000"
                  placeholderTextColor={colors.textFaint}
                  value={overrideKm}
                  onChangeText={setOverrideKm}
                />

                <Text style={styles.overrideFieldLabel}>{t('predictions.override.everyXDays')}</Text>
                <TextInput
                  style={styles.overrideInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 90"
                  placeholderTextColor={colors.textFaint}
                  value={overrideDays}
                  onChangeText={setOverrideDays}
                />

                <TouchableOpacity
                  style={[styles.overrideSaveBtn, (savingOverride || (!overrideKm.trim() && !overrideDays.trim())) && { opacity: 0.6 }]}
                  disabled={savingOverride || (!overrideKm.trim() && !overrideDays.trim())}
                  onPress={async () => {
                    const kmNum = overrideKm.trim() ? Number(overrideKm.trim()) : null
                    const daysNum = overrideDays.trim() ? Number(overrideDays.trim()) : null
                    if ((kmNum !== null && isNaN(kmNum)) || (daysNum !== null && isNaN(daysNum))) {
                      Alert.alert(t('predictions.invalidInput.title'), t('predictions.invalidInput.message'))
                      return
                    }
                    setSavingOverride(true)
                    try {
                      await api.saveIntervalOverride(token, vehicleId, p.group, kmNum, daysNum)
                      setShowOverrideModal(false)
                      setSelectedPrediction(null)
                      load()
                    } catch {
                      Alert.alert(t('common.error'), t('predictions.saveIntervalFailed'))
                    } finally {
                      setSavingOverride(false)
                    }
                  }}
                >
                  <Text style={styles.overrideSaveBtnText}>
                    {savingOverride ? t('predictions.saving') : t('predictions.saveInterval')}
                  </Text>
                </TouchableOpacity>

                {(p.customKmInterval != null || p.customDaysInterval != null) && (
                  <TouchableOpacity
                    style={styles.overrideClearBtn}
                    disabled={savingOverride}
                    onPress={async () => {
                      setSavingOverride(true)
                      try {
                        await api.saveIntervalOverride(token, vehicleId, p.group, null, null)
                        setShowOverrideModal(false)
                        setSelectedPrediction(null)
                        load()
                      } catch {
                        Alert.alert(t('common.error'), t('predictions.clearIntervalFailed'))
                      } finally {
                        setSavingOverride(false)
                      }
                    }}
                  >
                    <Text style={styles.overrideClearBtnText}>{t('predictions.clearCustomInterval')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              </KeyboardAvoidingView>
            </Modal>
          </Modal>
        )
      })()}
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    mileageBanner: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 10,
    },
    mileageLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    mileageValue: { fontSize: 16, color: '#fff', fontWeight: '800' },

    tabBar: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    tabBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
      gap: 6,
    },
    tabBtnActive: { borderBottomColor: c.primary },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: c.textMuted },
    tabBtnTextActive: { color: c.primary },
    tabBadge: {
      backgroundColor: c.borderMid, borderRadius: 10,
      minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 5,
    },
    tabBadgeActive: { backgroundColor: c.primary },
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: c.textSub },
    tabBadgeTextActive: { color: '#fff' },

    scrollContent: { padding: 16, paddingBottom: 40 },

    setupNudge: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surfaceAlt, borderRadius: 12,
      borderLeftWidth: 4, borderLeftColor: '#f9a825',
      padding: 12, marginBottom: 14,
    },
    setupNudgeTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
    setupNudgeBody: { fontSize: 12, color: c.textSub },
    setupNudgeArrow: { fontSize: 18, color: '#f9a825', marginLeft: 8, fontWeight: '700' },

    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: c.textMuted,
      letterSpacing: 0.8, textTransform: 'uppercase',
      marginTop: 8, marginBottom: 8, marginLeft: 2,
    },

    card: {
      borderRadius: 12, borderLeftWidth: 4,
      padding: 14, marginBottom: 10,
      shadowColor: '#000', shadowOpacity: 0.05,
      shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cardName: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1, marginRight: 8 },
    badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    distanceLine: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    timeLine: { fontSize: 13, color: c.textSub, marginBottom: 4 },
    lastLine: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    source: { fontSize: 11, color: c.textFaint, fontStyle: 'italic' },

    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textBody, marginBottom: 8 },
    emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 22 },

    setupBanner: {
      backgroundColor: c.primaryTint, borderRadius: 12, padding: 14, marginBottom: 14,
    },
    setupBannerTitle: { fontSize: 15, fontWeight: '700', color: c.primaryTintText, marginBottom: 4 },
    setupBannerBody: { fontSize: 13, color: c.primaryTintText, lineHeight: 19 },

    setupCard: {
      backgroundColor: c.surface, borderRadius: 12, borderLeftWidth: 4,
      borderLeftColor: '#9e9e9e', padding: 14, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.05,
      shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    setupCardHeader: { marginBottom: 8 },
    setupCardName: { fontSize: 15, fontWeight: '700', color: c.text },

    setupQuestion: { fontSize: 13, color: c.textSub, marginBottom: 10 },
    setupFields: { flexDirection: 'row', marginBottom: 12 },
    setupField: {},
    setupFieldLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600', marginBottom: 4 },
    setupInput: {
      borderWidth: 1, borderColor: c.borderMid, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 8,
      fontSize: 14, color: c.text, backgroundColor: c.surfaceAlt, letterSpacing: 0,
    },

    setupSaveBtn: {
      backgroundColor: c.primary, borderRadius: 8,
      paddingVertical: 10, alignItems: 'center', marginBottom: 10,
    },
    setupSaveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    setupSource: { fontSize: 11, color: c.textFaint, fontStyle: 'italic' },

    brandSection: { marginBottom: 12 },
    brandRow: { marginTop: 6 },
    brandChip: {
      borderWidth: 1, borderColor: c.borderMid, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
      backgroundColor: c.surfaceAlt,
    },
    brandChipSelected: { borderColor: c.primary, backgroundColor: c.primaryTint },
    brandChipText: { fontSize: 13, color: c.textSub, fontWeight: '500' },
    brandChipTextSelected: { color: c.primary, fontWeight: '700' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    },
    detailSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    detailHandle: {
      width: 40, height: 4, backgroundColor: c.borderMid, borderRadius: 2,
      alignSelf: 'center', marginBottom: 18,
    },
    detailHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 16,
    },
    detailName: {
      fontSize: 18, fontWeight: '800', color: c.text,
      flex: 1, marginRight: 10,
    },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    detailRowLabel: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    detailRowValue: {
      fontSize: 13, color: c.text, fontWeight: '600',
      flex: 1, textAlign: 'right', marginLeft: 16,
    },
    detailEditLink: { fontSize: 12, color: c.primary, fontWeight: '600', textAlign: 'right', marginTop: 6 },
    detailRemaining: {
      borderWidth: 1.5, borderRadius: 10, padding: 12,
      marginTop: 14, marginBottom: 4, alignItems: 'center',
    },
    detailRemainingMain: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    detailRemainingSecondary: { fontSize: 13, color: c.textSub },
    detailSource: {
      fontSize: 11, color: c.textFaint, fontStyle: 'italic',
      textAlign: 'center', marginTop: 10, marginBottom: 18,
    },
    detailLogBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
      marginBottom: 14,
    },
    detailLogBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    intervalRow: {
      flexDirection: 'row', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: c.border,
      paddingTop: 12, gap: 10,
    },
    intervalLabel: { fontSize: 11, color: c.textFaint, fontWeight: '600', marginBottom: 2 },
    intervalValue: { fontSize: 13, color: c.textBody, fontWeight: '700' },
    customizeBtn: {
      backgroundColor: c.primaryTint, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    customizeBtnText: { fontSize: 13, color: c.primary, fontWeight: '700' },

    overrideCard: {
      position: 'absolute',
      left: 20, right: 20,
      top: '25%',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000', shadowOpacity: 0.15,
      shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    overrideTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginBottom: 2 },
    overrideSubtitle: { fontSize: 13, color: c.textMuted, marginBottom: 18 },
    overrideFieldLabel: { fontSize: 12, color: c.textSub, fontWeight: '600', marginBottom: 6 },
    overrideInput: {
      borderWidth: 1, borderColor: c.borderMid, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 15, color: c.text, marginBottom: 14, letterSpacing: 0,
    },
    overrideSaveBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 13, alignItems: 'center', marginTop: 4, marginBottom: 10,
    },
    overrideSaveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    overrideClearBtn: {
      borderWidth: 1, borderColor: '#e53935', borderRadius: 10,
      paddingVertical: 11, alignItems: 'center',
    },
    overrideClearBtnText: { fontSize: 14, fontWeight: '600', color: '#e53935' },
  })
}
