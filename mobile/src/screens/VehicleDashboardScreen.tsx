import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
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

type TopPrediction = {
  id: string
  name: string
  status: 'overdue' | 'due_soon'
  remainingKm: number | null
  remainingDays: number | null
}

type Props = {
  token: string
  vehicle: Vehicle
  onBack: () => void
  onAddRecord: () => void
  onLogFuel: () => void
  onAddExpense: () => void
  onAnalytics: () => void
  onPredictions: () => void
  onMileageUpdated: (newMileage: number) => void
  onShare: () => void
  onSell: () => void
  onBookService: () => void
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

export default function VehicleDashboardScreen({ token, vehicle, onBack, onAddRecord, onLogFuel, onAddExpense, onAnalytics, onPredictions, onMileageUpdated, onShare, onSell, onBookService }: Props) {
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

  const loadRecords = async () => {
    setLoading(true)
    try {
      const [recs, subs, transfer, analytics, preds] = await Promise.all([
        api.getServiceRecords(token, vehicle.id),
        api.getVehicleSubmissions(token, vehicle.id),
        api.getVehicleTransfer(token, vehicle.id),
        api.getAnalytics(token, vehicle.id).catch(() => null),
        api.getPredictions(token, vehicle.id).catch(() => []),
      ])
      setRecords(recs)
      setSubmissions(subs)
      setPendingTransfer(transfer)
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
    if (bookingNotes[sub.bookingId!]) return
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

  useEffect(() => { loadRecords() }, [])

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
              <Text style={styles.quickBtnText}>📊 Analytics</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.bookBtn} onPress={onBookService}>
            <Text style={styles.bookBtnText}>📅 Book Service Appointment</Text>
          </TouchableOpacity>
        </View>

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
                              note.senderPhone === '' ? styles.messageItemThem : undefined,
                            ]}
                          >
                            <Text style={styles.messageSender}>
                              {note.senderPhone === '' ? 'Garage' : 'You'}
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
        </View>

        {!pendingTransfer && (
          <TouchableOpacity style={styles.sellBtn} onPress={onSell}>
            <Text style={styles.sellBtnText}>🔄 Sell / Transfer Vehicle</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#1a73e8" />
        ) : records.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyText}>No service records yet</Text>
            <Text style={styles.emptySubText}>Tap "Add Service" above to log your first service</Text>
          </View>
        ) : (
          records.map(item => renderRecord({ item }))
        )}
      </ScrollView>
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
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
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
})
