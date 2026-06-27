import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput,
  Image, Modal, FlatList, Dimensions
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { api } from '../config/api'
import { exportVehiclePdf } from '../utils/pdfExport'

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
  photos: string[]
}

type TopPrediction = {
  id: string
  name: string
  status: 'overdue' | 'due_soon'
  remainingKm: number | null
  remainingDays: number | null
}

type Props = {
  token: string
  phoneNumber: string
  vehicle: Vehicle
  onBack: () => void
  onAddRecord: () => void
  onLogFuel: () => void
  onAddExpense: () => void
  onAnalytics: () => void
  onLogEmissionTest: () => void
  onPredictions: () => void
  onKnowledgeHub: () => void
  onMileageUpdated: (newMileage: number) => void
  onShare: () => void
  onSell: () => void
  onBookService: () => void
  onMessageCountChange?: (count: number) => void
  bookingSeenCounts?: Record<string, number>
  onBookingSeen?: (bookingId: string, count: number) => void
  focusBookingId?: string | null
  onFocusHandled?: () => void
  onNotifSeen?: (newCount: number) => void
}

type Expense = {
  id: string
  date: string
  category: string
  amount: number
  description: string | null
  mileage: number | null
  notes: string | null
}

type OwnerBooking = {
  id: string
  date: string
  status: string
  slotLabel: string | null
  notes: string | null
  noteType: string | null
  serviceType: string | null
  garage: { id: string; name: string; verified: boolean }
  _count?: { bookingNotes: number }
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
  photos: string[]
  createdAt: string
  bookingId: string | null
  garage: { name: string; verified: boolean }
}

type BookingNote = {
  id: string
  senderPhone: string
  message: string
  createdAt: string
}

