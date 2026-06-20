import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  token: string
  vehicleId: string
  onRecordAdded: () => void
  onBack: () => void
}

type SelectedItem = {
  name: string
  category: string
  brand: string
}

const SERVICE_CATEGORIES = [
  {
    title: 'Engine & Oil',
    items: [
      'Oil Change', 'Oil Filter', 'Air Filter', 'Fuel Filter',
      'Spark Plugs', 'Glow Plugs (Diesel)', 'Timing Belt', 'Timing Belt Kit',
      'Timing Chain', 'Water Pump', 'Thermostat', 'Coolant Flush',
      'Radiator Service', 'Radiator Cap', 'Engine Flush',
      'Fuel System Clean', 'Injector Clean', 'Throttle Body Clean',
      'Turbo Service', 'Intercooler Service', 'Head Gasket',
      'Valve Service', 'Engine Rebuild', 'Drive Belts',
    ],
  },
  {
    title: 'Brakes',
    items: [
      'Brake Pads (Front)', 'Brake Pads (Rear)',
      'Brake Discs (Front)', 'Brake Discs (Rear)',
      'Brake Drums', 'Brake Fluid', 'Brake Caliper',
      'Brake Hoses', 'Brake Master Cylinder',
      'Handbrake Cable', 'Handbrake Adjustment',
    ],
  },
  {
    title: 'Transmission & Drive',
    items: [
      'Gear Oil (Manual)', 'Transmission Oil (Auto)', 'Transmission Service',
      'Clutch Plate', 'Clutch Kit', 'Pressure Plate', 'Clutch Bearing',
      'CV Joint', 'CV Boot', 'Drive Shaft',
      'Differential Oil', 'Transfer Case Oil',
      'Gearbox Overhaul',
    ],
  },
  {
    title: 'Steering & Suspension',
    items: [
      'Shock Absorbers (Front)', 'Shock Absorbers (Rear)',
      'Springs (Front)', 'Springs (Rear)',
      'Ball Joints', 'Tie Rod Ends', 'Wheel Bearings',
      'Bush Replacement', 'Sway Bar Links',
      'Power Steering Fluid', 'Power Steering Pump',
      'Steering Rack',
    ],
  },
  {
    title: 'Tyres & Wheels',
    items: [
      'Tyre Change', 'Tyre Puncture Repair',
      'Wheel Alignment', 'Wheel Balancing', 'Tyre Rotation',
      'Spare Tyre Check', 'Wheel Nuts & Bolts',
    ],
  },
  {
    title: 'Electrical',
    items: [
      'Battery', 'Alternator', 'Starter Motor',
      'Headlights', 'Tail Lights', 'Indicators',
      'Parking Lights', 'Interior Lights', 'Fuses',
      'Horn', 'Wiring Repair', 'Sensors',
    ],
  },
  {
    title: 'AC & Cooling',
    items: [
      'AC Gas Refill', 'AC Service', 'AC Filter',
      'Cabin Filter', 'AC Compressor', 'AC Belt',
      'AC Condenser', 'AC Evaporator', 'Cooling Fan',
    ],
  },
  {
    title: 'Body & Exterior',
    items: [
      'Body Work', 'Dent Repair', 'Paint Job',
      'Windscreen', 'Wiper Blades', 'Door Handles',
      'Mirrors', 'Bumper Repair', 'Wash & Polish',
    ],
  },
  {
    title: 'General & Other',
    items: [
      'Full Service', 'Inspection', 'Exhaust Service',
      'Muffler Repair', 'Seat / Upholstery',
      'Dashboard Repair', 'Audio System',
      'Modification', 'General Repair',
    ],
  },
]

