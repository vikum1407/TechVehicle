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

type Props = {
  token: string
  vehicleId: string
  currentMileage: number
  onExpenseAdded: () => void
  onBack: () => void
}

const CATEGORIES = [
  { label: 'Insurance', icon: '🛡️' },
  { label: 'Revenue Licence', icon: '📋' },
  { label: 'Emission Test', icon: '💨' },
  { label: 'Fine / Penalty', icon: '🚨' },
  { label: 'Parking', icon: '🅿️' },
  { label: 'Toll', icon: '🛣️' },
  { label: 'Accessories', icon: '🔩' },
  { label: 'Washing', icon: '🚿' },
  { label: 'Other', icon: '📝' },
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

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Select category', 'Please select an expense category.')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter amount', 'Please enter the expense amount.')
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter date as DD/MM/YYYY.')
      return
    }
    if (renewalExpiry.trim() && !parseMMYYYY(renewalExpiry.trim())) {
      Alert.alert('Invalid expiry date', 'Use MM/YYYY format (e.g. 06/2026)')
      return
    }

    const mileageNum = mileage ? parseInt(mileage) : null
    if (mileageNum != null && mileageNum > currentMileage) {
      Alert.alert(
        'Mileage higher than current',
        `You entered ${mileageNum.toLocaleString()} km, which is higher than the vehicle's current mileage of ${currentMileage.toLocaleString()} km. Update the vehicle's mileage to ${mileageNum.toLocaleString()} km?`,
        [
          { text: 'No, just save expense', style: 'cancel', onPress: () => saveExpense(false) },
          { text: 'Yes, update mileage', onPress: () => saveExpense(true) },
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
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <ScreenHeader title="Add Expense" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Track all vehicle-related costs</Text>

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.categoryCard, category === cat.label && styles.categoryCardSelected]}
            onPress={() => setCategory(cat.label)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, category === cat.label && styles.categoryLabelSelected]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FormField
        label="Amount (LKR)"
        required
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="e.g. 45000"
      />

      <FormField
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Annual insurance renewal — Union Assurance"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
        </View>
        <View style={styles.half}>
          <FormField
            label="Mileage (km)"
            value={mileage}
            onChangeText={setMileage}
            keyboardType="number-pad"
            placeholder="optional"
          />
        </View>
      </View>

      <FormField
        label="Notes (optional)"
        style={styles.multiline}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        multiline
        numberOfLines={2}
      />

      {/* Renewal reminder — shown for Revenue Licence */}
      {category === 'Revenue Licence' && (
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>Set Renewal Reminder</Text>
          <Text style={styles.reminderSub}>We'll remind you 1 month before expiry, every 3 days until renewed.</Text>
          <FormField
            label="Next Renewal Date (MM/YYYY)"
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
          <Text style={styles.reminderTitle}>Insurance Details</Text>
          <Text style={styles.reminderSub}>We'll remind you 1 month before expiry, every 3 days until renewed.</Text>
          <FormField
            label="Policy Expiry Date (MM/YYYY)"
            value={renewalExpiry}
            onChangeText={setRenewalExpiry}
            placeholder="e.g. 12/2026"
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label="Insurance Company (optional)"
            value={insuranceCompany}
            onChangeText={setInsuranceCompany}
            placeholder="e.g. Union Assurance, AIA, Ceylinco"
          />
          <FormField
            label="Policy Number (optional)"
            value={insurancePolicyNo}
            onChangeText={setInsurancePolicyNo}
            placeholder="e.g. UA-2024-0012345"
          />
        </View>
      )}

      <Button title="Save Expense" onPress={handleSubmit} loading={loading} />
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
