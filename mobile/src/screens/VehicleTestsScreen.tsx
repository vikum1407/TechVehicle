import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { parseDMY } from '../constants/serviceData'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import DateField from '../components/DateField'
import Button from '../components/Button'
import { useTranslation } from '../i18n/LanguageContext'

type Props = {
  token: string
  vehicleId: string
  vehicleName: string
  currentMileage: number
  vehicleType?: string | null
  initialTab?: Tab
  isShared?: boolean
  insuranceExpiry?: string | null
  insuranceCompany?: string | null
  insurancePolicyNo?: string | null
  revenueLicenceExpiry?: string | null
  onBack: () => void
}

type Tab = 'emission' | 'alignment' | 'chain' | 'insurance' | 'licence'

type Expense = {
  id: string
  date: string
  category: string
  amount: number
  description: string | null
  mileage: number | null
}

const CHAIN_TYPES = new Set(['motorcycle', 'electric-cycle', 'three-wheeler'])

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
  structuredData: any
}

function todayDMY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function parseMMYYYY(s: string): string | null {
  const parts = s.split('/')
  if (parts.length !== 2) return null
  const [m, y] = parts
  if (!m || !y || y.length !== 4) return null
  const date = new Date(Number(y), Number(m), 0)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function fmtDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return isoDate
  }
}