const CATEGORY_BRANDS: Record<string, string[]> = {
  'Engine & Oil': ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline', 'Toyota OEM', 'Honda OEM', 'Denso', 'Bosch', 'NGK', 'Gates'],
  'Brakes': ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'Honda OEM', 'TRW'],
  'Transmission & Drive': ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM', 'Castrol', 'Shell'],
  'Steering & Suspension': ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Tyres & Wheels': ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop'],
  'Electrical': ['Amaron', 'Exide', 'Bosch', 'Panasonic', 'GS Battery', 'Varta', 'Denso'],
  'AC & Cooling': ['Denso', 'Sanden', 'Delphi', 'Toyota OEM', 'Honda OEM'],
  'Body & Exterior': ['3M', 'Toyota OEM', 'Honda OEM', 'Genuine Parts'],
  'General & Other': ['Toyota OEM', 'Honda OEM', 'Genuine Parts', 'Local'],
}

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function AddServiceRecordScreen({ token, vehicleId, onRecordAdded, onBack }: Props) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [otherText, setOtherText] = useState('')
  const [customBrands, setCustomBrands] = useState<Record<string, string>>({})
  const [date, setDate] = useState(today())
  const [mileage, setMileage] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const isSelected = (name: string) => selectedItems.some(i => i.name === name)

  const toggleService = (name: string, category: string) => {
    if (isSelected(name)) {
      setSelectedItems(prev => prev.filter(i => i.name !== name))
    } else {
      setSelectedItems(prev => [...prev, { name, category, brand: '' }])
    }
  }

  const setBrandForItem = (itemName: string, brand: string) => {
    setSelectedItems(prev =>
      prev.map(i => i.name === itemName ? { ...i, brand } : i)
    )
    setCustomBrands(prev => ({ ...prev, [itemName]: '' }))
  }

  const setCustomBrandForItem = (itemName: string, value: string) => {
    setCustomBrands(prev => ({ ...prev, [itemName]: value }))
    setSelectedItems(prev =>
      prev.map(i => i.name === itemName ? { ...i, brand: value } : i)
    )
  }

  const parseDate = (str: string): string | null => {
    const parts = str.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts
    const parsed = new Date(`${y}-${m}-${d}`)
    if (isNaN(parsed.getTime())) return null
    return parsed.toISOString()
  }

  const handleSubmit = async () => {
    const extras = otherText.trim() ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }] : []
    const allItems = [...selectedItems, ...extras]

    if (allItems.length === 0) {
      Alert.alert('Select a service', 'Please tap at least one service done.')
      return
    }
    const isoDate = parseDate(date)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }

    const description = allItems
      .map(i => i.brand ? `${i.name} (${i.brand})` : i.name)
      .join(', ')

    const brands = [...new Set(allItems.map(i => i.brand).filter(Boolean))].join(', ')

    setLoading(true)
    try {
      await api.addServiceRecord(token, vehicleId, {
        date: isoDate,
        description,
        mileage: mileage ? parseInt(mileage) : undefined,
        brand: brands || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
      })
      onRecordAdded()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Add Service Record</Text>
      <Text style={styles.subtitle}>Tap everything that was done</Text>

      {SERVICE_CATEGORIES.map(cat => (
        <View key={cat.title}>
          <Text style={styles.catLabel}>{cat.title}</Text>
          <View style={styles.chipRow}>
            {cat.items.map(item => {
              const sel = isSelected(item)
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => toggleService(item, cat.title)}
                  activeOpacity={0.7}
                >
                  {sel && <Text style={styles.check}>✓ </Text>}
                  <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ))}

      <Text style={styles.catLabel}>Other (not listed above)</Text>
      <TextInput
        style={styles.input}
        value={otherText}
        onChangeText={setOtherText}
        placeholder="Type anything else that was done..."
      />

      {selectedItems.length > 0 && (
        <View style={styles.brandsSection}>
          <Text style={styles.brandsSectionTitle}>Set Brand Per Item (optional)</Text>
          <Text style={styles.brandsSectionSub}>Tap the brand used for each service</Text>

          {selectedItems.map(item => {
            const brands = CATEGORY_BRANDS[item.category] || CATEGORY_BRANDS['General & Other']
            return (
              <View key={item.name} style={styles.brandRow}>
                <Text style={styles.brandItemName}>{item.name}</Text>
                <View style={styles.chipRow}>
                  {brands.map(b => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.brandChip, item.brand === b && styles.brandChipSelected]}
                      onPress={() => setBrandForItem(item.name, b)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.brandChipText, item.brand === b && styles.brandChipTextSelected]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={customBrands[item.name] || ''}
                  onChangeText={v => setCustomBrandForItem(item.name, v)}
                  placeholder="Or type brand..."
                />
              </View>
            )
          })}
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.catLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.catLabel}>Mileage (km)</Text>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text style={styles.catLabel}>Total Cost (LKR)</Text>
      <TextInput
        style={styles.input}
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4500"
        keyboardType="number-pad"
      />

      <Text style={styles.catLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        multiline
        numberOfLines={2}
      />

      {selectedItems.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Summary — {selectedItems.length} service{selectedItems.length > 1 ? 's' : ''} selected</Text>
          {selectedItems.map(i => (
            <Text key={i.name} style={styles.summaryLine}>
              • {i.name}{i.brand ? ` — ${i.brand}` : ''}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save Record</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 56 },
  topRow: { marginTop: 48, marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1.5,
    borderColor: '#ddd', backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  check: { fontSize: 13, color: '#fff' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  brandsSection: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: '#e8f0fe',
  },
  brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 4 },
  brandsSectionSub: { fontSize: 12, color: '#888', marginBottom: 12 },
  brandRow: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingTop: 14, marginTop: 14,
  },
  brandItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  brandChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18, borderWidth: 1.5,
    borderColor: '#e0e0e0', backgroundColor: '#f9f9f9',
  },
  brandChipSelected: { backgroundColor: '#34a853', borderColor: '#34a853' },
  brandChipText: { fontSize: 12, color: '#555' },
  brandChipTextSelected: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  summary: {
    backgroundColor: '#e8f0fe', borderRadius: 12,
    padding: 16, marginTop: 20,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 8 },
  summaryLine: { fontSize: 13, color: '#333', marginBottom: 4, lineHeight: 20 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