type MiniAnalytics = {
  mileageTrend: { mileage: number; label: string }[]
  fuelEfficiencyTrend: { kmPerL: number; label: string }[]
  avgFuelEfficiency: number | null
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ data, color, gradId }: {
  data: number[]
  color: string
  gradId: string
}) {
  if (data.length < 2) return <View style={{ height: 52 }} />

  const W = 140, H = 52
  const pL = 2, pR = 2, pT = 4, pB = 4
  const plotW = W - pL - pR, plotH = H - pT - pB

  const minV = Math.min(...data), maxV = Math.max(...data)
  const range = maxV - minV || 1

  const px = (i: number) => pL + (i / (data.length - 1)) * plotW
  const py = (v: number) => pT + plotH - ((v - minV) / range) * plotH
  const pts = data.map((v, i) => ({ x: px(i), y: py(v) }))

  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    linePath += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  const fillPath = linePath + ` L ${pts[pts.length - 1].x} ${pT + plotH} L ${pts[0].x} ${pT + plotH} Z`

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function getTrend(data: number[], higherIsBetter: boolean) {
  if (data.length < 2) return { arrow: '→', label: 'Not enough data', color: '#aaa' }
  const first = data[0], last = data[data.length - 1]
  const pct = ((last - first) / (Math.abs(first) || 1)) * 100
  if (pct > 3) return { arrow: '↑', label: 'Increasing', color: higherIsBetter ? '#34a853' : '#e65100' }
  if (pct < -3) return { arrow: '↓', label: 'Declining', color: higherIsBetter ? '#e65100' : '#34a853' }
  return { arrow: '→', label: 'Stable', color: '#888' }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VehicleDashboardScreen({ token, phoneNumber, vehicle, onBack, onAddRecord, onLogFuel, onAddExpense, onAnalytics, onLogEmissionTest, onPredictions, onKnowledgeHub, onMileageUpdated, onShare, onSell, onBookService, onMessageCountChange, bookingSeenCounts = {}, onBookingSeen, focusBookingId, onFocusHandled, onNotifSeen }: Props) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null)
  const [cancellingTransfer, setCancellingTransfer] = useState(false)
  const [miniAnalytics, setMiniAnalytics] = useState<MiniAnalytics | null>(null)
  const [topPredictions, setTopPredictions] = useState<TopPrediction[]>([])
  const [editingMileage, setEditingMileage] = useState(false)
  const [mileageInput, setMileageInput] = useState('')
  const [savingMileage, setSavingMileage] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [bookingNotes, setBookingNotes] = useState<Record<string, BookingNote[]>>({})
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({})
  const [sendingMessage, setSendingMessage] = useState<string | null>(null)
  const [loadingNotes, setLoadingNotes] = useState<Set<string>>(new Set())
  const [myBookings, setMyBookings] = useState<OwnerBooking[]>([])
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | '1y' | '6m' | '3m'>('all')
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number; label: string } | null>(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const photoViewerRef = useRef<FlatList<string>>(null)

  const openPhotos = (photos: string[], startIndex: number, label: string) => {
    setPhotoViewer({ photos, index: startIndex, label })
    setPhotoViewerIndex(startIndex)
  }
  const closePhotoViewer = () => setPhotoViewer(null)
  const [exporting, setExporting] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const [recs, subs, transfer, analytics, preds, allBookings, exps] = await Promise.all([
        api.getServiceRecords(token, vehicle.id),
        api.getVehicleSubmissions(token, vehicle.id),
        api.getVehicleTransfer(token, vehicle.id),
        api.getAnalytics(token, vehicle.id).catch(() => null),
        api.getPredictions(token, vehicle.id).catch(() => []),
        api.getMyBookings(token).catch(() => []),
        api.getExpenses(token, vehicle.id).catch(() => []),
      ])
      setRecords(recs)
      setSubmissions(subs)
      setPendingTransfer(transfer)
      setExpenses(exps)
      const vehicleBookings = (allBookings as any[]).filter((b: any) => b.vehicleId === vehicle.id)
      setMyBookings(vehicleBookings)
      const urgent = (preds as any[]).filter((p: any) => p.status === 'overdue' || p.status === 'due_soon').slice(0, 3)
      setTopPredictions(urgent)
      if (analytics) {
        setMiniAnalytics({
          mileageTrend: analytics.mileageTrend ?? [],
          fuelEfficiencyTrend: analytics.fuelEfficiencyTrend ?? [],
          avgFuelEfficiency: analytics.avgFuelEfficiency ?? null,
        })
      }
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

  const handleUpdateMileage = async () => {
    const newMileage = parseInt(mileageInput)
    if (!mileageInput || isNaN(newMileage) || newMileage <= vehicle.mileage) {
      Alert.alert('Invalid mileage', `Please enter a value higher than the current odometer (${vehicle.mileage.toLocaleString()} km).`)
      return
    }
    setSavingMileage(true)
    try {
      await api.updateMileage(token, vehicle.id, newMileage)
      onMileageUpdated(newMileage)
      setEditingMileage(false)
      setMileageInput('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSavingMileage(false)
    }
  }

  const toggleMessages = async (sub: Submission) => {
    if (!sub.bookingId) return
    const key = sub.id
    if (expandedMessages.has(key)) {
      setExpandedMessages(prev => { const s = new Set(prev); s.delete(key); return s })
      return
    }
    setExpandedMessages(prev => new Set(prev).add(key))
    setLoadingNotes(prev => new Set(prev).add(key))
    try {
      const notes = await api.getBookingNotes(token, sub.bookingId!)
      setBookingNotes(prev => ({ ...prev, [sub.bookingId!]: notes }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoadingNotes(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const handleSendMessage = async (sub: Submission) => {
    if (!sub.bookingId) return
    const msg = (messageInputs[sub.id] || '').trim()
    if (!msg) return
    setSendingMessage(sub.id)
    try {
      const note = await api.addBookingNote(token, sub.bookingId, msg)
      setBookingNotes(prev => ({
        ...prev,
        [sub.bookingId!]: [...(prev[sub.bookingId!] || []), note],
      }))
      setMessageInputs(prev => ({ ...prev, [sub.id]: '' }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSendingMessage(null)
    }
  }

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Cancel this service appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingBooking(bookingId)
            try {
              await api.cancelBooking(token, bookingId)
              setMyBookings(prev => prev.filter(b => b.id !== bookingId))
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setCancellingBooking(null)
            }
          },
        },
      ]
    )
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const [fuelLogs, expenses] = await Promise.all([
        api.getFuelLogs(token, vehicle.id).catch(() => []),
        api.getExpenses(token, vehicle.id).catch(() => []),
      ])
      await exportVehiclePdf(vehicle, records, fuelLogs, expenses)
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Could not generate PDF')
    } finally {
      setExporting(false)
    }
  }

  const toggleBookingMessages = async (bookingId: string) => {
    if (expandedMessages.has(bookingId)) {
      setExpandedMessages(prev => { const s = new Set(prev); s.delete(bookingId); return s })
      return
    }
    setExpandedMessages(prev => new Set(prev).add(bookingId))
    setLoadingNotes(prev => new Set(prev).add(bookingId))
    try {
      const notes = await api.getBookingNotes(token, bookingId)
      setBookingNotes(prev => ({ ...prev, [bookingId]: notes }))
      setMyBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, _count: { bookingNotes: notes.length } } : b
      ))
      onBookingSeen?.(bookingId, notes.length)
      // Sync bell dot: mark any DB notification for this booking as read
      api.markBookingNotifsRead(token, bookingId)
        .then(({ count }) => onNotifSeen?.(count))
        .catch(() => {})
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoadingNotes(prev => { const s = new Set(prev); s.delete(bookingId); return s })
    }
  }

  const handleSendBookingMessage = async (bookingId: string) => {
    const msg = (messageInputs[bookingId] || '').trim()
    if (!msg) return
    setSendingMessage(bookingId)
    try {
      const note = await api.addBookingNote(token, bookingId, msg)
      const currentNotes = bookingNotes[bookingId] || []
      const updated = [...currentNotes, note]
      setBookingNotes(prev => ({ ...prev, [bookingId]: updated }))
      setMyBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, _count: { bookingNotes: updated.length } } : b
      ))
      onBookingSeen?.(bookingId, updated.length)
      setMessageInputs(prev => ({ ...prev, [bookingId]: '' }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSendingMessage(null)
    }
  }

  useEffect(() => { loadRecords() }, [])

  useEffect(() => {
    const total = myBookings.reduce((sum, b) => {
      const unread = Math.max(0, (b._count?.bookingNotes ?? 0) - (bookingSeenCounts[b.id] ?? 0))
      return sum + unread
    }, 0)
    onMessageCountChange?.(total)
  }, [bookingSeenCounts, myBookings])

  // Auto-expand booking messages when navigated from a notification
  useEffect(() => {
    if (!focusBookingId || myBookings.length === 0) return
    const focusAndLoad = async () => {
      setExpandedMessages(prev => new Set(prev).add(focusBookingId))
      setLoadingNotes(prev => new Set(prev).add(focusBookingId))
      try {
        const notes = await api.getBookingNotes(token, focusBookingId)
        setBookingNotes(prev => ({ ...prev, [focusBookingId]: notes }))
        setMyBookings(prev => prev.map(b =>
          b.id === focusBookingId ? { ...b, _count: { bookingNotes: notes.length } } : b
        ))
        onBookingSeen?.(focusBookingId, notes.length)
      } catch {}
      finally {
        setLoadingNotes(prev => { const s = new Set(prev); s.delete(focusBookingId); return s })
      }
      onFocusHandled?.()
    }
    focusAndLoad()
  }, [focusBookingId, myBookings.length])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const parseServices = (description: string) => {
    return description.split(',').map(s => s.trim()).filter(Boolean)
  }

  // Sparkline data
  const mileageValues = miniAnalytics?.mileageTrend.map(d => d.mileage) ?? []
  const effValues = miniAnalytics?.fuelEfficiencyTrend.map(d => d.kmPerL) ?? []
  const mileageTrend = getTrend(mileageValues, true)
  const effTrend = getTrend(effValues, true)

  const showSparklines = mileageValues.length >= 2 || effValues.length >= 2

  const renderRecord = ({ item }: { item: ServiceRecord }) => {
    const isExpanded = expandedId === item.id
    const services = parseServices(item.description)
    const preview = services.slice(0, 2)
    const extra = services.length - 2

    return (
      <TouchableOpacity
        key={item.id}
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
            {item.photos && item.photos.length > 0 && (
              <View style={styles.photoStrip}>
                {item.photos.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => openPhotos(item.photos, i, item.description)} activeOpacity={0.8}>
                    <Image source={{ uri: url }} style={styles.recordThumb} />
                    {item.photos.length > 1 && i === 0 && (
                      <View style={styles.thumbCountBadge}>
                        <Text style={styles.thumbCountText}>{item.photos.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
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

  const filteredRecords = records.filter(r => {
    if (historySearch.trim()) {
      if (!r.description.toLowerCase().includes(historySearch.toLowerCase())) return false
    }
    if (historyDateFilter !== 'all') {
      const months = historyDateFilter === '1y' ? 12 : historyDateFilter === '6m' ? 6 : 3
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(r.date) < cutoff) return false
    }
    return true
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.regNo}>{vehicle.registrationNo}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRecords} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleDetail}>{vehicle.fuelType}</Text>
            {!editingMileage ? (
              <TouchableOpacity style={styles.mileageRow} onPress={() => { setMileageInput(''); setEditingMileage(true) }}>
                <Text style={styles.vehicleDetail}>{vehicle.mileage.toLocaleString()} km</Text>
                <Text style={styles.mileageEditHint}>  ✏️ Update</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.mileageEditRow}>
                <TextInput
                  style={styles.mileageInput}
                  value={mileageInput}
                  onChangeText={setMileageInput}
                  keyboardType="number-pad"
                  placeholder={vehicle.mileage.toLocaleString()}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  autoFocus
                />
                <TouchableOpacity style={styles.mileageSaveBtn} onPress={handleUpdateMileage} disabled={savingMileage}>
                  {savingMileage ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mileageSaveBtnText}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.mileageCancelBtn} onPress={() => setEditingMileage(false)}>
                  <Text style={styles.mileageCancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
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
              <Text style={styles.quickBtnText}>📊 Insights</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.bookBtn} onPress={onLogEmissionTest}>
            <Text style={styles.bookBtnText}>💨 Log Emission / Carbon Test</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bookBtn, { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={onKnowledgeHub}>
            <Text style={styles.bookBtnText}>🧠 Know Your Vehicle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bookBtn, { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={onBookService}>
            <Text style={styles.bookBtnText}>📅 Book Service Appointment</Text>
          </TouchableOpacity>
        </View>

        {/* My Appointments — owner's booked service slots */}
        {myBookings.length > 0 && (
          <View style={styles.appointmentsSection}>
            <Text style={styles.appointmentsSectionTitle}>📅 My Appointments ({myBookings.length})</Text>
            {myBookings.map(bk => {
              const isConfirmed = bk.status === 'confirmed'
              const statusColor = isConfirmed ? '#2e7d32' : '#e65100'
              const statusLabel = isConfirmed ? '✓ Confirmed' : '⏳ Pending'
              const isExpanded = expandedMessages.has(bk.id)
              return (
                <View key={bk.id} style={[styles.appointmentCard, { borderLeftColor: statusColor }]}>
                  <View style={styles.appointmentHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appointmentGarage}>
                        {bk.garage.name}{bk.garage.verified ? ' ✅' : ''}
                      </Text>
                      <Text style={styles.appointmentDateTime}>
                        {new Date(bk.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        {bk.slotLabel ? `  •  ${bk.slotLabel}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isConfirmed ? '#e8f5e9' : '#fff3e0' }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {bk.serviceType && (
                    <View style={styles.serviceTypeChip}>
                      <Text style={styles.serviceTypeChipText}>
                        {bk.serviceType === 'full' ? '🔧 Full Service' : bk.serviceType === 'between' ? '⚡ Between Service' : '🏭 Third-Party'}
                      </Text>
                    </View>
                  )}

                  {bk.notes && (
                    <Text style={styles.appointmentNotes}>
                      {bk.noteType === 'urgent' ? '🚨 ' : ''}{bk.notes}
                    </Text>
                  )}

                  <View style={styles.appointmentActions}>
                    <TouchableOpacity
                      style={styles.messagesToggleSmall}
                      onPress={() => toggleBookingMessages(bk.id)}
                    >
                      <View style={styles.messagesToggleRow}>
                        <Text style={styles.messagesToggleSmallText}>
                          💬 Messages {isExpanded ? '▲' : '▼'}
                        </Text>
                        {(() => {
                          const unread = Math.max(0, (bk._count?.bookingNotes ?? 0) - (bookingSeenCounts[bk.id] ?? 0))
                          return unread > 0 ? <View style={styles.msgDot} /> : null
                        })()}
                      </View>
                    </TouchableOpacity>
                    {!isConfirmed && (
                      <TouchableOpacity
                        style={[styles.cancelBkBtn, cancellingBooking === bk.id && styles.cancelBkBtnDisabled]}
                        onPress={() => handleCancelBooking(bk.id)}
                        disabled={cancellingBooking === bk.id}
                      >
                        {cancellingBooking === bk.id
                          ? <ActivityIndicator size="small" color="#c62828" />
                          : <Text style={styles.cancelBkBtnText}>Cancel</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>

                  {isExpanded && (
                    <View style={styles.messagesSection}>
                      {loadingNotes.has(bk.id) ? (
                        <ActivityIndicator size="small" color="#1a73e8" style={{ marginVertical: 8 }} />
                      ) : (
                        <>
                          {(bookingNotes[bk.id] || []).length === 0 ? (
                            <Text style={styles.noMessages}>No messages yet</Text>
                          ) : (bookingNotes[bk.id] || []).map(note => (
                            <View
                              key={note.id}
                              style={[
                                styles.messageItem,
                                note.senderPhone !== phoneNumber ? styles.messageItemThem : undefined,
                              ]}
                            >
                              <Text style={styles.messageSender}>
                                {note.senderPhone !== phoneNumber ? 'Garage' : 'You'}
                              </Text>
                              <Text style={styles.messageText}>{note.message}</Text>
                              <Text style={styles.messageTime}>
                                {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.messageInputRow}>
                            <TextInput
                              style={styles.messageInput}
                              value={messageInputs[bk.id] || ''}
                              onChangeText={v => setMessageInputs(prev => ({ ...prev, [bk.id]: v }))}
                              placeholder="Type a message..."
                              multiline={false}
                            />
                            <TouchableOpacity
                              style={[styles.messageSendBtn, (!messageInputs[bk.id]?.trim() || sendingMessage === bk.id) && styles.messageSendBtnDisabled]}
                              onPress={() => handleSendBookingMessage(bk.id)}
                              disabled={!messageInputs[bk.id]?.trim() || sendingMessage === bk.id}
                            >
                              {sendingMessage === bk.id
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.messageSendBtnText}>→</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Upcoming Services prediction card */}
        <TouchableOpacity style={styles.predCard} onPress={onPredictions} activeOpacity={0.85}>
          <View style={styles.predCardHeader}>
            <Text style={styles.predCardTitle}>🔮 Upcoming Services</Text>
            <Text style={styles.predCardLink}>View all →</Text>
          </View>
          {topPredictions.length === 0 ? (
            <Text style={styles.predAllOk}>✓ All tracked services are on schedule</Text>
          ) : (
            topPredictions.map(p => (
              <View key={p.id} style={styles.predItem}>
                <View style={[styles.predDot, { backgroundColor: p.status === 'overdue' ? '#c62828' : '#e65100' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.predItemName}>{p.name}</Text>
                  <Text style={styles.predItemDetail}>
                    {p.status === 'overdue'
                      ? `Overdue${p.remainingKm != null ? ` by ${Math.abs(p.remainingKm).toLocaleString()} km` : ''}`
                      : `Due in${p.remainingKm != null ? ` ${p.remainingKm.toLocaleString()} km` : p.remainingDays != null ? ` ${p.remainingDays} days` : ''}`
                    }
                  </Text>
                </View>
                <Text style={[styles.predStatus, { color: p.status === 'overdue' ? '#c62828' : '#e65100' }]}>
                  {p.status === 'overdue' ? '⚠️' : '🔔'}
                </Text>
              </View>
            ))
          )}
        </TouchableOpacity>

        {/* Pending submissions — shown prominently right after vehicle card */}
        {submissions.length > 0 && (
          <View style={styles.submissionsSection}>
            <Text style={styles.submissionsSectionTitle}>
              ⚠️ Pending from Garage ({submissions.length})
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
                {sub.photos && sub.photos.length > 0 && (
                  <View style={styles.photoStrip}>
                    {sub.photos.map((url, i) => (
                      <TouchableOpacity key={i} onPress={() => openPhotos(sub.photos, i, sub.description || 'Service submission')} activeOpacity={0.8}>
                        <Image source={{ uri: url }} style={styles.recordThumb} />
                        {sub.photos.length > 1 && i === 0 && (
                          <View style={styles.thumbCountBadge}>
                            <Text style={styles.thumbCountText}>{sub.photos.length}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.acceptBtn, accepting === sub.id && styles.acceptBtnDisabled]}
                  onPress={() => handleAccept(sub.id)}
                  disabled={accepting === sub.id}
                >
                  {accepting === sub.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.acceptBtnText}>✓ Accept — Add to My History</Text>
                  }
                </TouchableOpacity>

                {/* Booking notes thread (only if linked to a booking) */}
                {sub.bookingId && (
                  <TouchableOpacity
                    style={styles.messagesToggle}
                    onPress={() => toggleMessages(sub)}
                  >
                    <Text style={styles.messagesToggleText}>
                      💬 Messages {expandedMessages.has(sub.id) ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                )}

                {sub.bookingId && expandedMessages.has(sub.id) && (
                  <View style={styles.messagesSection}>
                    {loadingNotes.has(sub.id) ? (
                      <ActivityIndicator size="small" color="#1a73e8" style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {(bookingNotes[sub.bookingId] || []).length === 0 ? (
                          <Text style={styles.noMessages}>No messages yet</Text>
                        ) : (bookingNotes[sub.bookingId] || []).map(note => (
                          <View
                            key={note.id}
                            style={[
                              styles.messageItem,
                              note.senderPhone !== phoneNumber ? styles.messageItemThem : undefined,
                            ]}
                          >
                            <Text style={styles.messageSender}>
                              {note.senderPhone !== phoneNumber ? 'Garage' : 'You'}
                            </Text>
                            <Text style={styles.messageText}>{note.message}</Text>
                            <Text style={styles.messageTime}>
                              {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        ))}
                        <View style={styles.messageInputRow}>
                          <TextInput
                            style={styles.messageInput}
                            value={messageInputs[sub.id] || ''}
                            onChangeText={v => setMessageInputs(prev => ({ ...prev, [sub.id]: v }))}
                            placeholder="Type a message..."
                            multiline={false}
                          />
                          <TouchableOpacity
                            style={[styles.messageSendBtn, (!messageInputs[sub.id]?.trim() || sendingMessage === sub.id) && styles.messageSendBtnDisabled]}
                            onPress={() => handleSendMessage(sub)}
                            disabled={!messageInputs[sub.id]?.trim() || sendingMessage === sub.id}
                          >
                            {sendingMessage === sub.id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.messageSendBtnText}>→</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Sparkline mini-charts */}
        {showSparklines && (
          <View style={styles.sparkRow}>
            <TouchableOpacity style={styles.sparkCard} onPress={onAnalytics}>
              <Text style={styles.sparkTitle}>Mileage</Text>
              <Sparkline data={mileageValues} color="#1a73e8" gradId="dashMileage" />
              <Text style={styles.sparkValue}>
                {vehicle.mileage.toLocaleString()}
                <Text style={styles.sparkUnit}> km</Text>
              </Text>
              <Text style={[styles.sparkTrend, { color: mileageTrend.color }]}>
                {mileageTrend.arrow} {mileageTrend.label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sparkCard} onPress={onAnalytics}>
              <Text style={styles.sparkTitle}>Fuel Economy</Text>
              <Sparkline data={effValues.length >= 2 ? effValues : mileageValues} color="#34a853" gradId="dashEff" />
              <Text style={styles.sparkValue}>
                {miniAnalytics?.avgFuelEfficiency != null
                  ? miniAnalytics.avgFuelEfficiency.toFixed(1)
                  : '—'}
                <Text style={styles.sparkUnit}> km/L</Text>
              </Text>
              <Text style={[styles.sparkTrend, { color: effTrend.color }]}>
                {effValues.length >= 2 ? `${effTrend.arrow} ${effTrend.label}` : 'Log more fill-ups'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service History</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExportPdf}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#1a73e8" />
              : <Text style={styles.exportBtnText}>📄 Export PDF</Text>
            }
          </TouchableOpacity>
        </View>

        {!pendingTransfer && (
          <TouchableOpacity style={styles.sellBtn} onPress={onSell}>
            <Text style={styles.sellBtnText}>🔄 Sell / Transfer Vehicle</Text>
          </TouchableOpacity>
        )}

        {/* History filter bar */}
        {records.length > 0 && (
          <View style={styles.filterBar}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search records (e.g. Oil, Brake, Tyre...)"
              placeholderTextColor="#aaa"
              value={historySearch}
              onChangeText={setHistorySearch}
              clearButtonMode="while-editing"
            />
            <View style={styles.filterChips}>
              {(['all', '1y', '6m', '3m'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, historyDateFilter === f && styles.filterChipActive]}
                  onPress={() => setHistoryDateFilter(f)}
                >
                  <Text style={[styles.filterChipText, historyDateFilter === f && styles.filterChipTextActive]}>
                    {f === 'all' ? 'All' : f === '1y' ? '1 Year' : f === '6m' ? '6 Months' : '3 Months'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(historySearch.trim() || historyDateFilter !== 'all') && (
              <Text style={styles.filterCount}>
                {filteredRecords.length} of {records.length} records
              </Text>
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
        ) : records.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyText}>No service records yet</Text>
            <Text style={styles.emptySubText}>Tap "Add Service" above to log your first service</Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyText}>No records match your filter</Text>
            <TouchableOpacity onPress={() => { setHistorySearch(''); setHistoryDateFilter('all') }}>
              <Text style={styles.filterClearLink}>Clear filter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredRecords.map(item => renderRecord({ item }))
        )}

        {/* Expense History */}
        {expenses.length > 0 && (
          <View style={styles.expenseSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Expense History</Text>
              <Text style={styles.sectionCount}>{expenses.length} records</Text>
            </View>
            {expenses.map(exp => (
              <View key={exp.id} style={styles.expenseCard}>
                <View style={styles.expenseTop}>
                  <View style={styles.expenseCatBadge}>
                    <Text style={styles.expenseCatText}>{exp.category}</Text>
                  </View>
                  <Text style={styles.expenseAmount}>LKR {exp.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.expenseMeta}>
                  <Text style={styles.expenseDate}>{new Date(exp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  {exp.mileage != null && <Text style={styles.expenseKm}>{exp.mileage.toLocaleString()} km</Text>}
                </View>
                {exp.notes && <Text style={styles.expenseNotes}>{exp.notes}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Full-screen photo viewer */}
      <Modal visible={!!photoViewer} transparent animationType="fade" onRequestClose={closePhotoViewer} statusBarTranslucent>
        {photoViewer && (() => {
          const { photos, label } = photoViewer
          const SCREEN_W = Dimensions.get('window').width
          return (
            <View style={styles.photoModalBg}>
              {/* Header */}
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalLabel} numberOfLines={1}>{label}</Text>
                <TouchableOpacity onPress={closePhotoViewer} style={styles.photoModalClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.photoModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Swipeable photos */}
              <FlatList
                ref={photoViewerRef}
                data={photos}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={photoViewer.index}
                getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
                  setPhotoViewerIndex(idx)
                }}
                renderItem={({ item: url }) => (
                  <View style={{ width: SCREEN_W, justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: SCREEN_W, height: '100%' }} resizeMode="contain" />
                  </View>
                )}
                style={{ flex: 1 }}
              />

              {/* Counter + nav row */}
              <View style={styles.photoModalFooter}>
                <TouchableOpacity
                  disabled={photoViewerIndex === 0}
                  onPress={() => {
                    const newIdx = photoViewerIndex - 1
                    photoViewerRef.current?.scrollToIndex({ index: newIdx, animated: true })
                    setPhotoViewerIndex(newIdx)
                  }}
                  style={[styles.photoNavBtn, photoViewerIndex === 0 && styles.photoNavBtnDisabled]}
                >
                  <Text style={styles.photoNavText}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.photoCounter}>{photoViewerIndex + 1} / {photos.length}</Text>

                <TouchableOpacity
                  disabled={photoViewerIndex === photos.length - 1}
                  onPress={() => {
                    const newIdx = photoViewerIndex + 1
                    photoViewerRef.current?.scrollToIndex({ index: newIdx, animated: true })
                    setPhotoViewerIndex(newIdx)
                  }}
                  style={[styles.photoNavBtn, photoViewerIndex === photos.length - 1 && styles.photoNavBtnDisabled]}
                >
                  <Text style={styles.photoNavText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })()}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 40 },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 16 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  regNo: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  vehicleCard: {
    backgroundColor: '#1a73e8', margin: 16, marginBottom: 10, borderRadius: 14, padding: 20,
  },
  vehicleName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  vehicleRow: { flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'center' },
  vehicleDetail: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  mileageRow: { flexDirection: 'row', alignItems: 'center' },
  mileageEditHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  mileageEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  mileageInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  mileageSaveBtn: {
    backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  mileageSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mileageCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  mileageCancelBtnText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  quickBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bookBtn: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Sparkline cards
  sparkRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
  },
  sparkCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sparkTitle: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  sparkValue: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 6 },
  sparkUnit: { fontSize: 11, fontWeight: '500', color: '#888' },
  sparkTrend: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  sectionHeader: {
    paddingHorizontal: 16, marginBottom: 8, marginTop: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  filterBar: { marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  filterInput: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: '#1a1a1a', borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 8,
  },
  filterChips: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0',
  },
  filterChipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  filterChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterCount: { fontSize: 11, color: '#888', marginTop: 6 },
  filterClearLink: { fontSize: 13, color: '#1a73e8', fontWeight: '600', textAlign: 'center', marginTop: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  sectionCount: { fontSize: 12, color: '#888', fontWeight: '600' },
  expenseSection: { paddingBottom: 8 },
  expenseCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  expenseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  expenseCatBadge: { backgroundColor: '#f0f4ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  expenseCatText: { fontSize: 12, fontWeight: '700', color: '#1a73e8' },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  expenseMeta: { flexDirection: 'row', gap: 12 },
  expenseDate: { fontSize: 12, color: '#888' },
  expenseKm: { fontSize: 12, color: '#aaa' },
  expenseNotes: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, minWidth: 36, justifyContent: 'center',
  },
  exportBtnDisabled: { opacity: 0.4 },
  exportBtnText: { fontSize: 12, color: '#1a73e8', fontWeight: '700' },
  loader: { marginTop: 40 },
  emptyInline: { alignItems: 'center', padding: 32, marginTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#888', textAlign: 'center' },
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
    paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200,
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
  sellBtn: {
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#c62828', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff',
  },
  sellBtnText: { fontSize: 14, color: '#c62828', fontWeight: '700' },
  predCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  predCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  predCardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  predCardLink: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  predAllOk: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  predItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  predDot: { width: 8, height: 8, borderRadius: 4 },
  predItemName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  predItemDetail: { fontSize: 12, color: '#888', marginTop: 1 },
  predStatus: { fontSize: 16 },

  submissionsSection: { marginHorizontal: 16, marginTop: 10, marginBottom: 8 },
  submissionsSectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#c62828',
    marginBottom: 10, letterSpacing: 0.3,
  },
  submissionCard: {
    backgroundColor: '#fef9f9', borderRadius: 12, padding: 14,
    marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#c62828',
    borderWidth: 1, borderColor: '#ffcdd2',
  },
  submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  submissionGarage: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  submissionDate: { fontSize: 12, color: '#888' },
  submissionMeta: { fontSize: 12, color: '#555', marginTop: 4 },
  submissionCost: { fontSize: 14, fontWeight: '700', color: '#e65100', marginTop: 6 },
  submissionNotes: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 4 },
  acceptBtn: {
    backgroundColor: '#2e7d32', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  messagesToggle: {
    paddingVertical: 10, alignItems: 'center', marginTop: 6,
    borderTopWidth: 1, borderTopColor: '#ffcdd2',
  },
  messagesToggleText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  messagesSection: {
    marginTop: 6, backgroundColor: '#f8f8f8', borderRadius: 8, padding: 10,
  },
  noMessages: { fontSize: 13, color: '#aaa', textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },
  messageItem: {
    backgroundColor: '#e8f0fe', borderRadius: 8, padding: 10, marginBottom: 6, alignSelf: 'flex-end', maxWidth: '85%',
  },
  messageItemThem: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  messageSender: { fontSize: 10, color: '#888', marginBottom: 2, fontWeight: '600' },
  messageText: { fontSize: 13, color: '#1a1a1a', lineHeight: 18 },
  messageTime: { fontSize: 10, color: '#aaa', marginTop: 3, alignSelf: 'flex-end' },
  messageInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  messageInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, borderWidth: 1, borderColor: '#e0e0e0',
  },
  messageSendBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  messageSendBtnDisabled: { opacity: 0.4 },
  messageSendBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // My Appointments section
  appointmentsSection: { marginHorizontal: 16, marginBottom: 10 },
  appointmentsSectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#1a73e8',
    marginBottom: 10, letterSpacing: 0.3,
  },
  appointmentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderLeftWidth: 4,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  appointmentHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  appointmentGarage: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  appointmentDateTime: { fontSize: 13, color: '#555' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  serviceTypeChip: {
    alignSelf: 'flex-start', backgroundColor: '#f0f4ff', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  serviceTypeChipText: { fontSize: 12, color: '#1a73e8', fontWeight: '600' },
  appointmentNotes: { fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 8 },
  appointmentActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
  },
  messagesToggleSmall: { paddingVertical: 6, paddingHorizontal: 4 },
  messagesToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  messagesToggleSmallText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  msgDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#e53935',
  },
  cancelBkBtn: {
    borderWidth: 1.5, borderColor: '#c62828', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  cancelBkBtnDisabled: { opacity: 0.5 },
  cancelBkBtnText: { fontSize: 12, color: '#c62828', fontWeight: '700' },
  photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  recordThumb: { width: 72, height: 72, borderRadius: 8 },
  thumbCountBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  thumbCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photoModalBg: { flex: 1, backgroundColor: '#000' },
  photoModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoModalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, flex: 1, marginRight: 12 },
  photoModalClose: { padding: 4 },
  photoModalCloseText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  photoModalFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
    paddingVertical: 18, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoCounter: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 50, textAlign: 'center' },
  photoNavBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  photoNavBtnDisabled: { opacity: 0.25 },
  photoNavText: { color: '#fff', fontSize: 36, lineHeight: 38, fontWeight: '300' },
})
