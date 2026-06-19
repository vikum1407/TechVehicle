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

type Props = {
  token: string
  phoneNumber: string
  onAddVehicle: () => void
  onLogout: () => void
}

export default function MyVehiclesScreen({ token, phoneNumber, onAddVehicle, onLogout }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  const loadVehicles = async () => {
    setLoading(true)
    try {
      const data = await api.getVehicles(token)
      setVehicles(data)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVehicles() }, [])

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity style={styles.card}>
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
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
      ) : vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No vehicles yet</Text>
          <Text style={styles.emptySubtitle}>Add your first vehicle to get started</Text>
          <TouchableOpacity style={styles.addButton} onPress={onAddVehicle}>
            <Text style={styles.addButtonText}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={item => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <TouchableOpacity style={styles.addButton} onPress={onAddVehicle}>
              <Text style={styles.addButtonText}>+ Add Vehicle</Text>
            </TouchableOpacity>
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
  logout: { fontSize: 14, color: '#888' },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', marginBottom: 32, textAlign: 'center' },
  list: { padding: 16 },
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
})