export default function VehicleTestsScreen({ token, vehicleId, vehicleName, currentMileage, vehicleType, initialTab, isShared = false, insuranceExpiry, insuranceCompany, insurancePolicyNo, revenueLicenceExpiry, onBack }: Props) {
  const showChainTab = CHAIN_TYPES.has(vehicleType ?? '')
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'emission')
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  // Emission form
  const [eResult, setEResult] = useState<'Pass' | 'Fail' | ''>('')
  const [eDate, setEDate] = useState(todayDMY())
  const [eMileage, setEMileage] = useState(String(currentMileage))
  const [eCo, setECo] = useState('')
  const [eHc, setEHc] = useState('')
  const [eCo2, setECo2] = useState('')
  const [eLambda, setELambda] = useState('')
  const [eStation, setEStation] = useState('')
  const [eCost, setECost] = useState('')
  const [eNextExpiry, setENextExpiry] = useState('')
  const [eSaving, setESaving] = useState(false)

  // Alignment form
  const [aDate, setADate] = useState(todayDMY())
  const [aMileage, setAMileage] = useState(String(currentMileage))
  const [aAxle, setAAxle] = useState<'Front' | 'Rear' | 'Both' | ''>('')
  const [aCost, setACost] = useState('')
  const [aSaving, setASaving] = useState(false)

  // Chain form
  const [cServiceType, setCServiceType] = useState<'Lubrication' | 'Tension Check' | 'Chain & Sprocket' | ''>('')
  const [cDate, setCDate] = useState(todayDMY())
  const [cMileage, setCMileage] = useState(String(currentMileage))
  const [cCost, setCCost] = useState('')
  const [cSaving, setCSaving] = useState(false)
  const colors = useColors()
  const s = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const loadRecords = useCallback(async () => {
    try {
      setLoadingRecords(true)
      const [data, expData] = await Promise.all([
        api.getServiceRecords(token, vehicleId),
        api.getExpenses(token, vehicleId).catch(() => []),
      ])
      setRecords(Array.isArray(data) ? data : [])
      setExpenses(Array.isArray(expData) ? expData : [])
    } catch {
      // history just won't show
    } finally {
      setLoadingRecords(false)
    }
  }, [token, vehicleId])

  useEffect(() => { loadRecords() }, [loadRecords])

  const emissionHistory = records
    .filter(r => r.description.toLowerCase().includes('emission test'))
    .slice(0, 5)

  const alignmentHistory = records
    .filter(r => r.description.toLowerCase().includes('wheel alignment'))
    .slice(0, 5)

  const chainHistory = records
    .filter(r =>
      r.description.toLowerCase().includes('chain lubrication') ||
      r.description.toLowerCase().includes('chain & sprocket') ||
      r.description.toLowerCase().includes('chain tension')
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  const insuranceHistory = expenses
    .filter(e => e.category === 'Insurance')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)

  const licenceHistory = expenses
    .filter(e => e.category === 'Revenue Licence')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)

  function getDocStatus(dateStr: string | null | undefined): { label: string; color: string; bg: string } {
    if (!dateStr) return { label: t('vehicleTests.docStatus.notSet'), color: colors.textMuted, bg: '#f5f5f5' }
    const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
    if (days < 0)   return { label: t('vehicleTests.docStatus.expiredAgo', { days: Math.abs(days), s: Math.abs(days) !== 1 ? 's' : '' }), color: colors.error, bg: '#ffebee' }
    if (days <= 7)  return { label: t('vehicleTests.docStatus.criticalSoon', { days, s: days !== 1 ? 's' : '' }), color: colors.error, bg: '#ffebee' }
    if (days <= 30) return { label: t('vehicleTests.docStatus.expiresIn', { days }), color: colors.warning, bg: '#fff3e0' }
    return { label: t('vehicleTests.docStatus.valid', { days }), color: colors.success, bg: '#e8f5e9' }
  }

  const chainStatus = (() => {
    const lastLube = records.find(r => r.description.toLowerCase().includes('chain lubrication'))
    const lastReplace = records.find(r => r.description.toLowerCase().includes('chain & sprocket'))
    const kmSinceLube = lastLube?.mileage != null ? currentMileage - lastLube.mileage : null
    const kmSinceReplace = lastReplace?.mileage != null ? currentMileage - lastReplace.mileage : null
    let lubeStatus: 'ok' | 'due' | 'overdue' | 'unknown' = 'unknown'
    if (kmSinceLube !== null) {
      if (kmSinceLube < 400) lubeStatus = 'ok'
      else if (kmSinceLube < 600) lubeStatus = 'due'
      else lubeStatus = 'overdue'
    }
    return { lastLube, lastReplace, kmSinceLube, kmSinceReplace, lubeStatus }
  })()

  // Tyre life prediction from alignment frequency since last tyre change
  const tyrePrediction = (() => {
    const tyreChanges = records
      .filter(r => r.description.toLowerCase().includes('tyre change'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const lastTyre = tyreChanges[0]
    if (!lastTyre) return null

    const sinceDate = new Date(lastTyre.date)
    const alignmentsSince = records.filter(r =>
      r.description.toLowerCase().includes('wheel alignment') &&
      new Date(r.date) > sinceDate
    )

    const lastTyreKm = lastTyre.mileage
    const kmSince = lastTyreKm !== null ? currentMileage - lastTyreKm : null

    let multiplier = 1.0
    let freqNote = t('vehicleTests.freqNote.noData')
    if (kmSince !== null && kmSince > 0 && alignmentsSince.length > 0) {
      const per10k = (alignmentsSince.length / kmSince) * 10000
      if (per10k <= 0.5)      { multiplier = 1.2; freqNote = t('vehicleTests.freqNote.low') }
      else if (per10k <= 1.0) { multiplier = 1.0; freqNote = t('vehicleTests.freqNote.normal') }
      else if (per10k <= 2.0) { multiplier = 0.8; freqNote = t('vehicleTests.freqNote.high') }
      else                    { multiplier = 0.65; freqNote = t('vehicleTests.freqNote.veryHigh') }
    } else if (alignmentsSince.length > 0) {
      freqNote = t('vehicleTests.freqNote.countSince', { count: alignmentsSince.length, s: alignmentsSince.length > 1 ? 's' : '' })
    }

    const BASE = 40000
    const predictedLife = Math.round(BASE * multiplier)
    const dueAtKm = lastTyreKm !== null ? lastTyreKm + predictedLife : null
    const remainingKm = dueAtKm !== null ? dueAtKm - currentMileage : null

    return {
      lastTyreDate: fmtDate(lastTyre.date),
      lastTyreKm,
      alignmentCount: alignmentsSince.length,
      freqNote,
      predictedLife,
      dueAtKm,
      remainingKm,
    }
  })()

  const saveEmissionTest = async () => {
    if (!eResult) { Alert.alert(t('logEmissionTest.required.title'), t('logEmissionTest.required.message')); return }
    const isoDate = parseDMY(eDate)
    if (!isoDate) { Alert.alert(t('logEmissionTest.invalidDate.title'), t('logEmissionTest.invalidDate.message')); return }

    let nextExpiryISO: string | undefined
    if (eNextExpiry.trim()) {
      const parsed = parseMMYYYY(eNextExpiry.trim())
      if (!parsed) { Alert.alert(t('vehicleTests.invalidExpiry.title'), t('vehicleTests.invalidExpiry.message')); return }
      nextExpiryISO = parsed
    }

    const mileageNum = eMileage ? parseInt(eMileage) : null

    const doSave = async () => {
      setESaving(true)
      try {
        if (isShared) {
          const structuredData = {
            'Emission Test / Carbon Test': {
              result: eResult,
              ...(eCo ? { co: eCo } : {}), ...(eHc ? { hc: eHc } : {}),
              ...(eCo2 ? { co2: eCo2 } : {}), ...(eLambda ? { lambda: eLambda } : {}),
              ...(eStation ? { station: eStation } : {}),
            },
          }
          await api.submitSharedTest(token, vehicleId, 'Emission Test / Carbon Test', isoDate, mileageNum ?? undefined, eCost ? parseFloat(eCost) : undefined, structuredData)
          Alert.alert(t('vehicleTests.submitted.title'), t('vehicleTests.emissionSubmitted'))
        } else {
          await api.logEmissionTest(token, vehicleId, {
            date: isoDate,
            mileage: mileageNum ?? undefined,
            result: eResult,
            co: eCo || undefined,
            hc: eHc || undefined,
            co2: eCo2 || undefined,
            lambda: eLambda || undefined,
            station: eStation || undefined,
            cost: eCost ? parseFloat(eCost) : undefined,
            nextExpiryDate: nextExpiryISO,
          })
          if (nextExpiryISO) {
            await api.updateVehicleExpiry(token, vehicleId, { emissionTestExpiry: nextExpiryISO })
          }
          Alert.alert(t('logEmissionTest.saved.title'), t('logEmissionTest.saved.message'))
        }
        setEResult(''); setEDate(todayDMY()); setEMileage(String(currentMileage))
        setECo(''); setEHc(''); setECo2(''); setELambda('')
        setEStation(''); setECost(''); setENextExpiry('')
        loadRecords()
      } catch (e: any) {
        Alert.alert(t('common.error'), e.message)
      } finally {
        setESaving(false)
      }
    }

    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        t('addService.checkMileage.title'),
        t('vehicleTests.checkMileageMessage', { km: mileageNum.toLocaleString() }),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('addService.yesSave'), onPress: doSave }]
      )
      return
    }
    await doSave()
  }

  const saveAlignment = async () => {
    const isoDate = parseDMY(aDate)
    if (!isoDate) { Alert.alert(t('logEmissionTest.invalidDate.title'), t('logEmissionTest.invalidDate.message')); return }

    const mileageNum = aMileage ? parseInt(aMileage) : null

    const doSave = async () => {
      setASaving(true)
      try {
        const structuredData = aAxle
          ? { 'Wheel Alignment': { axle: aAxle } }
          : undefined
        if (isShared) {
          await api.submitSharedTest(token, vehicleId, 'Wheel Alignment', isoDate, mileageNum ?? undefined, aCost ? parseFloat(aCost) : undefined, structuredData ?? {})
          Alert.alert(t('vehicleTests.submitted.title'), t('vehicleTests.alignmentSubmitted'))
        } else {
          await api.addServiceRecord(token, vehicleId, {
            date: isoDate,
            description: 'Wheel Alignment',
            mileage: mileageNum ?? undefined,
            cost: aCost ? parseFloat(aCost) : undefined,
            structuredData,
          })
          Alert.alert(t('logEmissionTest.saved.title'), t('vehicleTests.alignmentSaved'))
        }
        setADate(todayDMY()); setAMileage(String(currentMileage)); setAAxle(''); setACost('')
        loadRecords()
      } catch (e: any) {
        Alert.alert(t('common.error'), e.message)
      } finally {
        setASaving(false)
      }
    }

    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        t('addService.checkMileage.title'),
        t('vehicleTests.checkMileageMessage', { km: mileageNum.toLocaleString() }),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('addService.yesSave'), onPress: doSave }]
      )
      return
    }
    await doSave()
  }

  const saveChain = async () => {
    if (!cServiceType) { Alert.alert(t('vehicleTests.selectServiceType.title'), t('vehicleTests.selectServiceType.message')); return }
    const isoDate = parseDMY(cDate)
    if (!isoDate) { Alert.alert(t('logEmissionTest.invalidDate.title'), t('logEmissionTest.invalidDate.message')); return }
    const mileageNum = cMileage ? parseInt(cMileage) : null
    const doSave = async () => {
      setCSaving(true)
      try {
        const descMap: Record<string, string> = {
          'Lubrication': 'Chain Lubrication',
          'Tension Check': 'Chain Tension Check',
          'Chain & Sprocket': 'Chain & Sprocket',
        }
        await api.addServiceRecord(token, vehicleId, {
          date: isoDate,
          description: descMap[cServiceType],
          mileage: mileageNum ?? undefined,
          cost: cCost ? parseFloat(cCost) : undefined,
          structuredData: { 'Chain Service': { serviceType: cServiceType } },
        })
        Alert.alert(t('logEmissionTest.saved.title'), t('vehicleTests.recorded', { desc: descMap[cServiceType] }))
        setCServiceType(''); setCDate(todayDMY()); setCMileage(String(currentMileage)); setCCost('')
        loadRecords()
      } catch (e: any) {
        Alert.alert(t('common.error'), e.message)
      } finally {
        setCSaving(false)
      }
    }
    if (mileageNum !== null && mileageNum > currentMileage + 500) {
      Alert.alert(
        t('addService.checkMileage.title'),
        t('vehicleTests.checkMileageMessage', { km: mileageNum.toLocaleString() }),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('addService.yesSave'), onPress: doSave }]
      )
      return
    }
    await doSave()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={s.container}>
      <ScreenHeader title={t('vehicleTests.title')} subtitle={vehicleName} onBack={onBack} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        <TouchableOpacity style={[s.tab, activeTab === 'emission' && s.tabActive]} onPress={() => setActiveTab('emission')} activeOpacity={0.7}>
          <Text style={[s.tabText, activeTab === 'emission' && s.tabTextActive]}>💨 {t('vehicleTests.tab.emission')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'alignment' && s.tabActive]} onPress={() => setActiveTab('alignment')} activeOpacity={0.7}>
          <Text style={[s.tabText, activeTab === 'alignment' && s.tabTextActive]}>🔧 {t('vehicleTests.tab.alignment')}</Text>
        </TouchableOpacity>
        {showChainTab && (
          <TouchableOpacity style={[s.tab, activeTab === 'chain' && s.tabActive]} onPress={() => setActiveTab('chain')} activeOpacity={0.7}>
            <Text style={[s.tabText, activeTab === 'chain' && s.tabTextActive]}>⛓ {t('vehicleTests.tab.chain')}</Text>
            {chainStatus.lubeStatus === 'overdue' && <View style={s.tabDot} />}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.tab, activeTab === 'insurance' && s.tabActive]} onPress={() => setActiveTab('insurance')} activeOpacity={0.7}>
          <Text style={[s.tabText, activeTab === 'insurance' && s.tabTextActive]}>🛡️ {t('vehicleTests.tab.insurance')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'licence' && s.tabActive]} onPress={() => setActiveTab('licence')} activeOpacity={0.7}>
          <Text style={[s.tabText, activeTab === 'licence' && s.tabTextActive]}>📋 {t('vehicleTests.tab.revLicence')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

        {activeTab === 'emission' ? (
          <>
            {emissionHistory.length > 0 && (() => {
              const last = emissionHistory[0]
              const sd = last.structuredData?.['Emission Test / Carbon Test'] || {}
              const pass = sd.result === 'Pass'
              return (
                <View style={[s.histCard, { borderLeftColor: pass ? colors.success : colors.error, marginBottom: 20 }]}>
                  <View style={[s.histRow, { marginBottom: 6 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginRight: 4 }}>📌 {t('vehicleTests.latest')}</Text>
                  </View>
                  <View style={s.histRow}>
                    <Text style={[s.histResult, { color: pass ? colors.success : colors.error }]}>{pass ? '✓ Pass' : '✗ Fail'}</Text>
                    <Text style={s.histDate}>{fmtDate(last.date)}</Text>
                    {last.mileage != null && <Text style={s.histMeta}>{last.mileage.toLocaleString()} km</Text>}
                  </View>
                  {(sd.co || sd.hc || sd.co2 || sd.lambda) && (
                    <Text style={s.histReadings}>
                      {[sd.co && `CO: ${sd.co}%`, sd.hc && `HC: ${sd.hc} ppm`, sd.co2 && `CO₂: ${sd.co2}%`, sd.lambda && `λ: ${sd.lambda}`].filter(Boolean).join('  ·  ')}
                    </Text>
                  )}
                  {sd.station && <Text style={s.histMeta}>{sd.station}</Text>}
                </View>
              )
            })()}

            <Text style={s.sectionTitle}>{t('vehicleTests.logEmissionTest')}</Text>

            <Text style={s.label}>{t('logEmissionTest.testResult')} <Text style={s.req}>*</Text></Text>
            <View style={s.chipRow}>
              {(['Pass', 'Fail'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, eResult === opt && (opt === 'Pass' ? s.chipPass : s.chipFail)]}
                  onPress={() => setEResult(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, eResult === opt && s.chipTextSel]}>
                    {opt === 'Pass' ? '✓ Pass' : '✗ Fail'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.row}>
              <View style={s.half}>
                <DateField label={t('logEmissionTest.testDate')} value={eDate} onChange={setEDate} maximumDate={new Date()} />
              </View>
              <View style={s.half}>
                <FormField
                  label={t('addService.mileage')} value={eMileage} onChangeText={setEMileage}
                  placeholder="e.g. 45000" keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={s.subSectionLabel}>{t('vehicleTests.readingsOptional')}</Text>
            <View style={s.row}>
              <View style={s.half}>
                <FormField label={t('addService.field.co')} value={eCo} onChangeText={setECo} placeholder="e.g. 0.8" keyboardType="decimal-pad" />
              </View>
              <View style={s.half}>
                <FormField label={t('addService.field.hc')} value={eHc} onChangeText={setEHc} placeholder="e.g. 120" keyboardType="number-pad" />
              </View>
            </View>
            <View style={s.row}>
              <View style={s.half}>
                <FormField label={t('addService.field.co2')} value={eCo2} onChangeText={setECo2} placeholder="e.g. 14.2" keyboardType="decimal-pad" />
              </View>
              <View style={s.half}>
                <FormField label={t('addService.field.lambda')} value={eLambda} onChangeText={setELambda} placeholder="e.g. 1.01" keyboardType="decimal-pad" />
              </View>
            </View>

            <FormField label={t('logEmissionTest.testingStation')} value={eStation} onChangeText={setEStation} placeholder="e.g. Werahera Testing Station" />

            <FormField label={t('logEmissionTest.costOptional')} value={eCost} onChangeText={setECost} placeholder="e.g. 2500" keyboardType="number-pad" />

            <View style={s.reminderCard}>
              <Text style={s.reminderTitle}>{t('addExpense.setRenewalReminder')}</Text>
              <Text style={s.reminderSub}>{t('addExpense.reminderSub')}</Text>
              <FormField
                label={t('logEmissionTest.nextExpiryDate')} value={eNextExpiry} onChangeText={setENextExpiry}
                placeholder="e.g. 06/2027" keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={s.saveBtnWrap}>
              <Button title={isShared ? t('vehicleTests.submitForApproval') : t('logEmissionTest.saveEmissionTest')} onPress={saveEmissionTest} loading={eSaving} />
            </View>

            {emissionHistory.length > 1 && (
              <>
                <Text style={s.historyTitle}>{t('vehicleTests.previousTests')}</Text>
                {emissionHistory.slice(1).map(r => {
                  const sd = r.structuredData?.['Emission Test / Carbon Test'] || {}
                  const pass = sd.result === 'Pass'
                  return (
                    <View key={r.id} style={[s.histCard, { borderLeftColor: pass ? colors.success : colors.error }]}>
                      <View style={s.histRow}>
                        <Text style={[s.histResult, { color: pass ? colors.success : colors.error }]}>
                          {pass ? '✓ Pass' : '✗ Fail'}
                        </Text>
                        <Text style={s.histDate}>{fmtDate(r.date)}</Text>
                        {r.mileage != null && <Text style={s.histMeta}>{r.mileage.toLocaleString()} km</Text>}
                      </View>
                      {(sd.co || sd.hc || sd.co2 || sd.lambda) && (
                        <Text style={s.histReadings}>
                          {[sd.co && `CO: ${sd.co}%`, sd.hc && `HC: ${sd.hc} ppm`, sd.co2 && `CO₂: ${sd.co2}%`, sd.lambda && `λ: ${sd.lambda}`].filter(Boolean).join('  ·  ')}
                        </Text>
                      )}
                      {sd.station && <Text style={s.histMeta}>{sd.station}</Text>}
                      {r.cost != null && <Text style={s.histCost}>LKR {r.cost.toLocaleString()}</Text>}
                    </View>
                  )
                })}
              </>
            )}
          </>
        ) : activeTab === 'alignment' ? (
          <>
            {alignmentHistory.length > 0 && (() => {
              const last = alignmentHistory[0]
              const sd = last.structuredData?.['Wheel Alignment'] || {}
              return (
                <View style={[s.histCard, { borderLeftColor: colors.primary, marginBottom: 20 }]}>
                  <View style={[s.histRow, { marginBottom: 6 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginRight: 4 }}>📌 {t('vehicleTests.latest')}</Text>
                  </View>
                  <View style={s.histRow}>
                    <Text style={s.histLabel}>Wheel Alignment</Text>
                    <Text style={s.histDate}>{fmtDate(last.date)}</Text>
                    {last.mileage != null && <Text style={s.histMeta}>{last.mileage.toLocaleString()} km</Text>}
                  </View>
                  {sd.axle && <Text style={s.histMeta}>{t('vehicleTests.axleLabel', { axle: sd.axle })}</Text>}
                  {last.cost != null && <Text style={s.histCost}>LKR {last.cost.toLocaleString()}</Text>}
                </View>
              )
            })()}

            <Text style={s.sectionTitle}>{t('vehicleTests.logWheelAlignment')}</Text>

            <View style={s.row}>
              <View style={s.half}>
                <DateField label={t('common.date')} value={aDate} onChange={setADate} maximumDate={new Date()} />
              </View>
              <View style={s.half}>
                <FormField
                  label={t('addService.mileage')} value={aMileage} onChangeText={setAMileage}
                  placeholder="e.g. 45000" keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={s.label}>{t('vehicleTests.axleAligned')}</Text>
            <View style={s.chipRow}>
              {(['Front', 'Rear', 'Both'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, aAxle === opt && s.chipSel]}
                  onPress={() => setAAxle(aAxle === opt ? '' : opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, aAxle === opt && s.chipTextSel]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormField label={t('logEmissionTest.costOptional')} value={aCost} onChangeText={setACost} placeholder="e.g. 1500" keyboardType="number-pad" />

            <View style={s.saveBtnWrap}>
              <Button title={isShared ? t('vehicleTests.submitForApproval') : t('vehicleTests.saveAlignmentRecord')} onPress={saveAlignment} loading={aSaving} />
            </View>

            {tyrePrediction ? (
              <View style={s.predCard}>
                <Text style={s.predTitle}>{t('vehicleTests.tyreLifePrediction')}</Text>
                <Text style={s.predNote}>
                  {tyrePrediction.alignmentCount > 0
                    ? t('vehicleTests.predNoteWithAlignments', { count: tyrePrediction.alignmentCount, s: tyrePrediction.alignmentCount > 1 ? 's' : '', date: tyrePrediction.lastTyreDate, note: tyrePrediction.freqNote })
                    : t('vehicleTests.predNoteNoAlignments', { date: tyrePrediction.lastTyreDate })
                  }
                </Text>
                <View style={s.predRow}>
                  <View style={s.predStat}>
                    <Text style={s.predStatVal}>{tyrePrediction.predictedLife.toLocaleString()} km</Text>
                    <Text style={s.predStatLabel}>{t('vehicleTests.predictedLife')}</Text>
                  </View>
                  {tyrePrediction.dueAtKm != null && (
                    <View style={s.predStat}>
                      <Text style={s.predStatVal}>{tyrePrediction.dueAtKm.toLocaleString()} km</Text>
                      <Text style={s.predStatLabel}>{t('vehicleTests.changeDueAt')}</Text>
                    </View>
                  )}
                  {tyrePrediction.remainingKm != null && (
                    <View style={s.predStat}>
                      <Text style={[
                        s.predStatVal,
                        tyrePrediction.remainingKm < 0 ? { color: colors.error } : tyrePrediction.remainingKm <= 3000 ? { color: colors.warning } : {},
                      ]}>
                        {tyrePrediction.remainingKm < 0
                          ? t('vehicleTests.kmOverdue', { km: Math.abs(tyrePrediction.remainingKm).toLocaleString() })
                          : t('vehicleTests.kmLeft', { km: tyrePrediction.remainingKm.toLocaleString() })
                        }
                      </Text>
                      <Text style={s.predStatLabel}>{t('vehicleTests.remaining')}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.predHint}>
                <Text style={s.predHintText}>
                  💡 {t('vehicleTests.predHint')}
                </Text>
              </View>
            )}

            {alignmentHistory.length > 1 && (
              <>
                <Text style={s.historyTitle}>{t('vehicleTests.previousAlignments')}</Text>
                {alignmentHistory.slice(1).map(r => {
                  const sd = r.structuredData?.['Wheel Alignment'] || {}
                  return (
                    <View key={r.id} style={[s.histCard, { borderLeftColor: colors.primary }]}>
                      <View style={s.histRow}>
                        <Text style={s.histLabel}>Wheel Alignment</Text>
                        <Text style={s.histDate}>{fmtDate(r.date)}</Text>
                        {r.mileage != null && <Text style={s.histMeta}>{r.mileage.toLocaleString()} km</Text>}
                      </View>
                      {sd.axle && <Text style={s.histMeta}>{t('vehicleTests.axleLabel', { axle: sd.axle })}</Text>}
                      {r.cost != null && <Text style={s.histCost}>LKR {r.cost.toLocaleString()}</Text>}
                    </View>
                  )
                })}
              </>
            )}

            {!loadingRecords && alignmentHistory.length === 0 && (
              <Text style={s.emptyNote}>{t('vehicleTests.noAlignmentRecords')}</Text>
            )}
          </>
        ) : activeTab === 'chain' ? (
          <>
            <Text style={s.sectionTitle}>{t('vehicleTests.chainMaintenance')}</Text>

            {/* Chain status card */}
            {(() => {
              const { lubeStatus, kmSinceLube, kmSinceReplace, lastLube, lastReplace } = chainStatus
              const statusColor = lubeStatus === 'ok' ? colors.success : lubeStatus === 'due' ? colors.warning : lubeStatus === 'overdue' ? colors.error : colors.textMuted
              const statusBg = lubeStatus === 'ok' ? '#e8f5e9' : lubeStatus === 'due' ? '#fff3e0' : lubeStatus === 'overdue' ? '#fdecea' : '#f5f5f5'
              const statusLabel = lubeStatus === 'ok' ? `✓ ${t('vehicleTests.chain.ok')}` : lubeStatus === 'due' ? `⚠ ${t('vehicleTests.chain.dueSoon')}` : lubeStatus === 'overdue' ? `⚠ ${t('vehicleTests.chain.overdue')}` : t('vehicleTests.chain.noRecord')
              return (
                <View style={[s.chainStatusCard, { backgroundColor: statusBg, borderColor: statusColor }]}>
                  <Text style={[s.chainStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
                  {kmSinceLube !== null && (
                    <Text style={s.chainStatusKm}>{t('vehicleTests.chain.kmSinceLube', { km: kmSinceLube.toLocaleString() })}</Text>
                  )}
                  {kmSinceLube === null && (
                    <Text style={s.chainStatusKm}>{t('vehicleTests.chain.logFirst')}</Text>
                  )}
                  {kmSinceReplace !== null && (
                    <Text style={s.chainStatusKm}>{t('vehicleTests.chain.kmSinceReplace', { km: kmSinceReplace.toLocaleString() })}</Text>
                  )}
                  {lastLube && (
                    <Text style={s.chainStatusDate}>{t('vehicleTests.chain.lastLube', { date: fmtDate(lastLube.date) })}{lastLube.mileage != null ? t('vehicleTests.atKmPlain', { km: lastLube.mileage.toLocaleString() }) : ''}</Text>
                  )}
                  {lastReplace && (
                    <Text style={s.chainStatusDate}>{t('vehicleTests.chain.lastReplace', { date: fmtDate(lastReplace.date) })}{lastReplace.mileage != null ? t('vehicleTests.atKmPlain', { km: lastReplace.mileage.toLocaleString() }) : ''}</Text>
                  )}
                </View>
              )
            })()}

            <Text style={s.label}>{t('vehicleTests.serviceType')} <Text style={s.req}>*</Text></Text>
            <View style={s.chipRow}>
              {(['Lubrication', 'Tension Check', 'Chain & Sprocket'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, cServiceType === opt && s.chipSel]}
                  onPress={() => setCServiceType(cServiceType === opt ? '' : opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, cServiceType === opt && s.chipTextSel]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {cServiceType === 'Lubrication' && (
              <View style={s.chainTip}>
                <Text style={s.chainTipText}>{t('vehicleTests.chainTip.lubrication')}</Text>
              </View>
            )}
            {cServiceType === 'Chain & Sprocket' && (
              <View style={s.chainTip}>
                <Text style={s.chainTipText}>{t('vehicleTests.chainTip.sprocket')}</Text>
              </View>
            )}

            <View style={s.row}>
              <View style={s.half}>
                <DateField label={t('common.date')} value={cDate} onChange={setCDate} maximumDate={new Date()} />
              </View>
              <View style={s.half}>
                <FormField
                  label={t('addService.mileage')} value={cMileage} onChangeText={setCMileage}
                  placeholder="e.g. 18000" keyboardType="number-pad"
                />
              </View>
            </View>

            <FormField label={t('logEmissionTest.costOptional')} value={cCost} onChangeText={setCCost} placeholder="e.g. 500" keyboardType="number-pad" />

            <View style={s.saveBtnWrap}>
              <Button title={t('vehicleTests.saveChainRecord')} onPress={saveChain} loading={cSaving} />
            </View>

            {chainHistory.length > 0 && (
              <>
                <Text style={s.historyTitle}>{t('vehicleTests.chainServiceHistory')}</Text>
                {chainHistory.map(r => (
                  <View key={r.id} style={[s.histCard, { borderLeftColor: colors.orange }]}>
                    <View style={s.histRow}>
                      <Text style={s.histLabel}>{r.description}</Text>
                      <Text style={s.histDate}>{fmtDate(r.date)}</Text>
                      {r.mileage != null && <Text style={s.histMeta}>{r.mileage.toLocaleString()} km</Text>}
                    </View>
                    {r.cost != null && <Text style={s.histCost}>LKR {r.cost.toLocaleString()}</Text>}
                  </View>
                ))}
              </>
            )}

            {!loadingRecords && chainHistory.length === 0 && (
              <Text style={s.emptyNote}>{t('vehicleTests.noChainRecords')}</Text>
            )}
          </>
        ) : activeTab === 'insurance' ? (
          <>
            {/* Pinned current policy card */}
            {(() => {
              const status = getDocStatus(insuranceExpiry)
              const hasDetails = insuranceExpiry || insuranceCompany
              return (
                <View style={[s.docStatusCard, { backgroundColor: status.bg, borderLeftColor: status.color }]}>
                  <Text style={[s.docStatusPin, { color: status.color }]}>📌 {t('vehicleTests.currentPolicy')}</Text>
                  {insuranceCompany ? (
                    <Text style={[s.docStatusMain, { color: status.color }]}>{insuranceCompany}</Text>
                  ) : null}
                  {insurancePolicyNo ? (
                    <Text style={s.docStatusMeta}>{t('vehicleTests.policyNo', { no: insurancePolicyNo })}</Text>
                  ) : null}
                  <Text style={[s.docStatusLabel, { color: status.color }]}>{status.label}</Text>
                  {insuranceExpiry ? (
                    <Text style={s.docStatusDate}>
                      {t('vehicleTests.expiryDate', { date: new Date(insuranceExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                    </Text>
                  ) : null}
                  {!hasDetails && (
                    <Text style={s.docStatusMeta}>{t('vehicleTests.noInsuranceDetails')}</Text>
                  )}
                  <Text style={s.docStatusHint}>{t('vehicleTests.tapEditToUpdate')}</Text>
                </View>
              )
            })()}

            {insuranceHistory.length > 0 && (
              <>
                <Text style={s.historyTitle}>{t('vehicleTests.insuranceHistory')}</Text>
                {insuranceHistory.map(e => (
                  <View key={e.id} style={[s.histCard, { borderLeftColor: colors.primary }]}>
                    <View style={s.histRow}>
                      <Text style={s.histLabel}>{e.description || 'Insurance'}</Text>
                      <Text style={s.histDate}>{fmtDate(e.date)}</Text>
                    </View>
                    {e.mileage != null && <Text style={s.histMeta}>{e.mileage.toLocaleString()} km</Text>}
                    <Text style={s.histCost}>LKR {e.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </>
            )}
            {!loadingRecords && insuranceHistory.length === 0 && (
              <Text style={s.emptyNote}>{t('vehicleTests.noInsuranceRecords')}</Text>
            )}
          </>
        ) : activeTab === 'licence' ? (
          <>
            {/* Pinned current RL card */}
            {(() => {
              const status = getDocStatus(revenueLicenceExpiry)
              return (
                <View style={[s.docStatusCard, { backgroundColor: status.bg, borderLeftColor: status.color }]}>
                  <Text style={[s.docStatusPin, { color: status.color }]}>📌 {t('vehicleTests.currentRevenueLicence')}</Text>
                  <Text style={[s.docStatusLabel, { color: status.color }]}>{status.label}</Text>
                  {revenueLicenceExpiry ? (
                    <Text style={s.docStatusDate}>
                      {t('vehicleTests.expiryDate', { date: new Date(revenueLicenceExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                    </Text>
                  ) : (
                    <Text style={s.docStatusMeta}>{t('vehicleTests.noExpirySaved')}</Text>
                  )}
                  <Text style={s.docStatusHint}>{t('vehicleTests.tapEditToUpdate')}</Text>
                </View>
              )
            })()}

            {licenceHistory.length > 0 && (
              <>
                <Text style={s.historyTitle}>{t('vehicleTests.revenueLicenceHistory')}</Text>
                {licenceHistory.map(e => (
                  <View key={e.id} style={[s.histCard, { borderLeftColor: '#7b1fa2' }]}>
                    <View style={s.histRow}>
                      <Text style={s.histLabel}>{e.description || 'Revenue Licence'}</Text>
                      <Text style={s.histDate}>{fmtDate(e.date)}</Text>
                    </View>
                    {e.mileage != null && <Text style={s.histMeta}>{e.mileage.toLocaleString()} km</Text>}
                    <Text style={s.histCost}>LKR {e.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </>
            )}
            {!loadingRecords && licenceHistory.length === 0 && (
              <Text style={s.emptyNote}>{t('vehicleTests.noLicenceRecords')}</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    tabBar: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, maxHeight: 50 },
    tabBarContent: { flexDirection: 'row' },
    tab: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    tabTextActive: { color: c.primary },

    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 60 },

    sectionTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginBottom: 16 },
    subSectionLabel: { fontSize: 13, fontWeight: '700', color: c.primary, marginTop: 20, marginBottom: 2 },

    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 6, marginTop: 14 },
    req: { color: c.error },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },

    chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 4 },
    chip: {
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.borderMid, backgroundColor: c.surface,
    },
    chipSel: { backgroundColor: c.primary, borderColor: c.primary },
    chipPass: { backgroundColor: c.success, borderColor: c.success },
    chipFail: { backgroundColor: c.error, borderColor: c.error },
    chipText: { fontSize: 14, color: c.textSub, fontWeight: '600' },
    chipTextSel: { color: '#fff', fontWeight: '700' },

    reminderCard: {
      backgroundColor: c.primaryTint, borderRadius: 14, padding: 16,
      marginTop: 24, borderWidth: 1, borderColor: c.primaryTintText + '44',
    },
    reminderTitle: { fontSize: 15, fontWeight: '700', color: c.primary, marginBottom: 4 },
    reminderSub: { fontSize: 12, color: c.textSub, marginBottom: 8 },

    saveBtnWrap: { marginTop: 28 },

    historyTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 32, marginBottom: 12 },
    histCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14,
      marginBottom: 10, borderLeftWidth: 4, elevation: 1,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
    },
    histRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    histResult: { fontSize: 14, fontWeight: '700' },
    histLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    histDate: { fontSize: 13, color: c.textSub },
    histMeta: { fontSize: 12, color: c.textMuted },
    histReadings: { fontSize: 12, color: c.textSub, marginTop: 2 },
    histCost: { fontSize: 12, color: c.primary, fontWeight: '600', marginTop: 4 },

    predCard: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16,
      marginTop: 24, borderWidth: 1, borderColor: c.borderMid,
      elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    },
    predTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 6 },
    predNote: { fontSize: 12, color: c.textSub, marginBottom: 14, lineHeight: 18 },
    predRow: { flexDirection: 'row', justifyContent: 'space-around' },
    predStat: { alignItems: 'center', flex: 1 },
    predStatVal: { fontSize: 15, fontWeight: '800', color: c.text, textAlign: 'center' },
    predStatLabel: { fontSize: 11, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    predHint: {
      backgroundColor: c.primaryTint, borderRadius: 12, padding: 16, marginTop: 24,
      borderWidth: 1, borderColor: c.primaryTintText + '44',
    },
    predHintText: { fontSize: 13, color: c.primaryTintText, lineHeight: 20 },

    emptyNote: { fontSize: 13, color: c.textFaint, textAlign: 'center', marginTop: 24 },

    tabDot: {
      width: 7, height: 7, borderRadius: 4, backgroundColor: c.error,
      position: 'absolute', top: 8, right: 8,
    },

    chainStatusCard: {
      borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 20,
    },
    chainStatusLabel: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
    chainStatusKm: { fontSize: 13, color: '#5d4037', marginBottom: 2 },
    chainStatusDate: { fontSize: 12, color: '#6d5a52', marginTop: 4 },

    chainTip: {
      backgroundColor: '#fff8e1', borderRadius: 10, padding: 12,
      marginBottom: 4, borderLeftWidth: 3, borderLeftColor: c.warning,
    },
    chainTipText: { fontSize: 12, color: '#5d4037', lineHeight: 18 },

    docStatusCard: {
      borderRadius: 12, padding: 16, marginBottom: 20,
      borderLeftWidth: 4, elevation: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    },
    docStatusPin: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
    docStatusMain: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    docStatusLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    docStatusDate: { fontSize: 13, color: '#5d4037', marginTop: 2 },
    docStatusMeta: { fontSize: 13, color: '#6d5a52', marginTop: 4, lineHeight: 18 },
    docStatusHint: { fontSize: 11, color: c.textFaint, marginTop: 10 },
  })
}
