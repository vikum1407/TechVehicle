import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'
import {
  SelectedItem, NO_BRAND_ITEMS, ITEM_BRANDS, CATEGORY_BRANDS,
  SERVICE_CATEGORIES, todayDMY, parseDMY,
} from '../constants/serviceData'

type Props = {
  token: string
  onBack: () => void
}

type Garage = {
  id: string
  name: string
  address: string | null
  brNumber: string | null
  verified: boolean
  createdAt: string
}

type SharedRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  cost: number | null
}

type IncomingShare = {
  id: string
  vehicleId: string
  createdAt: string
  ownerPhone: string
  avgFuelEfficiency: number | null
  totalServiceCost: number
  vehicle: {
    registrationNo: string
    make: string
    model: string
    year: number
    fuelType: string
    mileage: number
  }
  records: SharedRecord[]
}

type Tab = 'profile' | 'shared'

export default function GarageScreen({ token, onBack }: Props) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('profile')
  const [shares, setShares] = useState<IncomingShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [expandedShare, setExpandedShare] = useState<string | null>(null)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  // Garage profile form
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [brNumber, setBrNumber] = useState('')

  // Full submission form — shown when a share is being submitted
  const [submittingShare, setSubmittingShare] = useState<IncomingShare | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [otherText, setOtherText] = useState('')
  const [customBrands, setCustomBrands] = useState<Record<string, string>>({})
  const [subDate, setSubDate] = useState(todayDMY())
  const [subMileage, setSubMileage] = useState('')
  const [subCost, setSubCost] = useState('')
  const [subNotes, setSubNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.getGarage(token)
      .then(data => {
        setGarage(data)
        setName(data.name)
        setAddress(data.address || '')
        setBrNumber(data.brNumber || '')
      })
      .catch(e => {
        if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadShares = async () => {
    setSharesLoading(true)
    try {
      const data = await api.getIncomingShares(token)
      setShares(data)
    } catch (e: any) {
      if (!e.message.includes('No garage')) Alert.alert('Error', e.message)
    } finally {
      setSharesLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'shared' && garage) loadShares()
  }, [tab, garage])

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
    setSaving(true)
    try {
      const data = await api.registerGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your garage name.'); return }
    setSaving(true)
    try {
      const data = await api.updateGarage(token, { name, address, brNumber })
      setGarage(data)
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const openSubmitForm = (share: IncomingShare) => {
    setSubmittingShare(share)
    setSelectedItems([])
    setOtherText('')
    setCustomBrands({})
    setSubDate(todayDMY())
    setSubMileage(share.vehicle.mileage.toString())
    setSubCost('')
    setSubNotes('')
  }

  const isSelected = (name: string) => selectedItems.some(i => i.name === name)

  const toggleService = (itemName: string, category: string) => {
    if (isSelected(itemName)) {
      setSelectedItems(prev => prev.filter(i => i.name !== itemName))
    } else {
      setSelectedItems(prev => [...prev, { name: itemName, category, brand: '' }])
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

  const handleSubmitService = async () => {
    if (!submittingShare) return
    const extras = otherText.trim()
      ? [{ name: otherText.trim(), category: 'General & Other', brand: '' }]
      : []
    const allItems = [...selectedItems, ...extras]
    if (allItems.length === 0) {
      Alert.alert('Select a service', 'Please tap at least one service that was performed.')
      return
    }
    const isoDate = parseDMY(subDate)
    if (!isoDate) {
      Alert.alert('Invalid date', 'Please enter the date as DD/MM/YYYY.')
      return
    }

    const description = allItems
      .map(i => i.brand ? `${i.name} (${i.brand})` : i.name)
      .join(', ')

    setSubmitting(true)
    try {
      await api.submitService(token, {
        shareSessionId: submittingShare.id,
        vehicleId: submittingShare.vehicleId,
        description,
        cost: subCost ? parseFloat(subCost) : undefined,
        notes: subNotes.trim() || undefined,
      })
      setSubmittedIds(prev => new Set(prev).add(submittingShare.id))
      setSubmittingShare(null)
      Alert.alert('Submitted', 'Service record sent to the vehicle owner for acceptance.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const parseServices = (desc: string) =>
    desc.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  // ── Full-screen submission form ──────────────────────────────────────────
  if (submittingShare) {
    const share = submittingShare
    const itemsNeedingBrand = selectedItems.filter(i => !NO_BRAND_ITEMS.has(i.name))

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formTopRow}>
          <TouchableOpacity onPress={() => setSubmittingShare(null)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.formTitle}>Submit Completed Service</Text>

        {/* Which vehicle */}
        <View style={styles.vehicleBanner}>
          <Text style={styles.vehicleBannerReg}>{share.vehicle.registrationNo}</Text>
          <Text style={styles.vehicleBannerName}>
            {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
          </Text>
          <Text style={styles.vehicleBannerMileage}>{share.vehicle.mileage.toLocaleString()} km · {share.vehicle.fuelType}</Text>
        </View>

        <Text style={styles.formSubtitle}>Tap everything that was done on this visit</Text>

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
          style={styles.fInput}
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
                    style={[styles.fInput, { marginTop: 6 }]}
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
            <Text style={styles.catLabel}>Service Date</Text>
            <TextInput
              style={styles.fInput}
              value={subDate}
              onChangeText={setSubDate}
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.catLabel}>Mileage (km)</Text>
            <TextInput
              style={styles.fInput}
              value={subMileage}
              onChangeText={setSubMileage}
              placeholder="e.g. 45000"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.catLabel}>Total Cost (LKR)</Text>
        <TextInput
          style={styles.fInput}
          value={subCost}
          onChangeText={setSubCost}
          placeholder="e.g. 8500"
          keyboardType="number-pad"
        />

        <Text style={styles.catLabel}>Notes for Owner (optional)</Text>
        <TextInput
          style={[styles.fInput, styles.multiline]}
          value={subNotes}
          onChangeText={setSubNotes}
          placeholder="Any observations, recommendations, or notes..."
          multiline
          numberOfLines={3}
        />

        {selectedItems.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{selectedItems.length} service{selectedItems.length > 1 ? 's' : ''} to submit</Text>
            {selectedItems.map(i => (
              <Text key={i.name} style={styles.summaryLine}>
                • {i.name}{i.brand ? ` — ${i.brand}` : ''}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitServiceBtn, submitting && styles.submitServiceBtnDisabled]}
          onPress={handleSubmitService}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitServiceBtnText}>Submit to Owner</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Normal garage view ───────────────────────────────────────────────────
  const showForm = !garage || editing

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{garage ? garage.name : 'Register Garage'}</Text>
      </View>

      {garage && !editing && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'profile' && styles.tabActive]}
            onPress={() => setTab('profile')}
          >
            <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'shared' && styles.tabActive]}
            onPress={() => setTab('shared')}
          >
            <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared With Me</Text>
          </TouchableOpacity>
        </View>
      )}

      {(tab === 'profile' || !garage) && (
        <ScrollView contentContainerStyle={styles.content}>
          {garage && !editing && (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.garageName}>{garage.name}</Text>
                <View style={[styles.badge, garage.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                  <Text style={styles.badgeText}>
                    {garage.verified ? '✅ Verified Garage' : '⚠️ Unverified'}
                  </Text>
                </View>
                {garage.address && <Text style={styles.detail}>📍 {garage.address}</Text>}
                {garage.brNumber
                  ? <Text style={styles.detail}>🏢 BR: {garage.brNumber}</Text>
                  : <Text style={styles.detailMuted}>No BR number added — add one to get verified</Text>
                }
              </View>

              {!garage.verified && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>How to get Verified</Text>
                  <Text style={styles.infoText}>
                    Add your Business Registration (BR) number and our team will verify your garage.
                    Verified garages earn more trust from vehicle owners.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setName(garage.name)
                  setAddress(garage.address || '')
                  setBrNumber(garage.brNumber || '')
                  setEditing(true)
                }}
              >
                <Text style={styles.editBtnText}>Edit Garage Details</Text>
              </TouchableOpacity>
            </>
          )}

          {showForm && (
            <>
              <Text style={styles.formTitle}>{garage ? 'Edit Garage' : 'Register Your Garage'}</Text>
              <Text style={styles.formSubtitleSmall}>
                {garage
                  ? 'Update your garage details below.'
                  : 'Set up your garage profile so vehicle owners can find and share records with you.'}
              </Text>

              <Text style={styles.label}>Garage Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Silva Auto Service" />

              <Text style={styles.label}>Address (optional)</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 45/A Kandy Road, Kelaniya" />

              <Text style={styles.label}>BR Number (optional)</Text>
              <TextInput style={styles.input} value={brNumber} onChangeText={setBrNumber} placeholder="e.g. PV 00123456" autoCapitalize="characters" />

              <View style={styles.brNote}>
                <Text style={styles.brNoteText}>
                  Adding your BR number earns a ✅ Verified badge, building trust with vehicle owners.
                </Text>
              </View>

              {editing && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={garage ? handleUpdate : handleRegister}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>{garage ? 'Save Changes' : 'Register Garage'}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {tab === 'shared' && garage && (
        <ScrollView contentContainerStyle={styles.content}>
          {sharesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a73e8" />
          ) : shares.length === 0 ? (
            <View style={styles.emptyShares}>
              <Text style={styles.emptySharesTitle}>No shared records yet</Text>
              <Text style={styles.emptySharesText}>
                When vehicle owners share their service history with your garage, it will appear here.
              </Text>
            </View>
          ) : shares.map(share => {
            const isExpanded = expandedShare === share.id
            return (
              <TouchableOpacity
                key={share.id}
                style={styles.shareCard}
                onPress={() => setExpandedShare(isExpanded ? null : share.id)}
                activeOpacity={0.8}
              >
                <View style={styles.shareCardTop}>
                  <View>
                    <Text style={styles.shareVehicle}>
                      {share.vehicle.year} {share.vehicle.make} {share.vehicle.model}
                    </Text>
                    <Text style={styles.shareReg}>{share.vehicle.registrationNo}</Text>
                  </View>
                  <View style={styles.shareRight}>
                    <Text style={styles.shareRecordCount}>{share.records.length} records</Text>
                    <Text style={styles.shareMileage}>{share.vehicle.mileage.toLocaleString()} km</Text>
                  </View>
                </View>
                <Text style={styles.shareDate}>Shared {formatDate(share.createdAt)}</Text>

                {isExpanded && (
                  <View style={styles.shareRecords}>
                    {/* Vehicle Profile */}
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>Vehicle Profile</Text>
                      <View style={styles.profileGrid}>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Registration</Text>
                          <Text style={styles.profileValueHighlight}>{share.vehicle.registrationNo}</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Fuel Type</Text>
                          <Text style={styles.profileValue}>{share.vehicle.fuelType}</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Current Mileage</Text>
                          <Text style={styles.profileValue}>{share.vehicle.mileage.toLocaleString()} km</Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Fuel Economy</Text>
                          <Text style={styles.profileValue}>
                            {share.avgFuelEfficiency != null ? `${share.avgFuelEfficiency} km/L` : 'No data yet'}
                          </Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Owner Contact</Text>
                          <Text style={styles.profileValue}>{share.ownerPhone}</Text>
                        </View>
                        {share.totalServiceCost > 0 && (
                          <View style={styles.profileItem}>
                            <Text style={styles.profileLabel}>Total Service Cost</Text>
                            <Text style={styles.profileValue}>LKR {share.totalServiceCost.toLocaleString()}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Shared Records */}
                    <Text style={styles.recordsSectionTitle}>
                      Shared Service Records ({share.records.length})
                    </Text>
                    {share.records.map(r => {
                      const services = parseServices(r.description)
                      return (
                        <View key={r.id} style={styles.sharedRecord}>
                          <View style={styles.sharedRecordTop}>
                            <Text style={styles.sharedRecordDate}>{formatDate(r.date)}</Text>
                            {r.cost != null && (
                              <Text style={styles.sharedRecordCost}>LKR {r.cost.toLocaleString()}</Text>
                            )}
                          </View>
                          <View style={styles.tagRow}>
                            {services.map((s, i) => (
                              <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{s}</Text>
                              </View>
                            ))}
                          </View>
                          {r.mileage && <Text style={styles.sharedRecordMileage}>{r.mileage.toLocaleString()} km</Text>}
                        </View>
                      )
                    })}

                    {/* Submit button */}
                    <View style={styles.submitArea}>
                      {submittedIds.has(share.id) ? (
                        <View style={styles.submittedBadge}>
                          <Text style={styles.submittedText}>✓ Submitted to owner</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.openSubmitBtn}
                          onPress={() => openSubmitForm(share)}
                        >
                          <Text style={styles.openSubmitBtnText}>Submit Completed Service</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.collapseHint}>Tap card to collapse</Text>
                  </View>
                )}

                {!isExpanded && (
                  <Text style={styles.expandHint}>Tap to see shared records</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Submission form
  formContent: { padding: 20, paddingBottom: 56 },
  formTopRow: { marginTop: 48, marginBottom: 8 },
  formTitle: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  formSubtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  formSubtitleSmall: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  vehicleBanner: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 16, marginBottom: 20,
  },
  vehicleBannerReg: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  vehicleBannerName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  vehicleBannerMileage: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
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
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: '#e8f0fe',
  },
  brandsSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 2 },
  brandsSectionSub: { fontSize: 12, color: '#888', marginBottom: 12 },
  brandRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 14, marginTop: 14 },
  brandItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  brandChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18, borderWidth: 1.5,
    borderColor: '#e0e0e0', backgroundColor: '#f9f9f9',
  },
  brandChipSelected: { backgroundColor: '#34a853', borderColor: '#34a853' },
  brandChipText: { fontSize: 12, color: '#555' },
  brandChipTextSelected: { color: '#fff', fontWeight: '600' },
  fInput: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  summary: { backgroundColor: '#e6f4ea', borderRadius: 12, padding: 16, marginTop: 20 },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
  summaryLine: { fontSize: 13, color: '#333', marginBottom: 4, lineHeight: 20 },
  submitServiceBtn: {
    backgroundColor: '#2e7d32', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  submitServiceBtnDisabled: { opacity: 0.6 },
  submitServiceBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Normal garage view
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a73e8' },
  content: { padding: 20, paddingBottom: 48 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  garageName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14 },
  badgeVerified: { backgroundColor: '#e6f4ea' },
  badgeUnverified: { backgroundColor: '#fff8e1' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 14, color: '#555', marginBottom: 6 },
  detailMuted: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  infoBox: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1a73e8', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#333', lineHeight: 20 },
  editBtn: {
    borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: 15, color: '#1a73e8', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
  },
  brNote: { backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginTop: 14 },
  brNoteText: { fontSize: 13, color: '#1a73e8', lineHeight: 19 },
  cancelBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  cancelBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyShares: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptySharesTitle: { fontSize: 17, fontWeight: '700', color: '#555', marginBottom: 10 },
  emptySharesText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  shareCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  shareCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  shareVehicle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  shareReg: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  shareRight: { alignItems: 'flex-end' },
  shareRecordCount: { fontSize: 13, fontWeight: '700', color: '#1a73e8' },
  shareMileage: { fontSize: 12, color: '#888', marginTop: 2 },
  shareDate: { fontSize: 12, color: '#aaa', marginBottom: 6 },
  expandHint: { fontSize: 11, color: '#bbb', marginTop: 4 },
  shareRecords: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  sharedRecord: { marginBottom: 12 },
  sharedRecordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sharedRecordDate: { fontSize: 12, color: '#888', fontWeight: '600' },
  sharedRecordCost: { fontSize: 12, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: { backgroundColor: '#f0f4ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#333' },
  sharedRecordMileage: { fontSize: 11, color: '#aaa' },
  collapseHint: { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'center' },
  profileSection: { backgroundColor: '#f0f6ff', borderRadius: 10, padding: 14, marginBottom: 14 },
  profileSectionTitle: { fontSize: 12, fontWeight: '700', color: '#1a73e8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileItem: { width: '47%' },
  profileLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 2 },
  profileValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  profileValueHighlight: { fontSize: 14, color: '#1a73e8', fontWeight: '800' },
  recordsSectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  submitArea: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingTop: 14 },
  submittedBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, alignItems: 'center' },
  submittedText: { fontSize: 14, color: '#2e7d32', fontWeight: '700' },
  openSubmitBtn: { backgroundColor: '#2e7d32', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  openSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
