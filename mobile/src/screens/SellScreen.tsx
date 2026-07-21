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
    if (!phone) { Alert.alert('Required', 'Please enter the buyer\'s mobile number.'); return }
    if (phone.length < 9) { Alert.alert('Invalid', 'Please enter a valid mobile number.'); return }
    setStep('confirm')
    loadSummary()
  }

  const handleConfirmSell = async () => {
    Alert.alert(
      'Confirm Transfer',
      `Transfer ${vehicle.registrationNo} to ${buyerPhone.trim()}?\n\nThis is irreversible once the buyer accepts. All service history will move to their account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Transfer',
          style: 'destructive',
          onPress: async () => {
            setSelling(true)
            try {
              await api.initiateTransfer(token, vehicle.id, buyerPhone.trim())
              Alert.alert(
                'Transfer Initiated',
                `A transfer request has been sent to ${buyerPhone.trim()}. Once they accept, the vehicle will move to their account.`,
                [{ text: 'OK', onPress: onTransferInitiated }]
              )
            } catch (e: any) {
              Alert.alert('Error', e.message)
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
      <ScreenHeader title="Sell / Transfer Vehicle" onBack={step === 'confirm' ? () => setStep('enterPhone') : onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.vehicleBanner}>
        <Text style={styles.bannerReg}>{vehicle.registrationNo}</Text>
        <Text style={styles.bannerName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text style={styles.bannerMeta}>{vehicle.mileage.toLocaleString()} km · {vehicle.fuelType}</Text>
      </View>

      {step === 'enterPhone' && (
        <>
          <Text style={styles.sectionSub}>
            Enter the mobile number the buyer uses for their TechVehicle account.
            They will receive a transfer request to accept.
          </Text>

          <FormField
            label="Buyer's Mobile Number (with country code)"
            value={buyerPhone}
            onChangeText={setBuyerPhone}
            placeholder="e.g. +94771234567"
            keyboardType="phone-pad"
            autoFocus
          />

          <Button title="Continue →" onPress={handleContinue} />
        </>
      )}

      {step === 'confirm' && (
        <>
          <Text style={styles.sectionTitle}>Confirm Transfer</Text>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Transferring to</Text>
            <Text style={styles.confirmPhone}>{buyerPhone.trim()}</Text>
          </View>

          {loadingAnalytics ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : analytics && (
            <View style={styles.summaryCard}>
              <Text style={styles.confirmLabel}>What transfers with this vehicle</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>🔧 Service records</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.serviceRecords ?? 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>⛽ Fuel logs</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.fuelLogs ?? 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>💰 Expense records</Text>
                <Text style={styles.summaryCount}>{analytics.recordCounts?.expenses ?? 0}</Text>
              </View>
              {analytics.totalSpend > 0 && (
                <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                  <Text style={styles.summaryTotalLabel}>Total spend recorded</Text>
                  <Text style={styles.summaryTotalValue}>LKR {analytics.totalSpend.toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ This is irreversible</Text>
            <Text style={styles.warningText}>
              Once the buyer accepts, all service history, fuel logs, and expense records are permanently removed from your account and added to theirs.{'\n\n'}
              If the buyer does not have a TechVehicle account yet, they will see this transfer when they register with the same number.{'\n\n'}
              You can cancel this transfer at any time before the buyer accepts.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sellBtn, selling && styles.sellBtnDisabled]}
            onPress={handleConfirmSell}
            disabled={selling}
          >
            {selling
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sellBtnText}>Initiate Transfer</Text>
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
