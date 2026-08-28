import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import FormField from '../components/FormField'
import DateField from '../components/DateField'
import Button from '../components/Button'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  vehicleId: string
  currentMileage: number
  onExpenseAdded: () => void
  onBack: () => void
}

const CATEGORIES: { value: string; labelKey: TranslationKey; icon: string }[] = [
  { value: 'Insurance', labelKey: 'expenseCategory.insurance', icon: '🛡️' },
  { value: 'Revenue Licence', labelKey: 'expenseCategory.revenueLicence', icon: '📋' },
  { value: 'Emission Test', labelKey: 'expenseCategory.emissionTest', icon: '💨' },
  { value: 'Fine / Penalty', labelKey: 'expenseCategory.fine', icon: '🚨' },
  { value: 'Parking', labelKey: 'expenseCategory.parking', icon: '🅿️' },
  { value: 'Toll', labelKey: 'expenseCategory.toll', icon: '🛣️' },
  { value: 'Accessories', labelKey: 'expenseCategory.accessories', icon: '🔩' },
  { value: 'Washing', labelKey: 'expenseCategory.washing', icon: '🚿' },
  { value: 'Other', labelKey: 'expenseCategory.other', icon: '📝' },
]

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const parseDate = (str: string): string | null => {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const parsed = new Date(`${y}-${m}-${d}`)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

// Parse MM/YYYY into last day of that month ISO string
function parseMMYYYY(s: string): string | null {
  const parts = s.split('/')
  if (parts.length !== 2) return null
  const [m, y] = parts
  if (!m || !y || y.length !== 4) return null
  const date = new Date(Number(y), Number(m), 0) // last day of month
  return isNaN(date.getTime()) ? null : date.toISOString()
}

const RENEWAL_CATEGORIES = new Set(['Revenue Licence', 'Insurance'])

export default function AddExpenseScreen({ token, vehicleId, currentMileage, onExpenseAdded, onBack }: Props) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState('')
  const [notes, setNotes] = useState('')
  const [renewalExpiry, setRenewalExpiry] = useState('')
  const [insuranceCompany, setInsuranceCompany] = useState('')
  const [insurancePolicyNo, setInsurancePolicyNo] = useState('')
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert(t('addExpense.selectCategory.title'), t('addExpense.selectCategory.message'))
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t('addExpense.enterAmount.title'), t('addExpense.enterAmount.message'))
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert(t('addExpense.invalidDate.title'), t('addExpense.invalidDate.message'))
      return
    }
    if (renewalExpiry.trim() && !parseMMYYYY(renewalExpiry.trim())) {
      Alert.alert(t('addExpense.invalidExpiry.title'), t('addExpense.invalidExpiry.message'))
      return
    }

    const mileageNum = mileage ? parseInt(mileage) : null
    if (mileageNum != null && mileageNum > currentMileage) {
      Alert.alert(
        t('addExpense.mileageHigher.title'),
        t('addExpense.mileageHigher.message', {
          mileage: mileageNum.toLocaleString(),
          current: currentMileage.toLocaleString(),
          mileage2: mileageNum.toLocaleString(),
        }),
        [
          { text: t('addExpense.mileageHigher.no'), style: 'cancel', onPress: () => saveExpense(false) },
          { text: t('addExpense.mileageHigher.yes'), onPress: () => saveExpense(true) },
        ]
      )
      return
    }

    saveExpense(false)
  }

  const saveExpense = async (updateVehicleMileage: boolean) => {
    const isoDate = parseDate(date)!
    const renewalExpiryISO = renewalExpiry.trim() ? parseMMYYYY(renewalExpiry.trim()) : null
    const mileageNum = mileage ? parseInt(mileage) : null

    setLoading(true)
    try {
      await api.addExpense(token, vehicleId, {
        date: isoDate,
        category,
        amount: parseFloat(amount),
        description: description.trim() || undefined,
        mileage: mileageNum ?? undefined,
        notes: notes.trim() || undefined,
      })

      if (updateVehicleMileage && mileageNum != null) {
        await api.updateMileage(token, vehicleId, mileageNum)
      }

      if (renewalExpiryISO && category === 'Revenue Licence') {
        await api.updateVehicleExpiry(token, vehicleId, { revenueLicenceExpiry: renewalExpiryISO })
      }
      if (renewalExpiryISO && category === 'Insurance') {
        await api.updateVehicleExpiry(token, vehicleId, {
          insuranceExpiry: renewalExpiryISO,
          insuranceCompany: insuranceCompany.trim() || null,
          insurancePolicyNo: insurancePolicyNo.trim() || null,
        })
      }

      onExpenseAdded()
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title={t('addExpense.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t('addExpense.subtitle')}</Text>

      <Text style={styles.label}>{t('addExpense.category')}</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.categoryCard, category === cat.value && styles.categoryCardSelected]}
            onPress={() => setCategory(cat.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, category === cat.value && styles.categoryLabelSelected]}>
              {t(cat.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FormField
        label={t('addExpense.amount')}
        required
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="e.g. 45000"
      />

      <FormField
        label={t('addExpense.description')}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Annual insurance renewal — Union Assurance"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <DateField label={t('common.date')} value={date} onChange={setDate} maximumDate={new Date()} />
        </View>
        <View style={styles.half}>
          <FormField
            label={t('addExpense.mileage')}
            value={mileage}
            onChangeText={setMileage}
            keyboardType="number-pad"
            placeholder={t('addExpense.mileageOptional')}
          />
        </View>
      </View>

      <FormField
        label={t('addExpense.notes')}
        style={styles.multiline}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('addExpense.notesPlaceholder')}
        multiline
        numberOfLines={2}
      />

      {/* Renewal reminder — shown for Revenue Licence */}
      {category === 'Revenue Licence' && (
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>{t('addExpense.setRenewalReminder')}</Text>
          <Text style={styles.reminderSub}>{t('addExpense.reminderSub')}</Text>
          <FormField
            label={t('addExpense.nextRenewalDate')}
            value={renewalExpiry}
            onChangeText={setRenewalExpiry}
            placeholder="e.g. 06/2026"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      )}

      {/* Insurance details — shown for Insurance */}
      {category === 'Insurance' && (
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>{t('addExpense.insuranceDetails')}</Text>
          <Text style={styles.reminderSub}>{t('addExpense.reminderSub')}</Text>
          <FormField
            label={t('addExpense.policyExpiryDate')}
            value={renewalExpiry}
            onChangeText={setRenewalExpiry}
            placeholder="e.g. 12/2026"
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label={t('addExpense.insuranceCompany')}
            value={insuranceCompany}
            onChangeText={setInsuranceCompany}
            placeholder="e.g. Union Assurance, AIA, Ceylinco"
          />
          <FormField
            label={t('addExpense.policyNumber')}
            value={insurancePolicyNo}
            onChangeText={setInsurancePolicyNo}
            placeholder="e.g. UA-2024-0012345"
          />
        </View>
      )}

      <Button title={t('addExpense.saveExpense')} onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 24 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 10, marginTop: 20 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    categoryCard: {
      width: '30%', backgroundColor: c.surface, borderRadius: 12,
      padding: 14, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid,
    },
    categoryCardSelected: { backgroundColor: c.primary, borderColor: c.primary },
    categoryIcon: { fontSize: 24, marginBottom: 6 },
    categoryLabel: { fontSize: 11, color: c.textSub, fontWeight: '600', textAlign: 'center' },
    categoryLabelSelected: { color: '#fff' },
    multiline: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    reminderCard: {
      backgroundColor: c.primaryTint, borderRadius: 14, padding: 16,
      marginTop: 20, marginBottom: 20, borderWidth: 1, borderColor: c.primaryTintText + '44',
    },
    reminderTitle: { fontSize: 15, fontWeight: '700', color: c.primaryTintText, marginBottom: 4 },
    reminderSub: { fontSize: 12, color: c.textSub, marginBottom: 4 },
  })
}
