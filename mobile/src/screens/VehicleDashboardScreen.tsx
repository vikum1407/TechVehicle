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
}

export default function VehicleDashboardScreen({ token, vehicle, onBack, onAddRecord }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)

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

  const renderRecord = ({ item }: { item: ServiceRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
        {item.cost != null && (
          <Text style={styles.recordCost}>LKR {item.cost.toLocaleString()}</Text>
        )}
      </View>
      <Text style={styles.recordDesc}>{item.description}</Text>
      {item.mileage != null && (
        <Text style={styles.recordMeta}>{item.mileage.toLocaleString()} km</Text>
      )}
      {item.parts && (
        <Text style={styles.recordMeta}>
          Parts: {item.parts}{item.brand ? ` (${item.brand})` : ''}
        </Text>
      )}
      {item.notes && <Text style={styles.recordNotes}>{item.notes}</Text>}
    </View>
  )

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
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Service History</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAddRecord}>
          <Text style={styles.addBtnText}>+ Add Record</Text>
        </TouchableOpacity>
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
    backgroundColor: '#1a73e8', margin: 16, borderRadius: 14,
    padding: 20,
  },
  vehicleName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  vehicleRow: { flexDirection: 'row', gap: 16 },
  vehicleDetail: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#888', textAlign: 'center' },
  list: { padding: 16 },
  recordCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recordDate: { fontSize: 12, color: '#888', fontWeight: '600' },
  recordCost: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  recordDesc: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  recordMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  recordNotes: { fontSize: 12, color: '#aaa', marginTop: 4, fontStyle: 'italic' },
})
