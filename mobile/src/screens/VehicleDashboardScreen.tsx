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
  onSell: () => void
}

type PendingTransfer = {
  id: string
  buyerPhone: string
  createdAt: string
}

type Submission = {
  id: string
  description: string
  parts: string | null
  brand: string | null
  cost: number | null
  notes: string | null
  createdAt: string
  garage: { name: string; verified: boolean }
}

export default function VehicleDashboardScreen({ token, vehicle, onBack, onAddRecord, onLogFuel, onAddExpense, onAnalytics, onShare, onSell }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null)
  const [cancellingTransfer, setCancellingTransfer] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const [recs, subs, transfer] = await Promise.all([
        api.getServiceRecords(token, vehicle.id),
        api.getVehicleSubmissions(token, vehicle.id),
        api.getVehicleTransfer(token, vehicle.id),
      ])
      setRecords(recs)
      setSubmissions(subs)
      setPendingTransfer(transfer)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (submissionId: string) => {
    setAccepting(submissionId)
    try {
      await api.acceptSubmission(token, submissionId)
      await loadRecords()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setAccepting(null)
    }
  }

  const handleCancelTransfer = () => {
    if (!pendingTransfer) return
    Alert.alert(
      'Cancel Transfer',
      'Cancel the pending transfer request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          onPress: async () => {
            setCancellingTransfer(true)
            try {
              await api.cancelTransfer(token, pendingTransfer.id)
              setPendingTransfer(null)
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setCancellingTransfer(false)
            }
          },
        },
      ]
    )
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

      {pendingTransfer && (
        <View style={styles.transferBanner}>
          <View style={styles.transferBannerLeft}>
            <Text style={styles.transferBannerTitle}>Transfer Pending</Text>
            <Text style={styles.transferBannerSub}>Waiting for {pendingTransfer.buyerPhone} to accept</Text>
          </View>
          <TouchableOpacity
            style={[styles.cancelTransferBtn, cancellingTransfer && styles.cancelTransferBtnDisabled]}
            onPress={handleCancelTransfer}
            disabled={cancellingTransfer}
          >
            {cancellingTransfer
              ? <ActivityIndicator color="#c62828" size="small" />
              : <Text style={styles.cancelTransferBtnText}>Cancel</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {submissions.length > 0 && (
        <View style={styles.submissionsSection}>
          <Text style={styles.submissionsSectionTitle}>
            Pending from Garage ({submissions.length})
          </Text>
          {submissions.map(sub => (
            <View key={sub.id} style={styles.submissionCard}>
              <View style={styles.submissionHeader}>
                <Text style={styles.submissionGarage}>
                  {sub.garage.name}{sub.garage.verified ? ' ✅' : ''}
                </Text>
                <Text style={styles.submissionDate}>
                  {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.tagRow}>
                {sub.description.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{s}</Text>
                  </View>
                ))}
              </View>
              {sub.parts && <Text style={styles.submissionMeta}>Parts: {sub.parts}</Text>}
              {sub.brand && <Text style={styles.submissionMeta}>Brand: {sub.brand}</Text>}
              {sub.cost != null && (
                <Text style={styles.submissionCost}>LKR {sub.cost.toLocaleString()}</Text>
              )}
              {sub.notes && <Text style={styles.submissionNotes}>{sub.notes}</Text>}
              <TouchableOpacity
                style={[styles.acceptBtn, accepting === sub.id && styles.acceptBtnDisabled]}
                onPress={() => handleAccept(sub.id)}
                disabled={accepting === sub.id}
              >
                {accepting === sub.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.acceptBtnText}>Accept — Add to History</Text>
                }
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

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

      {!pendingTransfer && (
        <TouchableOpacity style={styles.sellRow} onPress={onSell}>
          <Text style={styles.sellRowText}>Sell or Transfer this Vehicle →</Text>
        </TouchableOpacity>
      )}

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
  transferBanner: {
    backgroundColor: '#fff3e0', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 10, padding: 14, flexDirection: 'row',
    alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#e65100',
  },
  transferBannerLeft: { flex: 1 },
  transferBannerTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 2 },
  transferBannerSub: { fontSize: 12, color: '#795548' },
  cancelTransferBtn: {
    borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10,
  },
  cancelTransferBtnDisabled: { opacity: 0.5 },
  cancelTransferBtnText: { fontSize: 12, color: '#c62828', fontWeight: '700' },
  sellRow: { alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 8 },
  sellRowText: { fontSize: 12, color: '#888', textDecorationLine: 'underline' },
  submissionsSection: { marginHorizontal: 16, marginBottom: 12 },
  submissionsSectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#e65100',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  submissionCard: {
    backgroundColor: '#fff8f0', borderRadius: 12, padding: 14,
    marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#e65100',
  },
  submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  submissionGarage: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  submissionDate: { fontSize: 12, color: '#888' },
  submissionMeta: { fontSize: 12, color: '#555', marginTop: 4 },
  submissionCost: { fontSize: 14, fontWeight: '700', color: '#e65100', marginTop: 6 },
  submissionNotes: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 4 },
  acceptBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
