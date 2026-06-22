import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, ScrollView
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

type IncomingTransfer = {
  id: string
  sellerPhone: string
  createdAt: string
  vehicle: {
    id: string
    registrationNo: string
    make: string
    model: string
    year: number
    fuelType: string
    mileage: number
    _count: { serviceRecords: number; fuelLogs: number; expenses: number }
  }
}

type Props = {
  token: string
  phoneNumber: string
  onAddVehicle: () => void
  onSelectVehicle: (vehicle: Vehicle) => void
  onLogout: () => void
  onGarage: () => void
}

export default function MyVehiclesScreen({ token, phoneNumber, onAddVehicle, onSelectVehicle, onLogout, onGarage }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [incomingTransfers, setIncomingTransfers] = useState<IncomingTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [vehicleData, transferData] = await Promise.all([
        api.getVehicles(token),
        api.getIncomingTransfers(token),
      ])
      setVehicles(vehicleData)
      setIncomingTransfers(transferData)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleAcceptTransfer = async (transfer: IncomingTransfer) => {
    Alert.alert(
      'Accept Vehicle Transfer',
      `Accept ${transfer.vehicle.registrationNo} (${transfer.vehicle.year} ${transfer.vehicle.make} ${transfer.vehicle.model}) from ${transfer.sellerPhone}?\n\nAll service history will be added to your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAccepting(transfer.id)
            try {
              await api.acceptTransfer(token, transfer.id)
              await loadAll()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setAccepting(null)
            }
          },
        },
      ]
    )
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity style={styles.card} onPress={() => onSelectVehicle(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.regNo}>{item.registrationNo}</Text>
        <Text style={styles.fuelType}>{item.fuelType}</Text>
      </View>
      <Text style={styles.vehicleName}>{item.year} {item.make} {item.model}</Text>
      <Text style={styles.mileage}>{item.mileage.toLocaleString()} km</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>TechVehicle</Text>
          <Text style={styles.phone}>{phoneNumber}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.garageBtn} onPress={onGarage}>
            <Text style={styles.garageBtnText}>🏪 Garage</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={item => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.list}
          onRefresh={loadAll}
          refreshing={loading}
          ListHeaderComponent={
            <>
              {/* Incoming transfers */}
              {incomingTransfers.length > 0 && (
                <View style={styles.transfersSection}>
                  <Text style={styles.transfersSectionTitle}>
                    Incoming Vehicle Transfers ({incomingTransfers.length})
                  </Text>
                  {incomingTransfers.map(transfer => (
                    <View key={transfer.id} style={styles.transferCard}>
                      <View style={styles.transferCardTop}>
                        <View>
                          <Text style={styles.transferReg}>{transfer.vehicle.registrationNo}</Text>
                          <Text style={styles.transferVehicle}>
                            {transfer.vehicle.year} {transfer.vehicle.make} {transfer.vehicle.model}
                          </Text>
                          <Text style={styles.transferMeta}>
                            {transfer.vehicle.mileage.toLocaleString()} km · {transfer.vehicle.fuelType}
                          </Text>
                        </View>
                        <View style={styles.transferCounts}>
                          <Text style={styles.transferCountItem}>🔧 {transfer.vehicle._count.serviceRecords}</Text>
                          <Text style={styles.transferCountItem}>⛽ {transfer.vehicle._count.fuelLogs}</Text>
                          <Text style={styles.transferCountItem}>💰 {transfer.vehicle._count.expenses}</Text>
                        </View>
                      </View>
                      <Text style={styles.transferFrom}>From {transfer.sellerPhone} · {formatDate(transfer.createdAt)}</Text>
                      <TouchableOpacity
                        style={[styles.acceptBtn, accepting === transfer.id && styles.acceptBtnDisabled]}
                        onPress={() => handleAcceptTransfer(transfer)}
                        disabled={accepting === transfer.id}
                      >
                        {accepting === transfer.id
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.acceptBtnText}>Accept Transfer</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.addButton} onPress={onAddVehicle}>
                <Text style={styles.addButtonText}>+ Add Vehicle</Text>
              </TouchableOpacity>
            </>
          }
          ListEmptyComponent={
            incomingTransfers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No vehicles yet</Text>
                <Text style={styles.emptySubtitle}>Add your first vehicle to get started</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  logo: { fontSize: 20, fontWeight: '700', color: '#1a73e8' },
  phone: { fontSize: 12, color: '#888', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  garageBtn: {
    backgroundColor: '#e8f0fe', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  garageBtnText: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  logout: { fontSize: 14, color: '#888' },
  loader: { flex: 1 },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', marginBottom: 32, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  regNo: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  fuelType: { fontSize: 12, color: '#1a73e8', fontWeight: '600' },
  vehicleName: { fontSize: 14, color: '#555', marginBottom: 4 },
  mileage: { fontSize: 13, color: '#888' },
  addButton: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  transfersSection: { marginBottom: 16 },
  transfersSectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#1a73e8',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  transferCard: {
    backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16,
    marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#1a73e8',
  },
  transferCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  transferReg: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  transferVehicle: { fontSize: 13, color: '#555', marginBottom: 2 },
  transferMeta: { fontSize: 12, color: '#888' },
  transferCounts: { alignItems: 'flex-end', gap: 4 },
  transferCountItem: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  transferFrom: { fontSize: 12, color: '#888', marginBottom: 12 },
  acceptBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
