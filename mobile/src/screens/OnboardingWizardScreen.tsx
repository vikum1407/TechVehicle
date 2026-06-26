import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

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

type Milestone = {
  id: string
  label: string
  question: string
  serviceCategory: string
  icon: string
}

const MILESTONES: Milestone[] = [
  {
    id: 'oil',
    icon: '🛢️',
    label: 'Engine Oil Change',
    question: 'When did you last change your engine oil?',
    serviceCategory: 'Oil & Filter Change',
  },
  {
    id: 'timing',
    icon: '⚙️',
    label: 'Timing Belt / Cam Belt',
    question: 'Has your timing belt or cam belt ever been replaced?',
    serviceCategory: 'Timing Belt / Chain',
  },
  {
    id: 'brakes',
    icon: '🛑',
    label: 'Brake Pads',
    question: 'When were your brake pads last replaced?',
    serviceCategory: 'Brake Pads',
  },
  {
    id: 'battery',
    icon: '🔋',
    label: 'Battery',
    question: 'Has your battery been replaced?',
    serviceCategory: 'Battery',
  },
  {
    id: 'chain',
    icon: '⛓️',
    label: 'Chain & Sprocket',
    question: 'When was your chain and sprocket last replaced?',
    serviceCategory: 'Chain & Sprocket',
  },
  {
    id: 'hydraulic',
    icon: '💧',
    label: 'Hydraulic Oil',
    question: 'When was the hydraulic oil last changed?',
    serviceCategory: 'Hydraulic Oil',
  },
]

// Which vehicle types each milestone applies to (null = all types / no type set)
const MILESTONE_VISIBLE_FOR: Record<string, string[]> = {
  oil:       ['motorcycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy'],
  timing:    ['car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck'],
  brakes:    ['motorcycle', 'electric-cycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy', 'electric'],
  battery:   ['motorcycle', 'electric-cycle', 'three-wheeler', 'car-petrol', 'car-diesel', 'suv-petrol', 'suv-diesel', 'van', 'pickup', 'truck', 'heavy', 'electric'],
  chain:     ['motorcycle', 'electric-cycle', 'three-wheeler'],
  hydraulic: ['heavy', 'truck'],
}

type MilestoneState = {
  added: boolean   // user said yes
  year: string     // approximate year e.g. "2022"
  mileage: string  // approximate mileage
}

const emptyState = (): MilestoneState => ({ added: false, year: '', mileage: '' })

export default function OnboardingWizardScreen({ token, vehicle, onDone }: Props) {
  const [states, setStates] = useState<Record<string, MilestoneState>>(
    Object.fromEntries(MILESTONES.map(m => [m.id, emptyState()]))
  )
  const [saving, setSaving] = useState(false)

  // Filter milestones to those relevant for this vehicle type
  const visibleMilestones = vehicle.vehicleType
    ? MILESTONES.filter(m => MILESTONE_VISIBLE_FOR[m.id]?.includes(vehicle.vehicleType!))
    : MILESTONES

  const toggle = (id: string) => {
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], added: !prev[id].added },
    }))
  }

  const update = (id: string, field: 'year' | 'mileage', value: string) => {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSave = async () => {
    const toSave = visibleMilestones.filter(m => states[m.id].added)

    if (toSave.length === 0) {
      onDone()
      return
    }

    setSaving(true)
    try {
      await Promise.all(toSave.map(async (m) => {
        const s = states[m.id]
        const yearNum = parseInt(s.year)
        const isoDate = (!isNaN(yearNum) && yearNum >= 1990)
          ? new Date(`${yearNum}-01-01`).toISOString()
          : new Date().toISOString()

        await api.addServiceRecord(token, vehicle.id, {
          date: isoDate,
          description: m.serviceCategory,
          mileage: s.mileage.trim() ? parseInt(s.mileage) : undefined,
          notes: 'Added from setup wizard (historical record)',
        })
      }))
      onDone()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save records.')
    } finally {
      setSaving(false)
    }
  }

  const addedCount = visibleMilestones.filter(m => states[m.id].added).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Set Up Your History</Text>
        <Text style={styles.subtitle}>
          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.registrationNo}
        </Text>
        <Text style={styles.intro}>
          Add what you know about this vehicle's past services. All fields are approximate — skip anything you're unsure about.
        </Text>
      </View>

      {visibleMilestones.map((m) => {
        const s = states[m.id]
        return (
          <View key={m.id} style={[styles.card, s.added && styles.cardActive]}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => toggle(m.id)} activeOpacity={0.7}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{m.icon}</Text>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardLabel}>{m.label}</Text>
                  <Text style={styles.cardQuestion}>{m.question}</Text>
                </View>
              </View>
              <View style={[styles.toggle, s.added && styles.toggleActive]}>
                <Text style={[styles.toggleText, s.added && styles.toggleTextActive]}>
                  {s.added ? 'Yes ✓' : '+ Add'}
                </Text>
              </View>
            </TouchableOpacity>

            {s.added && (
              <View style={styles.cardFields}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Approximate year</Text>
                    <TextInput
                      style={styles.input}
                      value={s.year}
                      onChangeText={v => update(m.id, 'year', v)}
                      placeholder="e.g. 2022"
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Mileage at the time (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={s.mileage}
                      onChangeText={v => update(m.id, 'mileage', v)}
                      placeholder="e.g. 40000"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Text style={styles.fieldHint}>Both fields are optional — leave blank if unsure</Text>
              </View>
            )}
          </View>
        )
      })}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>
              {addedCount > 0
                ? `Save ${addedCount} Record${addedCount > 1 ? 's' : ''} & Go to Dashboard`
                : 'Nothing to Add — Go to Dashboard'
              }
            </Text>
        }
      </TouchableOpacity>

      <Text style={styles.footer}>
        You can always add more history from the vehicle dashboard at any time.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 48 },
  header: { marginTop: 52, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#1a73e8', fontWeight: '600', marginBottom: 12 },
  intro: { fontSize: 14, color: '#666', lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 12, borderWidth: 1.5, borderColor: '#e8e8e8',
    overflow: 'hidden',
  },
  cardActive: { borderColor: '#1a73e8', backgroundColor: '#fafcff' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 16,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12, marginRight: 12 },
  cardIcon: { fontSize: 26, marginTop: 2 },
  cardTextWrap: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  cardQuestion: { fontSize: 13, color: '#666', lineHeight: 18 },
  toggle: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#ccc', backgroundColor: '#f5f5f5',
    minWidth: 70, alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  toggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  cardFields: {
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: '#e8f0fe',
    backgroundColor: '#f0f6ff',
  },
  fieldRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#dde4f0',
  },
  fieldHint: { fontSize: 11, color: '#aaa', marginTop: 8 },
  saveBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 16 },
})
