import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import Button from '../components/Button'
import { useTranslation } from '../i18n/LanguageContext'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  mileage: number
}

type Props = {
  token: string
  vehicle: Vehicle
  onBack: () => void
  onTransferInitiated: () => void
}

type Step = 'enterPhone' | 'confirm'

export default function SellScreen({ token, vehicle, onBack, onTransferInitiated }: Props) {
  const [step, setStep] = useState<Step>('enterPhone')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [analytics, setAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [selling, setSelling] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const loadSummary = async () => {
    setLoadingAnalytics(true)
    try {
      const data = await api.getAnalytics(token, vehicle.id)
      setAnalytics(data)
    } catch {
      // analytics optional
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const handleContinue = () => {
    const phone = buyerPhone.trim()
    if (!phone) { Alert.alert(t('sell.required.title'), t('sell.required.message')); return }
    if (phone.length < 9) { Alert.alert(t('sell.invalid.title'), t('sell.invalid.message')); return }
    setStep('confirm')
    loadSummary()
  }

  const handleConfirmSell = async () => {
    Alert.alert(
      t('sell.confirmTransfer.title'),
      t('sell.confirmTransfer.message', { reg: vehicle.registrationNo, phone: buyerPhone.trim() }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sell.yesTransfer'),
          style: 'destructive',
          onPress: async () => {
            setSelling(true)
            try {
              await api.initiateTransfer(token, vehicle.id, buyerPhone.trim())
              Alert.alert(
                t('sell.transferInitiated.title'),
                t('sell.transferInitiated.message', { phone: buyerPhone.trim() }),
                [{ text: 'OK', onPress: onTransferInitiated }]
              )
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message)
            } finally {
              setSelling(false)
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title={t('sell.title')} onBack={step === 'confirm' ? () => setStep('enterPhone') : onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.vehicleBanner}>
        <Text style={styles.bannerReg}>{vehicle.registrationNo}</Text>
        <Text style={styles.bannerName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text style={styles.bannerMeta}>{vehicle.mileage.toLocaleString()} km · {vehicle.fuelType}</Text>
      </View>

      {step === 'enterPhone' && (
        <>
          <Text style={styles.sectionSub}>
            {t('sell.enterPhoneNote')}
          </Text>

          <FormField
            label={t('sell.buyerMobileNumber')}
            value={buyerPhone}
            onChangeText={setBuyerPhone}
            placeholder="e.g. +94771234567"
            keyboardType="phone-pad"
            autoFocus
          />

          <Button title={t('sell.continueArrow')} onPress={handleContinue} />
        </>
      )}

      {step === 'confirm' && (
        <>
          <Text style={styles.sectionTitle}>{t('sell.confirmTransferTitle')}</Text>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>{t('sell.transferringTo')}</Text>
            <Text style={styles.confirmPhone}>{buyerPhone.trim()}</Text>
          </View>

          {loadingAnalytics ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : analytics && (
            <View style={styles.summaryCard}>
              <Text style={styles.confirmLabel}>{t('sell.whatTransfers')}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>🔧 {t('sell.serviceRecords')}</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.serviceRecords ?? 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>⛽ {t('sell.fuelLogs')}</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.fuelLogs ?? 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>💰 {t('sell.expenseRecords')}</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.expenses ?? 0}</Text>
              </View>
              {analytics.totalSpend > 0 && (
                <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                  <Text style={styles.summaryTotalLabel}>{t('sell.totalSpendRecorded')}</Text>
                  <Text style={styles.summaryTotalValue}>LKR {analytics.totalSpend.toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ {t('sell.irreversibleTitle')}</Text>
            <Text style={styles.warningText}>
              {t('sell.irreversibleText')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sellBtn, selling && styles.sellBtnDisabled]}
            onPress={handleConfirmSell}
            disabled={selling}
          >
            {selling
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sellBtnText}>{t('sell.initiateTransfer')}</Text>
            }
          </TouchableOpacity>
        </>
      )}
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 56 },
    vehicleBanner: {
      backgroundColor: c.primary, borderRadius: 12, padding: 16, marginBottom: 24,
    },
    bannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
    bannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
    bannerMeta: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
    sectionSub: { fontSize: 14, color: c.textMuted, marginBottom: 20, lineHeight: 20 },
    confirmCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    confirmLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginBottom: 6 },
    confirmPhone: { fontSize: 20, fontWeight: '700', color: c.text },
    summaryCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    summaryRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.background,
    },
    summaryTotalRow: { marginTop: 4, borderTopWidth: 1, borderTopColor: c.borderMid },
    summaryItem: { fontSize: 14, color: c.textBody },
    summaryCount: { fontSize: 14, fontWeight: '700', color: c.primary },
    summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    summaryTotalValue: { fontSize: 14, fontWeight: '700', color: c.primary },
    warningBox: {
      backgroundColor: '#fff3e0', borderRadius: 12, padding: 16,
      marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#e65100',
    },
    warningTitle: { fontSize: 14, fontWeight: '700', color: '#e65100', marginBottom: 8 },
    warningText: { fontSize: 13, color: '#5d4037', lineHeight: 20 },
    sellBtn: {
      backgroundColor: c.error, borderRadius: 12,
      paddingVertical: 18, alignItems: 'center',
    },
    sellBtnDisabled: { opacity: 0.6 },
    sellBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  })
}
