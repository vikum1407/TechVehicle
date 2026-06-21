import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  mileage: number
}

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  parts: string | null
  brand: string | null
  cost: number | null
  notes: string | null
}

type Props = {
  token: string
  vehicle: Vehicle
  onBack: () => void
  onAddRecord: () => void
  onLogFuel: () => void
  onAddExpense: () => void
  onAnalytics: () => void
  onShare: () => void
}

export default function VehicleDashboardScreen({ token, vehicle, onBack, onAddRecord, onLogFuel, onAddExpense, onAnalytics, onShare }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const data = await api.getServiceRecords(token, vehicle.id)
      setRecords(data)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecords() }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const parseServices = (description: string) => {
    return description.split(',').map(s => s.trim()).filter(Boolean)
  }

  const renderRecord = ({ item }: { item: ServiceRecord }) => {
    const isExpanded = expandedId === item.id
    const services = parseServices(item.description)
    const preview = services.slice(0, 2)
    const extra = services.length - 2

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
          {item.cost != null && (
            <Text style={styles.cardCost}>LKR {item.cost.toLocaleString()}</Text>
          )}
        </View>

        {!isExpanded ? (
          // Compact view
          <View>
            <View style={styles.tagRow}>
              {preview.map((s, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>{s}</Text>
                </View>
              ))}
              {extra > 0 && (
                <View style={styles.tagMore}>
                  <Text style={styles.tagMoreText}>+{extra} more</Text>
                </View>
              )}
            </View>
            {item.mileage != null && (
              <Text style={styles.cardMeta}>{item.mileage.toLocaleString()} km</Text>
            )}
          </View>
        ) : (
          // Expanded view
          <View>
            {services.map((s, i) => (
              <Text key={i} style={styles.expandedItem}>• {s}</Text>
            ))}
            {item.mileage != null && (
              <Text style={styles.cardMeta}>{item.mileage.toLocaleString()} km</Text>
            )}
            {item.notes && (
              <Text style={styles.cardNotes}>{item.notes}</Text>
            )}
            <Text style={styles.collapseHint}>Tap to collapse</Text>
          </View>
        )}

        {!isExpanded && services.length > 2 && (
          <Text style={styles.expandHint}>Tap to see all</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.regNo}>{vehicle.registrationNo}</Text>
      </View>

      <View style={styles.vehicleCard}>
        <Text style={styles.vehicleName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleDetail}>{vehicle.fuelType}</Text>
          <Text style={styles.vehicleDetail}>{vehicle.mileage.toLocaleString()} km</Text>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={onLogFuel}>
            <Text style={styles.quickBtnText}>⛽ Log Fuel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={onAddRecord}>
            <Text style={styles.quickBtnText}>🔧 Add Service</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={onAddExpense}>
            <Text style={styles.quickBtnText}>💰 Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={onAnalytics}>
            <Text style={styles.quickBtnText}>📊 Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Service History</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>🔗 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={onAddRecord}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
      ) : records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No service records yet</Text>
          <Text style={styles.emptySubText}>Tap "+ Add Record" to log your first service</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderRecord}
          contentContainerStyle={styles.list}
          onRefresh={loadRecords}
          refreshing={loading}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 16 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  regNo: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  vehicleCard: {
    backgroundColor: '#1a73e8', margin: 16, borderRadius: 14, padding: 20,
  },
  vehicleName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  vehicleRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  vehicleDetail: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  quickBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  sectionActions: { flexDirection: 'row', gap: 8 },
  shareBtn: {
    backgroundColor: '#e8f0fe', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  shareBtnText: { color: '#1a73e8', fontSize: 13, fontWeight: '700' },
  addBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#888', textAlign: 'center' },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: '#000',
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardDate: { fontSize: 12, color: '#888', fontWeight: '600' },
  cardCost: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: '#f0f4ff', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 200,
  },
  tagText: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  tagMore: {
    backgroundColor: '#e8f0fe', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagMoreText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  cardMeta: { fontSize: 12, color: '#aaa', marginTop: 4 },
  cardNotes: { fontSize: 12, color: '#aaa', marginTop: 6, fontStyle: 'italic' },
  expandHint: { fontSize: 11, color: '#bbb', marginTop: 6 },
  collapseHint: { fontSize: 11, color: '#bbb', marginTop: 8 },
  expandedItem: { fontSize: 13, color: '#333', marginBottom: 4, lineHeight: 20 },
})
