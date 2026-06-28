import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, ScrollView, Modal, Image
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
  vehicleType?: string | null
  photoUrl?: string | null
  emissionTestExpiry?: string | null
  revenueLicenceExpiry?: string | null
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

type TransferRecords = {
  serviceRecords: {
    id: string
    date: string
    description: string
    mileage?: number
    parts?: string
    brand?: string
    cost?: number
    notes?: string
  }[]
  fuelLogs: {
    id: string
    date: string
    mileage: number
    litres?: number
    cost?: number
    station?: string
  }[]
  expenses: {
    id: string
    date: string
    category: string
    amount: number
    description?: string
  }[]
}

type Props = {
  token: string
  phoneNumber: string
  userType: 'owner' | 'garage'
  onAddVehicle: () => void
  onSelectVehicle: (vehicle: Vehicle) => void
  onVehiclesLoaded: (vehicles: Vehicle[]) => void
  onLogout: () => void
  onSettings: () => void
  notifUnread?: boolean
  onNotifPress?: () => void
}

export default function MyVehiclesScreen({ token, phoneNumber, userType, onAddVehicle, onSelectVehicle, onVehiclesLoaded, onLogout, onSettings, notifUnread, onNotifPress }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [incomingTransfers, setIncomingTransfers] = useState<IncomingTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [previewTransfer, setPreviewTransfer] = useState<IncomingTransfer | null>(null)
  const [previewRecords, setPreviewRecords] = useState<TransferRecords | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [searchText, setSearchText] = useState('')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [vehicleData, transferData] = await Promise.all([
        api.getVehicles(token),
        api.getIncomingTransfers(token),
      ])
      setVehicles(vehicleData)
      onVehiclesLoaded(vehicleData)
      setIncomingTransfers(transferData)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleViewHistory = async (transfer: IncomingTransfer) => {
    setPreviewTransfer(transfer)
    setPreviewRecords(null)
    setLoadingPreview(true)
    try {
      const data = await api.getTransferRecords(token, transfer.id)
      setPreviewRecords(data)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setPreviewTransfer(null)
    } finally {
      setLoadingPreview(false)
    }
  }

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
            setPreviewTransfer(null)
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

  const filteredVehicles = searchText.trim()
    ? vehicles.filter(v =>
        v.registrationNo.toLowerCase().includes(searchText.toLowerCase()) ||
        v.make.toLowerCase().includes(searchText.toLowerCase()) ||
        v.model.toLowerCase().includes(searchText.toLowerCase())
      )
    : vehicles

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity style={styles.card} onPress={() => onSelectVehicle(item)}>
      <View style={styles.cardInner}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
        ) : (
          <View style={styles.cardPhotoPlaceholder}>
            <Text style={styles.cardPhotoIcon}>🚗</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.regNo}>{item.registrationNo}</Text>
            <Text style={styles.fuelType}>{item.fuelType}</Text>
          </View>
          <Text style={styles.vehicleName}>{item.year} {item.make} {item.model}</Text>
          <Text style={styles.mileage}>{item.mileage.toLocaleString()} km</Text>
        </View>
      </View>
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
          {onNotifPress && (
            <TouchableOpacity style={styles.bellBtn} onPress={onNotifPress}>
              <Text style={styles.bellIcon}>🔔</Text>
              {notifUnread && <View style={styles.bellDot} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsBtn} onPress={onSettings}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
      ) : (
        <FlatList
          data={filteredVehicles}
          keyExtractor={item => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.list}
          onRefresh={loadAll}
          refreshing={loading}
          ListHeaderComponent={
            <>
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search by registration, make or model..."
                placeholderTextColor="#aaa"
                clearButtonMode="while-editing"
              />
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
                      <View style={styles.transferActions}>
                        <TouchableOpacity
                          style={styles.viewHistoryBtn}
                          onPress={() => handleViewHistory(transfer)}
                        >
                          <Text style={styles.viewHistoryBtnText}>View History</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.acceptBtn, accepting === transfer.id && styles.acceptBtnDisabled]}
                          onPress={() => handleAcceptTransfer(transfer)}
                          disabled={accepting === transfer.id}
                        >
                          {accepting === transfer.id
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.acceptBtnText}>Accept</Text>
                          }
                        </TouchableOpacity>
                      </View>
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
            searchText ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptySubtitle}>No vehicles match "{searchText}"</Text>
              </View>
            ) : incomingTransfers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No vehicles yet</Text>
                <Text style={styles.emptySubtitle}>Add your first vehicle to get started</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* History Preview Modal */}
      <Modal
        visible={previewTransfer !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPreviewTransfer(null)}
      >
        <View style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPreviewTransfer(null)}>
              <Text style={styles.modalBack}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Vehicle History</Text>
            <View style={{ width: 60 }} />
          </View>

          {previewTransfer && (
            <View style={styles.modalVehicleBanner}>
              <Text style={styles.modalBannerReg}>{previewTransfer.vehicle.registrationNo}</Text>
              <Text style={styles.modalBannerName}>
                {previewTransfer.vehicle.year} {previewTransfer.vehicle.make} {previewTransfer.vehicle.model}
              </Text>
              <Text style={styles.modalBannerMeta}>
                {previewTransfer.vehicle.mileage.toLocaleString()} km · {previewTransfer.vehicle.fuelType}
              </Text>
            </View>
          )}

          {loadingPreview ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : previewRecords ? (
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 120 }}>
              {/* Service Records */}
              <Text style={styles.modalSectionTitle}>
                🔧 Service Records ({previewRecords.serviceRecords.length})
              </Text>
              {previewRecords.serviceRecords.length === 0 ? (
                <Text style={styles.modalEmpty}>No service records</Text>
              ) : previewRecords.serviceRecords.map(r => (
                <View key={r.id} style={styles.recordCard}>
                  <View style={styles.recordCardRow}>
                    <Text style={styles.recordDate}>{formatDate(r.date)}</Text>
                    {r.cost != null && <Text style={styles.recordCost}>LKR {r.cost.toLocaleString()}</Text>}
                  </View>
                  <Text style={styles.recordDesc}>{r.description}</Text>
                  {r.mileage != null && <Text style={styles.recordMeta}>{r.mileage.toLocaleString()} km</Text>}
                  {r.parts && <Text style={styles.recordMeta}>Parts: {r.parts}</Text>}
                  {r.brand && <Text style={styles.recordMeta}>Brand: {r.brand}</Text>}
                  {r.notes && <Text style={styles.recordNotes}>{r.notes}</Text>}
                </View>
              ))}

              {/* Fuel Logs */}
              <Text style={styles.modalSectionTitle}>
                ⛽ Fuel Logs ({previewRecords.fuelLogs.length})
              </Text>
              {previewRecords.fuelLogs.length === 0 ? (
                <Text style={styles.modalEmpty}>No fuel logs</Text>
              ) : previewRecords.fuelLogs.map(f => (
                <View key={f.id} style={styles.recordCard}>
                  <View style={styles.recordCardRow}>
                    <Text style={styles.recordDate}>{formatDate(f.date)}</Text>
                    {f.cost != null && <Text style={styles.recordCost}>LKR {f.cost.toLocaleString()}</Text>}
                  </View>
                  <Text style={styles.recordMeta}>{f.mileage.toLocaleString()} km</Text>
                  {f.litres != null && <Text style={styles.recordMeta}>{f.litres} L</Text>}
                  {f.station && <Text style={styles.recordMeta}>{f.station}</Text>}
                </View>
              ))}

              {/* Expenses */}
              <Text style={styles.modalSectionTitle}>
                💰 Expenses ({previewRecords.expenses.length})
              </Text>
              {previewRecords.expenses.length === 0 ? (
                <Text style={styles.modalEmpty}>No expenses</Text>
              ) : previewRecords.expenses.map(e => (
                <View key={e.id} style={styles.recordCard}>
                  <View style={styles.recordCardRow}>
                    <Text style={styles.recordDate}>{formatDate(e.date)}</Text>
                    <Text style={styles.recordCost}>LKR {e.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.recordDesc}>{e.category}</Text>
                  {e.description && <Text style={styles.recordMeta}>{e.description}</Text>}
                </View>
              ))}
            </ScrollView>
          ) : null}

          {/* Accept button pinned to bottom */}
          {previewTransfer && !loadingPreview && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalAcceptBtn, accepting === previewTransfer.id && styles.acceptBtnDisabled]}
                onPress={() => handleAcceptTransfer(previewTransfer)}
                disabled={accepting === previewTransfer.id}
              >
                {accepting === previewTransfer.id
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalAcceptBtnText}>Accept Transfer</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { padding: 4, position: 'relative' },
  bellIcon: { fontSize: 22 },
  bellDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#e53935', borderWidth: 1.5, borderColor: '#fff',
  },
  settingsBtn: { padding: 4 },
  settingsBtnText: { fontSize: 22 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: '#e53935', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoutBtnText: { fontSize: 13, color: '#e53935', fontWeight: '700' },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  loader: { flex: 1 },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', marginBottom: 32, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    marginBottom: 12, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  cardPhoto: { width: 80, height: 80, resizeMode: 'cover' },
  cardPhotoPlaceholder: {
    width: 80, height: 80, backgroundColor: '#e8f0fe',
    alignItems: 'center', justifyContent: 'center',
  },
  cardPhotoIcon: { fontSize: 28 },
  cardContent: { flex: 1, padding: 14 },
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
  transferActions: { flexDirection: 'row', gap: 10 },
  viewHistoryBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff',
  },
  viewHistoryBtnText: { color: '#1a73e8', fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 1, backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalBack: { fontSize: 14, color: '#888', fontWeight: '600', width: 60 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  modalVehicleBanner: {
    backgroundColor: '#1a73e8', paddingHorizontal: 20, paddingVertical: 14,
  },
  modalBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  modalBannerName: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  modalBannerMeta: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  modalScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  modalSectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#555',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 16, marginBottom: 8,
  },
  modalEmpty: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginBottom: 8 },
  recordCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  recordCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 12, color: '#888' },
  recordCost: { fontSize: 13, fontWeight: '700', color: '#1a73e8' },
  recordDesc: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  recordMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  recordNotes: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 4 },
  modalFooter: {
    backgroundColor: '#fff', padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  modalAcceptBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  modalAcceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
