import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import Button from '../components/Button'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  vehicleId: string
  onBack: () => void
  onShared: () => void
}

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type GarageResult = {
  id: string
  name: string
  address: string | null
  verified: boolean
}

type Step = 'selectServiceType' | 'selectRecords' | 'selectGarage' | 'confirm'

const SERVICE_TYPE_OPTIONS: { key: string; labelKey: TranslationKey; icon: string; descKey: TranslationKey }[] = [
  { key: 'full', labelKey: 'share.serviceType.full.label', icon: '🔧', descKey: 'share.serviceType.full.desc' },
  { key: 'between', labelKey: 'share.serviceType.between.label', icon: '⚡', descKey: 'share.serviceType.between.desc' },
  { key: 'third_party', labelKey: 'share.serviceType.thirdParty.label', icon: '🏭', descKey: 'share.serviceType.thirdParty.desc' },
]

export default function ShareScreen({ token, vehicleId, onBack, onShared }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('selectServiceType')
  const [serviceType, setServiceType] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [garageResults, setGarageResults] = useState<GarageResult[]>([])
  const [selectedGarage, setSelectedGarage] = useState<GarageResult | null>(null)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  useEffect(() => {
    api.getServiceRecords(token, vehicleId)
      .then(setRecords)
      .catch((e: any) => Alert.alert(t('common.error'), e.message))
      .finally(() => setLoading(false))
  }, [])

  // Load all garages on mount
  useEffect(() => {
    setSearching(true)
    api.searchGarages(token, '').then(setGarageResults).catch(() => {}).finally(() => setSearching(false))
  }, [])

  const toggleRecord = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSearch = async (text: string) => {
    setSearchText(text)
    setSearching(true)
    try {
      const results = await api.searchGarages(token, text)
      setGarageResults(results)
    } catch {
      setGarageResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleShare = async () => {
    if (!selectedGarage) return
    setSending(true)
    try {
      await api.createShare(token, {
        vehicleId,
        garageId: selectedGarage.id,
        recordIds: Array.from(selectedIds),
        serviceType: serviceType || undefined,
      })
      Alert.alert(
        t('share.shared.title'),
        t('share.shared.message', { count: selectedIds.size, s: selectedIds.size > 1 ? 's' : '', garage: selectedGarage.name }),
        [{ text: 'OK', onPress: onShared }]
      )
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const parseServices = (description: string) => {
    return description.split(',').map(s => s.trim()).filter(Boolean)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader
        title={t('share.title')}
        onBack={() => {
          if (step === 'selectServiceType') onBack()
          else if (step === 'selectRecords') setStep('selectServiceType')
          else if (step === 'selectGarage') setStep('selectRecords')
          else if (step === 'confirm') setStep('selectGarage')
        }}
      />
      <View style={styles.stepIndicatorWrap}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step !== 'selectServiceType' && styles.stepDotDone]} />
          <View style={[styles.stepLine, ['selectGarage', 'confirm'].includes(step) && styles.stepLineDone]} />
          <View style={[styles.stepDot, ['selectGarage', 'confirm'].includes(step) && styles.stepDotDone]} />
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineDone]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotDone]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>
      </View>

      {step === 'selectServiceType' && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>{t('share.typeOfVisit')}</Text>
          <Text style={styles.stepSub}>{t('share.typeOfVisitSub')}</Text>
          {SERVICE_TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.serviceTypeCard, serviceType === opt.key && styles.serviceTypeCardSelected]}
              onPress={() => setServiceType(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceTypeIcon}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceTypeLabel, serviceType === opt.key && styles.serviceTypeLabelSelected]}>
                  {t(opt.labelKey)}
                </Text>
                <Text style={[styles.serviceTypeDesc, serviceType === opt.key && styles.serviceTypeDescSelected]}>{t(opt.descKey)}</Text>
              </View>
              {serviceType === opt.key && <Text style={styles.serviceTypeCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
          <View style={styles.nextBtnWrap}>
            <Button title={t('share.nextSelectRecords')} onPress={() => setStep('selectRecords')} disabled={!serviceType} />
          </View>
        </ScrollView>
      )}

      {step === 'selectRecords' && (
        <>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{t('share.selectRecordsTitle')}</Text>
            <Text style={styles.stepSub}>{t('share.selectRecordsSub')}</Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>{t('share.noServiceRecords')}</Text>
            ) : records.map(record => {
              const services = parseServices(record.description)
              const isSelected = selectedIds.has(record.id)
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.recordCard, isSelected && styles.recordCardSelected]}
                  onPress={() => toggleRecord(record.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.recordTop}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.recordDate, isSelected && styles.recordDateSelected]}>{formatDate(record.date)}</Text>
                    {record.cost != null && (
                      <Text style={[styles.recordCost, isSelected && styles.recordCostSelected]}>LKR {record.cost.toLocaleString()}</Text>
                    )}
                  </View>
                  <View style={styles.tagRow}>
                    {services.slice(0, 3).map((srv, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText} numberOfLines={1}>{srv}</Text>
                      </View>
                    ))}
                    {services.length > 3 && (
                      <View style={styles.tagMore}>
                        <Text style={styles.tagMoreText}>+{services.length - 3}</Text>
                      </View>
                    )}
                  </View>
                  {record.mileage && (
                    <Text style={[styles.recordMileage, isSelected && styles.recordMileageSelected]}>{record.mileage.toLocaleString()} km</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Button
              title={t('share.nextRecordsSelected', { count: selectedIds.size, s: selectedIds.size !== 1 ? 's' : '' })}
              onPress={() => setStep('selectGarage')}
              disabled={selectedIds.size === 0}
            />
          </View>
        </>
      )}

      {step === 'selectGarage' && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>{t('share.findGarage')}</Text>
          <Text style={styles.stepSub}>{t('share.findGarageSub')}</Text>

          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={handleSearch}
            placeholder={t('share.typeGarageName')}
            placeholderTextColor={colors.textFaint}
            autoFocus
          />

          {searching && <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />}

          {garageResults.map(g => (
            <TouchableOpacity
              key={g.id}
              style={[styles.garageCard, selectedGarage?.id === g.id && styles.garageCardSelected]}
              onPress={() => setSelectedGarage(g)}
            >
              <View style={styles.garageRow}>
                <Text style={[styles.garageName, selectedGarage?.id === g.id && styles.garageNameSelected]}>{g.name}</Text>
                {g.verified && <Text style={styles.verifiedBadge}>✅</Text>}
              </View>
              {g.address && (
                <Text style={[styles.garageAddress, selectedGarage?.id === g.id && styles.garageAddressSelected]}>{g.address}</Text>
              )}
            </TouchableOpacity>
          ))}

          {searchText.length >= 2 && !searching && garageResults.length === 0 && (
            <Text style={styles.noResults}>{t('share.noGaragesFound', { query: searchText })}</Text>
          )}

          {selectedGarage && (
            <View style={styles.nextBtnWrap}>
              <Button title={t('share.nextShareWith', { name: selectedGarage.name })} onPress={() => setStep('confirm')} />
            </View>
          )}
        </ScrollView>
      )}

      {step === 'confirm' && selectedGarage && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.stepTitle}>{t('share.confirmShare')}</Text>
          <Text style={styles.stepSub}>{t('share.reviewBeforeSending')}</Text>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>{t('share.sharingWith')}</Text>
            <Text style={styles.confirmGarage}>{selectedGarage.name}</Text>
            {selectedGarage.verified && <Text style={styles.verifiedText}>✅ {t('share.verifiedGarage')}</Text>}
            {selectedGarage.address && (
              <Text style={styles.confirmAddress}>📍 {selectedGarage.address}</Text>
            )}
          </View>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>{t('share.recordsWillBeShared', { count: selectedIds.size, s: selectedIds.size !== 1 ? 's' : '' })}</Text>
            {records
              .filter(r => selectedIds.has(r.id))
              .map(r => (
                <View key={r.id} style={styles.confirmRecord}>
                  <Text style={styles.confirmRecordDate}>{formatDate(r.date)}</Text>
                  <Text style={styles.confirmRecordDesc} numberOfLines={1}>
                    {parseServices(r.description).slice(0, 2).join(', ')}
                    {parseServices(r.description).length > 2 ? '...' : ''}
                  </Text>
                </View>
              ))
            }
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {t('share.readOnlyWarning')}
            </Text>
          </View>

          <View style={styles.shareBtnWrap}>
            <Button title={t('share.shareRecords')} onPress={handleShare} loading={sending} />
          </View>
        </ScrollView>
      )}
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
    stepIndicatorWrap: {
      backgroundColor: c.surface, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    stepIndicator: { flexDirection: 'row', alignItems: 'center' },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
    stepDotDone: { backgroundColor: c.success },
    stepDotActive: { backgroundColor: c.primary },
    stepLine: { flex: 1, height: 2, backgroundColor: c.borderMid, marginHorizontal: 4 },
    stepLineDone: { backgroundColor: c.success },
    stepHeader: { padding: 20, paddingBottom: 8 },
    stepTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    stepSub: { fontSize: 13, color: c.textMuted },
    list: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 32 },
    emptyText: { color: c.textMuted, textAlign: 'center', marginTop: 40 },
    recordCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 2, borderColor: 'transparent',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    recordCardSelected: { borderColor: c.primary, backgroundColor: c.primary },
    recordTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
      borderColor: c.borderStrong, justifyContent: 'center', alignItems: 'center',
    },
    checkboxSelected: { backgroundColor: c.primary, borderColor: '#fff' },
    checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
    recordDate: { flex: 1, fontSize: 13, color: c.textSub, fontWeight: '600' },
    recordDateSelected: { color: '#fff' },
    recordCost: { fontSize: 13, color: c.primary, fontWeight: '700' },
    recordCostSelected: { color: '#fff' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    tag: { backgroundColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    tagText: { fontSize: 12, color: c.textBody },
    tagMore: { backgroundColor: c.primaryTint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    tagMoreText: { fontSize: 12, color: c.primaryTintText, fontWeight: '600' },
    recordMileage: { fontSize: 11, color: c.textFaint },
    recordMileageSelected: { color: 'rgba(255,255,255,0.75)' },
    footer: { padding: 16, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
    nextBtnWrap: { marginTop: 16 },
    searchInput: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 15, borderWidth: 1, borderColor: c.borderMid,
      marginBottom: 12, marginTop: 16, color: c.text,
    },
    garageCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 2, borderColor: 'transparent',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    garageCardSelected: { borderColor: c.primary, backgroundColor: c.primary },
    garageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    garageName: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    garageNameSelected: { color: '#fff' },
    verifiedBadge: { fontSize: 16 },
    garageAddress: { fontSize: 13, color: c.textMuted },
    garageAddressSelected: { color: 'rgba(255,255,255,0.8)' },
    noResults: { color: c.textMuted, textAlign: 'center', marginTop: 24 },
    confirmCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    confirmLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginBottom: 6 },
    confirmGarage: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    verifiedText: { fontSize: 13, color: c.success, fontWeight: '600', marginBottom: 4 },
    confirmAddress: { fontSize: 13, color: c.textMuted },
    confirmRecord: {
      paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border,
    },
    confirmRecordDate: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
    confirmRecordDesc: { fontSize: 13, color: c.textBody, fontWeight: '500' },
    warningBox: {
      backgroundColor: '#fff8e1', borderRadius: 10, padding: 14, marginBottom: 8,
    },
    warningText: { fontSize: 13, color: '#795548', lineHeight: 19 },
    shareBtnWrap: { marginTop: 8 },
    serviceTypeCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 2, borderColor: 'transparent',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    serviceTypeCardSelected: { borderColor: c.primary, backgroundColor: c.primary },
    serviceTypeIcon: { fontSize: 26 },
    serviceTypeLabel: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    serviceTypeLabelSelected: { color: '#fff' },
    serviceTypeDesc: { fontSize: 12, color: c.textMuted },
    serviceTypeDescSelected: { color: 'rgba(255,255,255,0.8)' },
    serviceTypeCheck: { fontSize: 18, color: '#fff', fontWeight: '700' },
  })
}
