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
import AppIcon, { AppIconSpec } from '../components/AppIcon'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  vehicleId: string
  currentMileage: number
  onExpenseAdded: (newMileage?: number) => void
  onBack: () => void
}

const CATEGORIES: { value: string; labelKey: TranslationKey; icon: AppIconSpec; color: string; descPlaceholder: string }[] = [
  { value: 'Fine / Penalty', labelKey: 'expenseCategory.fine', icon: { lib: 'ion', name: 'warning' }, color: '#ef4444', descPlaceholder: 'e.g. Speeding fine' },
  { value: 'Parking', labelKey: 'expenseCategory.parking', icon: { lib: 'material', name: 'local-parking' }, color: '#6366f1', descPlaceholder: 'e.g. Mall parking' },
  { value: 'Toll', labelKey: 'expenseCategory.toll', icon: { lib: 'mci', name: 'highway' }, color: '#f97316', descPlaceholder: 'e.g. Southern Expressway toll' },
  { value: 'Accessories', labelKey: 'expenseCategory.accessories', icon: { lib: 'ion', name: 'build' }, color: '#64748b', descPlaceholder: 'e.g. Seat covers' },
  { value: 'Washing', labelKey: 'expenseCategory.washing', icon: { lib: 'ion', name: 'water' }, color: '#0ea5e9', descPlaceholder: 'e.g. Full wash and wax' },
  { value: 'Other', labelKey: 'expenseCategory.other', icon: { lib: 'ion', name: 'create-outline' }, color: '#6b7280', descPlaceholder: 'e.g. Roadside assistance' },
]

const DEFAULT_DESC_PLACEHOLDER = 'e.g. Speeding fine'

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

export default function AddExpenseScreen({ token, vehicleId, currentMileage, onExpenseAdded, onBack }: Props) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState(String(currentMileage))
  const [notes, setNotes] = useState('')
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

      const newMileage = updateVehicleMileage && mileageNum != null ? mileageNum : undefined
      setCategory(''); setAmount(''); setDescription(''); setDate(today())
      setMileage(String(newMileage ?? currentMileage)); setNotes('')
      onExpenseAdded(newMileage)
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
            <View style={styles.categoryIcon}>
              <AppIcon icon={cat.icon} color={category === cat.value ? '#fff' : cat.color} size={24} />
            </View>
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
        placeholder={CATEGORIES.find(c => c.value === category)?.descPlaceholder ?? DEFAULT_DESC_PLACEHOLDER}
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
    categoryIcon: { marginBottom: 6 },
    categoryLabel: { fontSize: 11, color: c.textSub, fontWeight: '600', textAlign: 'center' },
    categoryLabelSelected: { color: '#fff' },
    multiline: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
  })
}
