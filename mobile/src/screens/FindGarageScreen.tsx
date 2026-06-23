import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native'
import { api } from '../config/api'

type Vehicle = {
  id: string
  registrationNo: string
  make: string
  model: string
  year: number
  mileage: number
}

type GarageResult = {
  id: string
  name: string
  address: string | null
  verified: boolean
}

type Props = {
  token: string
  vehicles: Vehicle[]
  onBack: () => void
  onBookGarage: (garage: GarageResult, vehicle: Vehicle) => void
}

export default function FindGarageScreen({ token, vehicles, onBack, onBookGarage }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<GarageResult[]>([])
  const [searching, setSearching] = useState(false)

  const [pickingVehicle, setPickingVehicle] = useState<GarageResult | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setResults([])
    try {
      const data = await api.searchGarages(token, searchQuery.trim())
      setResults(data)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSearching(false)
    }
  }

  const handleBook = (garage: GarageResult) => {
    if (vehicles.length === 0) {
      Alert.alert('No Vehicles', 'Add a vehicle first before booking a service appointment.')
      return
    }
    if (vehicles.length === 1) {
      onBookGarage(garage, vehicles[0])
    } else {
      setPickingVehicle(garage)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a Garage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Search Garages</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by garage name..."
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchBtn, searching && styles.btnDisabled]}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Search</Text>
            }
          </TouchableOpacity>
        </View>

        {results.length === 0 && !searching && searchQuery.length > 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No garages found</Text>
            <Text style={styles.emptyText}>Try a different name or check the spelling.</Text>
          </View>
        )}

        {results.length === 0 && searchQuery.length === 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintIcon}>🔍</Text>
            <Text style={styles.hintTitle}>Find a verified garage near you</Text>
            <Text style={styles.hintText}>
              Search for a garage by name to view their profile and book a service appointment.
            </Text>
          </View>
        )}

        {results.map(garage => (
          <View key={garage.id} style={styles.garageCard}>
            <View style={styles.garageInfo}>
              <View style={styles.garageTop}>
                <Text style={styles.garageName}>{garage.name}</Text>
                <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                  <Text style={styles.badgeText}>{garage.verified ? '✅ Verified' : '⚠️ Unverified'}</Text>
                </View>
              </View>
              {garage.address && (
                <Text style={styles.garageAddress}>📍 {garage.address}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => handleBook(garage)}
              activeOpacity={0.8}
            >
              <Text style={styles.bookBtnText}>📅 Book</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Vehicle picker modal (when user has multiple vehicles) */}
      <Modal
        visible={!!pickingVehicle}
        animationType="slide"
        transparent
        onRequestClose={() => setPickingVehicle(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Which vehicle?</Text>
            <Text style={styles.modalSub}>Select the vehicle for this appointment</Text>
            <FlatList
              data={vehicles}
              keyExtractor={v => v.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.vehicleOption}
                  onPress={() => {
                    const garage = pickingVehicle!
                    setPickingVehicle(null)
                    onBookGarage(garage, item)
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleOptionReg}>{item.registrationNo}</Text>
                  <Text style={styles.vehicleOptionName}>
                    {item.year} {item.make} {item.model} · {item.mileage.toLocaleString()} km
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPickingVehicle(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#555',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#ddd',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1a1a1a',
  },
  searchBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },

  hintBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  hintIcon: { fontSize: 48, marginBottom: 16 },
  hintTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' },
  hintText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  garageCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  garageInfo: { flex: 1 },
  garageTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  garageName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeVerified: { backgroundColor: '#e8f5e9' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  garageAddress: { fontSize: 13, color: '#888' },

  bookBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginLeft: 12,
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Vehicle picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, maxHeight: '70%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#888', marginBottom: 20 },
  vehicleOption: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  vehicleOptionReg: { fontSize: 16, fontWeight: '700', color: '#1a73e8', marginBottom: 3 },
  vehicleOptionName: { fontSize: 13, color: '#666' },
  modalCancel: {
    marginTop: 16, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
  },
  modalCancelText: { fontSize: 15, color: '#888', fontWeight: '600' },
})
