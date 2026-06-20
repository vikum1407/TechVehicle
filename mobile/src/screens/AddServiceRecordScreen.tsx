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

// Labour/service items — no physical part replaced, no brand needed
const NO_BRAND_ITEMS = new Set([
  'Wheel Alignment', 'Wheel Balancing', 'Tyre Rotation', 'Tyre Puncture Repair', 'Spare Tyre Check',
  'Inspection', 'Wash & Polish', 'Full Service', 'General Repair', 'Modification',
  'Handbrake Adjustment', 'Body Work', 'Dent Repair', 'Paint Job',
  'Seat / Upholstery', 'Dashboard Repair', 'Audio System',
  'Injector Clean', 'Throttle Body Clean', 'Fuel System Clean',
  'Engine Flush', 'Radiator Service', 'Valve Service',
  'Transmission Service', 'AC Service', 'Turbo Service', 'Intercooler Service',
  'Engine Rebuild', 'Gearbox Overhaul', 'Wiring Repair',
  'Exhaust Service', 'Muffler Repair',
  'Parking Lights', 'Interior Lights', 'Fuses',
])

// Per-item brand lists — overrides category-level mapping for accuracy
const ITEM_BRANDS: Record<string, string[]> = {
  // Engine oils
  'Oil Change':              ['Castrol', 'Mobil 1', 'Shell', 'Total', 'Motul', 'Valvoline'],
  // Filters
  'Oil Filter':              ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'Air Filter':              ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann', 'K&N'],
  'Fuel Filter':             ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'AC Filter':               ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  'Cabin Filter':            ['Denso', 'Toyota OEM', 'Honda OEM', 'Bosch', 'Mann'],
  // Ignition
  'Spark Plugs':             ['NGK', 'Denso', 'Bosch', 'Champion'],
  'Glow Plugs (Diesel)':     ['NGK', 'Denso', 'Bosch'],
  // Drive train — belts & chain
  'Timing Belt':             ['Gates', 'Dayco', 'Bando', 'Continental', 'Toyota OEM', 'Honda OEM'],
  'Timing Belt Kit':         ['Gates', 'Dayco', 'INA', 'Toyota OEM', 'Honda OEM'],
  'Timing Chain':            ['Toyota OEM', 'Honda OEM', 'Genuine Parts'],
  'Drive Belts':             ['Gates', 'Dayco', 'Bando', 'Continental', 'Toyota OEM', 'Honda OEM'],
  'AC Belt':                 ['Gates', 'Dayco', 'Bando', 'Toyota OEM', 'Honda OEM'],
  // Cooling system parts
  'Water Pump':              ['Toyota OEM', 'Honda OEM', 'GMB', 'Aisin', 'Denso'],
  'Thermostat':              ['Toyota OEM', 'Honda OEM', 'Aisin', 'Gates'],
  'Radiator Cap':            ['Toyota OEM', 'Honda OEM', 'Aisin'],
  'Coolant Flush':           ['Toyota OEM', 'Honda OEM', 'Prestone', 'Peak'],
  'Cooling Fan':             ['Denso', 'Toyota OEM', 'Honda OEM'],
  // Engine internals
  'Head Gasket':             ['Toyota OEM', 'Honda OEM', 'Victor Reinz', 'Cometic'],
  // Brakes
  'Brake Pads (Front)':      ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'TRW'],
  'Brake Pads (Rear)':       ['Bosch', 'Brembo', 'Akebono', 'Nisshinbo', 'Toyota OEM', 'TRW'],
  'Brake Discs (Front)':     ['Bosch', 'Brembo', 'DBA', 'Toyota OEM', 'Honda OEM'],
  'Brake Discs (Rear)':      ['Bosch', 'Brembo', 'DBA', 'Toyota OEM', 'Honda OEM'],
  'Brake Drums':             ['Toyota OEM', 'Honda OEM', 'Bosch', 'ATE'],
  'Brake Fluid':             ['Toyota OEM', 'Honda OEM', 'Castrol', 'Bosch', 'ATE', 'Motul'],
  'Brake Caliper':           ['Toyota OEM', 'Honda OEM', 'TRW', 'ATE'],
  'Brake Hoses':             ['Toyota OEM', 'Honda OEM', 'Goodridge'],
  'Brake Master Cylinder':   ['Toyota OEM', 'Honda OEM', 'ATE'],
  'Handbrake Cable':         ['Toyota OEM', 'Honda OEM'],
  // Transmission
  'Gear Oil (Manual)':       ['Castrol', 'Mobil', 'Shell', 'Total', 'Toyota OEM', 'Honda OEM'],
  'Transmission Oil (Auto)': ['Toyota OEM', 'Honda OEM', 'Aisin', 'Castrol', 'Mobil'],
  'Clutch Plate':            ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM'],
  'Clutch Kit':              ['Exedy', 'LUK', 'Sachs', 'Toyota OEM', 'Honda OEM'],
  'Pressure Plate':          ['Exedy', 'LUK', 'Sachs', 'Toyota OEM'],
  'Clutch Bearing':          ['Exedy', 'LUK', 'NSK', 'Toyota OEM'],
  'CV Joint':                ['Toyota OEM', 'Honda OEM', 'GKN', 'GSP'],
  'CV Boot':                 ['Toyota OEM', 'Honda OEM', 'GKN'],
  'Drive Shaft':             ['Toyota OEM', 'Honda OEM', 'GKN', 'GSP'],
  'Differential Oil':        ['Castrol', 'Shell', 'Mobil', 'Toyota OEM', 'Honda OEM'],
  'Transfer Case Oil':       ['Toyota OEM', 'Honda OEM', 'Castrol', 'Shell'],
  // Suspension
  'Shock Absorbers (Front)': ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Toyota OEM'],
  'Shock Absorbers (Rear)':  ['KYB', 'Gabriel', 'Monroe', 'Bilstein', 'Toyota OEM'],
  'Springs (Front)':         ['Toyota OEM', 'Honda OEM', 'Eibach', 'KYB'],
  'Springs (Rear)':          ['Toyota OEM', 'Honda OEM', 'Eibach', 'KYB'],
  'Ball Joints':             ['Toyota OEM', 'Honda OEM', 'Moog', 'Delphi', 'TRW'],
  'Tie Rod Ends':            ['Toyota OEM', 'Honda OEM', 'Moog', 'Delphi', 'TRW'],
  'Wheel Bearings':          ['NSK', 'SKF', 'NTN', 'Koyo', 'FAG', 'Toyota OEM', 'Honda OEM'],
  'Bush Replacement':        ['Toyota OEM', 'Honda OEM', 'Lemforder', 'Meyle'],
  'Sway Bar Links':          ['Toyota OEM', 'Honda OEM', 'Moog', 'Meyle'],
  'Power Steering Fluid':    ['Toyota OEM', 'Honda OEM', 'Castrol', 'Aisin'],
  'Power Steering Pump':     ['Toyota OEM', 'Honda OEM', 'Aisin', 'Bosch'],
  'Steering Rack':           ['Toyota OEM', 'Honda OEM', 'Aisin'],
  // Tyres
  'Tyre Change':             ['Michelin', 'Bridgestone', 'Yokohama', 'Apollo', 'CEAT', 'MRF', 'Dunlop', 'Goodyear'],
  'Wheel Nuts & Bolts':      ['Toyota OEM', 'Honda OEM', 'McGard'],
  // Electrical — specific per component
  'Battery':                 ['Amaron', 'Exide', 'Bosch', 'Panasonic', 'GS Battery', 'Varta', 'Motolite'],
  'Alternator':              ['Denso', 'Bosch', 'Mitsubishi', 'Toyota OEM', 'Honda OEM'],
  'Starter Motor':           ['Denso', 'Bosch', 'Toyota OEM', 'Honda OEM'],
  'Headlights':              ['Philips', 'Osram', 'Bosch', 'Toyota OEM', 'Honda OEM'],
  'Tail Lights':             ['Philips', 'Osram', 'Toyota OEM', 'Honda OEM'],
  'Indicators':              ['Philips', 'Osram', 'Toyota OEM', 'Honda OEM'],
  'Horn':                    ['Bosch', 'Hella', 'Mitsuba', 'Denso', 'Toyota OEM'],
  'Sensors':                 ['Denso', 'Bosch', 'NTK', 'Toyota OEM', 'Honda OEM'],
  // AC components
  'AC Gas Refill':           ['R134a', 'R1234yf', 'R22 (old)'],
  'AC Compressor':           ['Denso', 'Sanden', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  'AC Condenser':            ['Denso', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  'AC Evaporator':           ['Denso', 'Toyota OEM', 'Honda OEM', 'Delphi'],
  // Body & Exterior
  'Windscreen':              ['Pilkington', 'AGC', 'Saint-Gobain', 'Toyota OEM', 'Honda OEM'],
  'Wiper Blades':            ['Bosch', 'Denso', 'Piaa', 'Toyota OEM', 'Honda OEM'],
  'Door Handles':            ['Toyota OEM', 'Honda OEM'],
  'Mirrors':                 ['Toyota OEM', 'Honda OEM'],
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
      'Differential Oil', 'Transfer Case Oil', 'Gearbox Overhaul',
    ],
  },
  {
    title: 'Steering & Suspension',
    items: [
      'Shock Absorbers (Front)', 'Shock Absorbers (Rear)',
      'Springs (Front)', 'Springs (Rear)',
      'Ball Joints', 'Tie Rod Ends', 'Wheel Bearings',
      'Bush Replacement', 'Sway Bar Links',
      'Power Steering Fluid', 'Power Steering Pump', 'Steering Rack',
    ],
  },
  {
    title: 'Tyres & Wheels',
    items: [
      'Tyre Change', 'Tyre Puncture Repair',
      'Wheel Alignment', 'Wheel Balancing',
      'Tyre Rotation', 'Spare Tyre Check', 'Wheel Nuts & Bolts',
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
  'Body & Exterior': ['3M', 'Toyota OEM', 'Honda OEM'],
  'General & Other': ['Toyota OEM', 'Honda OEM', 'Genuine Parts'],
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
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand } : i))
    setCustomBrands(prev => ({ ...prev, [itemName]: '' }))
  }

  const setCustomBrandForItem = (itemName: string, value: string) => {
    setCustomBrands(prev => ({ ...prev, [itemName]: value }))
    setSelectedItems(prev => prev.map(i => i.name === itemName ? { ...i, brand: value } : i))
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
    const extras = otherText.trim()
      ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }]
      : []
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

  // Only items where a physical part is replaced need brand selection
  const itemsNeedingBrand = selectedItems.filter(i => !NO_BRAND_ITEMS.has(i.name))

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

      {itemsNeedingBrand.length > 0 && (
        <View style={styles.brandsSection}>
          <Text style={styles.brandsSectionTitle}>Parts Brand (optional)</Text>
          <Text style={styles.brandsSectionSub}>Select brand for each replaced part</Text>

          {itemsNeedingBrand.map(item => {
            const brands = ITEM_BRANDS[item.name] || CATEGORY_BRANDS[item.category] || CATEGORY_BRANDS['General & Other']
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
          <Text style={styles.summaryLabel}>{selectedItems.length} service{selectedItems.length > 1 ? 's' : ''} selected</Text>
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
  brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 2 },
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
