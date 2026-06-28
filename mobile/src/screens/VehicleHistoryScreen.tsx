import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Modal, FlatList, Dimensions,
} from 'react-native'
import { api } from '../config/api'
import { exportVehiclePdf } from '../utils/pdfExport'

type Tab = 'service' | 'expenses' | 'fuel'

type ServiceRecord = {
  id: string; date: string; description: string
  mileage: number | null; parts: string | null; brand: string | null
  cost: number | null; notes: string | null; photos: string[]
}

type Expense = {
  id: string; date: string; category: string
  amount: number; description: string | null
  mileage: number | null; notes: string | null
}

type FuelLog = {
  id: string; date: string; mileage: number | null
  litres: number | null; cost: number | null; station?: string | null
}

type Vehicle = {
  id: string; registrationNo: string; make: string; model: string
  year: number; fuelType: string; mileage: number
}

type Props = {
  token: string
  vehicle: Vehicle
  onBack: () => void
}

const EXPENSE_CATEGORIES = [
  'All', 'Insurance', 'Revenue Licence', 'Emission Test', 'Fine',
  'Parking', 'Toll', 'Accessories', 'Washing', 'Other',
]

function fmt(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return isoDate }
}

function parseItems(description: string) {
  return description.split(',').map(s => s.trim()).filter(Boolean)
}

export default function VehicleHistoryScreen({ token, vehicle, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('service')
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([])
  const [loading, setLoading] = useState(true)

  // Service tab state
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | '1y' | '6m' | '3m'>('all')
  const [catFilter, setCatFilter] = useState('All')
  const [mileageMin, setMileageMin] = useState('')
  const [mileageMax, setMileageMax] = useState('')
  const [showMileageFilter, setShowMileageFilter] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Expense tab state
  const [expCatFilter, setExpCatFilter] = useState('All')
  const [expDateFilter, setExpDateFilter] = useState<'all' | '1y' | '6m' | '3m'>('all')
  const [expSearch, setExpSearch] = useState('')

  // Fuel tab state
  const [fuelDateFilter, setFuelDateFilter] = useState<'all' | '1y' | '6m' | '3m'>('all')
  const [fuelSearch, setFuelSearch] = useState('')

  // Photo viewer
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number; label: string } | null>(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const photoViewerRef = useRef<FlatList<string>>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [recs, exps, fuels] = await Promise.all([
        api.getServiceRecords(token, vehicle.id).catch(() => []),
        api.getExpenses(token, vehicle.id).catch(() => []),
        api.getFuelLogs(token, vehicle.id).catch(() => []),
      ])
      setRecords(Array.isArray(recs) ? recs : [])
      setExpenses(Array.isArray(exps) ? exps : [])
      setFuelLogs(Array.isArray(fuels) ? fuels : [])
    } catch (e: any) {
      // data loads individually with catch — error is silent
    } finally {
      setLoading(false)
    }
  }, [token, vehicle.id])

  useEffect(() => { loadAll() }, [loadAll])

  // Unique categories extracted from service records
  const serviceCategories = ['All', ...Array.from(new Set(
    records.flatMap(r => r.description.split(',').map(c => c.trim()).filter(Boolean))
  )).sort()]

  // Filtered service records
  const filteredRecords = records.filter(r => {
    if (search.trim() && !r.description.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter !== 'All') {
      const cats = r.description.split(',').map(c => c.trim())
      if (!cats.some(c => c.toLowerCase() === catFilter.toLowerCase())) return false
    }
    if (dateFilter !== 'all') {
      const months = dateFilter === '1y' ? 12 : dateFilter === '6m' ? 6 : 3
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(r.date) < cutoff) return false
    }
    if (mileageMin.trim() && r.mileage != null && r.mileage < Number(mileageMin)) return false
    if (mileageMax.trim() && r.mileage != null && r.mileage > Number(mileageMax)) return false
    return true
  })

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (expCatFilter !== 'All' && e.category !== expCatFilter) return false
    if (expSearch.trim() && !(e.description ?? '').toLowerCase().includes(expSearch.toLowerCase()) &&
        !e.category.toLowerCase().includes(expSearch.toLowerCase())) return false
    if (expDateFilter !== 'all') {
      const months = expDateFilter === '1y' ? 12 : expDateFilter === '6m' ? 6 : 3
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(e.date) < cutoff) return false
    }
    return true
  })
  const expenseTotal = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  // Filtered fuel logs
  const filteredFuelLogs = fuelLogs.filter(f => {
    if (fuelSearch.trim() && !(f.station ?? '').toLowerCase().includes(fuelSearch.toLowerCase())) return false
    if (fuelDateFilter !== 'all') {
      const months = fuelDateFilter === '1y' ? 12 : fuelDateFilter === '6m' ? 6 : 3
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(f.date) < cutoff) return false
    }
    return true
  })

  // Fuel summary
  const logsWithKm = filteredFuelLogs.filter(f => f.litres && f.litres > 0 && f.mileage)
  const avgKmPerL = logsWithKm.length >= 2 ? (() => {
    const sorted = [...logsWithKm].sort((a, b) => (a.mileage ?? 0) - (b.mileage ?? 0))
    const first = sorted[0], last = sorted[sorted.length - 1]
    const totalKm = (last.mileage ?? 0) - (first.mileage ?? 0)
    const totalL = sorted.slice(1).reduce((s, f) => s + (f.litres ?? 0), 0)
    return totalL > 0 ? (totalKm / totalL).toFixed(1) : null
  })() : null
  const totalFuelCost = filteredFuelLogs.reduce((s, f) => s + (f.cost ?? 0), 0)

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await exportVehiclePdf(vehicle, records, fuelLogs, expenses)
    } catch (e: any) {
      const { Alert } = require('react-native')
      Alert.alert('Export failed', e.message || 'Could not generate PDF')
    } finally {
      setExporting(false)
    }
  }

  const openPhotos = (photos: string[], idx: number, label: string) => {
    setPhotoViewer({ photos, index: idx, label })
    setPhotoViewerIndex(idx)
  }

  const renderRecord = (r: ServiceRecord) => {
    const isExpanded = expandedId === r.id
    const items = parseItems(r.description)
    const preview = items.slice(0, 2)
    const extra = items.length - 2

    return (
      <TouchableOpacity
        key={r.id}
        style={s.card}
        onPress={() => setExpandedId(isExpanded ? null : r.id)}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <Text style={s.cardDate}>{fmt(r.date)}</Text>
          {r.cost != null && <Text style={s.cardCost}>LKR {r.cost.toLocaleString()}</Text>}
        </View>

        {!isExpanded ? (
          <View>
            <View style={s.tagRow}>
              {preview.map((item, i) => (
                <View key={i} style={s.tag}><Text style={s.tagText} numberOfLines={1}>{item}</Text></View>
              ))}
              {extra > 0 && <View style={s.tagMore}><Text style={s.tagMoreText}>+{extra} more</Text></View>}
            </View>
            {r.mileage != null && <Text style={s.cardMeta}>{r.mileage.toLocaleString()} km</Text>}
          </View>
        ) : (
          <View>
            {items.map((item, i) => (
              <Text key={i} style={s.expandedItem}>• {item}</Text>
            ))}
            {r.mileage != null && <Text style={s.cardMeta}>{r.mileage.toLocaleString()} km</Text>}
            {r.notes && <Text style={s.cardNotes}>{r.notes}</Text>}
            {r.photos && r.photos.length > 0 && (
              <View style={s.photoStrip}>
                {r.photos.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => openPhotos(r.photos, i, r.description)} activeOpacity={0.8}>
                    <Image source={{ uri: url }} style={s.thumb} />
                    {r.photos.length > 1 && i === 0 && (
                      <View style={s.thumbBadge}><Text style={s.thumbBadgeText}>{r.photos.length}</Text></View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={s.collapseHint}>Tap to collapse</Text>
          </View>
        )}
        {!isExpanded && items.length > 2 && (
          <Text style={s.expandHint}>Tap to see all</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text style={s.headerSub}>{vehicle.registrationNo} · History</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {([
          { key: 'service', label: `📋 Service (${records.length})` },
          { key: 'expenses', label: `💰 Expenses (${expenses.length})` },
          { key: 'fuel', label: `⛽ Fuel (${fuelLogs.length})` },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, activeTab === t.key && s.tabActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a73e8" style={s.loader} />
      ) : (
        <>
          {/* ── Service tab ─────────────────────────────── */}
          {activeTab === 'service' && (
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Search + filter + export */}
              <View style={s.serviceTopRow}>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search (e.g. Oil, Brake, Tyre...)"
                  placeholderTextColor="#aaa"
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
                <TouchableOpacity
                  style={[s.exportBtn, exporting && s.exportBtnDisabled]}
                  onPress={handleExportPdf}
                  disabled={exporting}
                >
                  {exporting
                    ? <ActivityIndicator size="small" color="#1a73e8" />
                    : <Text style={s.exportBtnText}>📄 PDF</Text>
                  }
                </TouchableOpacity>
              </View>

              {/* Date filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterChipsScroll} contentContainerStyle={s.filterChipsContent}>
                {(['all', '1y', '6m', '3m'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, dateFilter === f && s.filterChipActive]}
                    onPress={() => setDateFilter(f)}
                  >
                    <Text style={[s.filterChipText, dateFilter === f && s.filterChipTextActive]}>
                      {f === 'all' ? 'All time' : f === '1y' ? '1 Year' : f === '6m' ? '6 Months' : '3 Months'}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.filterChip, showMileageFilter && s.filterChipActive]}
                  onPress={() => setShowMileageFilter(v => !v)}
                >
                  <Text style={[s.filterChipText, showMileageFilter && s.filterChipTextActive]}>
                    {(mileageMin || mileageMax) ? `${mileageMin || '0'}–${mileageMax || '∞'} km` : '⊕ Mileage'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Mileage range inputs */}
              {showMileageFilter && (
                <View style={s.mileageRow}>
                  <TextInput
                    style={s.mileageInput}
                    placeholder="Min km"
                    placeholderTextColor="#aaa"
                    value={mileageMin}
                    onChangeText={setMileageMin}
                    keyboardType="number-pad"
                  />
                  <Text style={s.mileageSep}>—</Text>
                  <TextInput
                    style={s.mileageInput}
                    placeholder="Max km"
                    placeholderTextColor="#aaa"
                    value={mileageMax}
                    onChangeText={setMileageMax}
                    keyboardType="number-pad"
                  />
                  {(mileageMin || mileageMax) && (
                    <TouchableOpacity onPress={() => { setMileageMin(''); setMileageMax('') }}>
                      <Text style={s.mileageClear}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Category filter chips */}
              {serviceCategories.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catFilterScroll} contentContainerStyle={s.filterChipsContent}>
                  {serviceCategories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[s.filterChip, catFilter === cat && s.filterChipActive]}
                      onPress={() => setCatFilter(cat)}
                    >
                      <Text style={[s.filterChipText, catFilter === cat && s.filterChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {(search.trim() || dateFilter !== 'all' || catFilter !== 'All' || mileageMin || mileageMax) && (
                <View style={s.filterCountRow}>
                  <Text style={s.filterCount}>{filteredRecords.length} of {records.length} records</Text>
                  <TouchableOpacity onPress={() => { setSearch(''); setDateFilter('all'); setCatFilter('All'); setMileageMin(''); setMileageMax(''); setShowMileageFilter(false) }}>
                    <Text style={s.clearLink}>Clear all</Text>
                  </TouchableOpacity>
                </View>
              )}

              {records.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>🔧</Text>
                  <Text style={s.emptyText}>No service records yet</Text>
                  <Text style={s.emptySub}>Tap + Add Record on the dashboard to log your first service</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={onBack}>
                    <Text style={s.emptyBtnText}>← Back to Dashboard</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredRecords.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>🔍</Text>
                  <Text style={s.emptyText}>No records match</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => { setSearch(''); setDateFilter('all'); setCatFilter('All'); setMileageMin(''); setMileageMax(''); setShowMileageFilter(false) }}>
                    <Text style={s.emptyBtnText}>Clear all filters</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredRecords.map(r => renderRecord(r))
              )}
            </ScrollView>
          )}

          {/* ── Expenses tab ─────────────────────────────── */}
          {activeTab === 'expenses' && (
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
              {/* Total summary card */}
              <View style={s.totalCard}>
                <Text style={s.totalLabel}>
                  {expCatFilter === 'All' ? 'Total Expenses' : expCatFilter}
                </Text>
                <Text style={s.totalAmount}>LKR {expenseTotal.toLocaleString()}</Text>
                <Text style={s.totalSub}>{filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}</Text>
              </View>

              {/* Search */}
              <TextInput
                style={s.searchInput}
                placeholder="Search by description..."
                placeholderTextColor="#aaa"
                value={expSearch}
                onChangeText={setExpSearch}
                clearButtonMode="while-editing"
              />

              {/* Date filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterChipsScroll} contentContainerStyle={s.filterChipsContent}>
                {(['all', '1y', '6m', '3m'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, expDateFilter === f && s.filterChipActive]}
                    onPress={() => setExpDateFilter(f)}
                  >
                    <Text style={[s.filterChipText, expDateFilter === f && s.filterChipTextActive]}>
                      {f === 'all' ? 'All time' : f === '1y' ? '1 Year' : f === '6m' ? '6 Months' : '3 Months'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catScrollContent}>
                {EXPENSE_CATEGORIES.map(cat => {
                  const count = cat === 'All' ? expenses.length : expenses.filter(e => e.category === cat).length
                  if (count === 0 && cat !== 'All') return null
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[s.catChip, expCatFilter === cat && s.catChipActive]}
                      onPress={() => setExpCatFilter(cat)}
                    >
                      <Text style={[s.catChipText, expCatFilter === cat && s.catChipTextActive]}>
                        {cat} {cat !== 'All' ? `(${count})` : ''}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {(expSearch.trim() || expDateFilter !== 'all' || expCatFilter !== 'All') && (
                <View style={s.filterCountRow}>
                  <Text style={s.filterCount}>{filteredExpenses.length} of {expenses.length} expenses</Text>
                  <TouchableOpacity onPress={() => { setExpSearch(''); setExpDateFilter('all'); setExpCatFilter('All') }}>
                    <Text style={s.clearLink}>Clear all</Text>
                  </TouchableOpacity>
                </View>
              )}

              {expenses.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>💰</Text>
                  <Text style={s.emptyText}>No expenses yet</Text>
                  <Text style={s.emptySub}>Tap Add Expense on the dashboard to track insurance, fuel, and other costs</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={onBack}>
                    <Text style={s.emptyBtnText}>← Back to Dashboard</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredExpenses.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>🔍</Text>
                  <Text style={s.emptyText}>No expenses match</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => { setExpSearch(''); setExpDateFilter('all'); setExpCatFilter('All') }}>
                    <Text style={s.emptyBtnText}>Clear all filters</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredExpenses.map(exp => (
                  <View key={exp.id} style={s.expCard}>
                    <View style={s.expTop}>
                      <View style={s.expCatBadge}>
                        <Text style={s.expCatText}>{exp.category}</Text>
                      </View>
                      <Text style={s.expAmount}>LKR {exp.amount.toLocaleString()}</Text>
                    </View>
                    <View style={s.expMeta}>
                      <Text style={s.expDate}>{fmt(exp.date)}</Text>
                      {exp.mileage != null && <Text style={s.expKm}>{exp.mileage.toLocaleString()} km</Text>}
                    </View>
                    {exp.notes && <Text style={s.expNotes}>{exp.notes}</Text>}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* ── Fuel tab ─────────────────────────────── */}
          {activeTab === 'fuel' && (
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
              {/* Search + date filter */}
              <TextInput
                style={s.searchInput}
                placeholder="Search by station name..."
                placeholderTextColor="#aaa"
                value={fuelSearch}
                onChangeText={setFuelSearch}
                clearButtonMode="while-editing"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterChipsScroll} contentContainerStyle={s.filterChipsContent}>
                {(['all', '1y', '6m', '3m'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, fuelDateFilter === f && s.filterChipActive]}
                    onPress={() => setFuelDateFilter(f)}
                  >
                    <Text style={[s.filterChipText, fuelDateFilter === f && s.filterChipTextActive]}>
                      {f === 'all' ? 'All time' : f === '1y' ? '1 Year' : f === '6m' ? '6 Months' : '3 Months'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {(fuelSearch.trim() || fuelDateFilter !== 'all') && (
                <View style={s.filterCountRow}>
                  <Text style={s.filterCount}>{filteredFuelLogs.length} of {fuelLogs.length} fill-ups</Text>
                  <TouchableOpacity onPress={() => { setFuelSearch(''); setFuelDateFilter('all') }}>
                    <Text style={s.clearLink}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Summary — based on filtered set */}
              {filteredFuelLogs.length > 0 && (
                <View style={s.fuelSummary}>
                  <View style={s.fuelStat}>
                    <Text style={s.fuelStatVal}>{filteredFuelLogs.length}</Text>
                    <Text style={s.fuelStatLabel}>Fill-ups</Text>
                  </View>
                  {avgKmPerL && (
                    <View style={s.fuelStat}>
                      <Text style={s.fuelStatVal}>{avgKmPerL}</Text>
                      <Text style={s.fuelStatLabel}>Avg km/L</Text>
                    </View>
                  )}
                  {totalFuelCost > 0 && (
                    <View style={s.fuelStat}>
                      <Text style={s.fuelStatVal}>LKR {totalFuelCost.toLocaleString()}</Text>
                      <Text style={s.fuelStatLabel}>Total spent</Text>
                    </View>
                  )}
                </View>
              )}

              {fuelLogs.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>⛽</Text>
                  <Text style={s.emptyText}>No fuel logs yet</Text>
                  <Text style={s.emptySub}>Tap Log Fuel on the dashboard to start tracking efficiency and mileage</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={onBack}>
                    <Text style={s.emptyBtnText}>← Back to Dashboard</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredFuelLogs.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>🔍</Text>
                  <Text style={s.emptyText}>No fill-ups match</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => { setFuelSearch(''); setFuelDateFilter('all') }}>
                    <Text style={s.emptyBtnText}>Clear filters</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredFuelLogs.map(f => (
                  <View key={f.id} style={s.fuelCard}>
                    <View style={s.fuelCardTop}>
                      <Text style={s.fuelDate}>{fmt(f.date)}</Text>
                      {f.cost != null && <Text style={s.fuelCost}>LKR {f.cost.toLocaleString()}</Text>}
                    </View>
                    <View style={s.fuelCardMeta}>
                      {f.mileage != null && <Text style={s.fuelMeta}>{f.mileage.toLocaleString()} km</Text>}
                      {f.litres != null && <Text style={s.fuelMeta}>{f.litres} L</Text>}
                      {f.litres && f.litres > 0 && f.mileage && (
                        <Text style={s.fuelKmL}>—</Text>
                      )}
                    </View>
                    {f.station && <Text style={s.fuelStation}>{f.station}</Text>}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* Full-screen photo viewer */}
      <Modal visible={!!photoViewer} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)} statusBarTranslucent>
        {photoViewer && (() => {
          const { photos, label } = photoViewer
          const W = Dimensions.get('window').width
          return (
            <View style={s.photoModalBg}>
              <View style={s.photoModalHeader}>
                <Text style={s.photoModalLabel} numberOfLines={1}>{label}</Text>
                <TouchableOpacity onPress={() => setPhotoViewer(null)} style={s.photoModalClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={s.photoModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                ref={photoViewerRef}
                data={photos}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                initialScrollIndex={photoViewer.index}
                getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
                onMomentumScrollEnd={e => {
                  setPhotoViewerIndex(Math.round(e.nativeEvent.contentOffset.x / W))
                }}
                renderItem={({ item: url }) => (
                  <View style={{ width: W, justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: W, height: '100%' }} resizeMode="contain" />
                  </View>
                )}
                style={{ flex: 1 }}
              />
              <View style={s.photoModalFooter}>
                <TouchableOpacity
                  disabled={photoViewerIndex === 0}
                  onPress={() => {
                    const i = photoViewerIndex - 1
                    photoViewerRef.current?.scrollToIndex({ index: i, animated: true })
                    setPhotoViewerIndex(i)
                  }}
                  style={[s.photoNavBtn, photoViewerIndex === 0 && s.photoNavBtnDisabled]}
                >
                  <Text style={s.photoNavText}>‹</Text>
                </TouchableOpacity>
                <Text style={s.photoCounter}>{photoViewerIndex + 1} / {photos.length}</Text>
                <TouchableOpacity
                  disabled={photoViewerIndex === photos.length - 1}
                  onPress={() => {
                    const i = photoViewerIndex + 1
                    photoViewerRef.current?.scrollToIndex({ index: i, animated: true })
                    setPhotoViewerIndex(i)
                  }}
                  style={[s.photoNavBtn, photoViewerIndex === photos.length - 1 && s.photoNavBtnDisabled]}
                >
                  <Text style={s.photoNavText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })()}
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  header: {
    backgroundColor: '#fff', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#e8eaf0',
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a2e' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8eaf0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1a73e8' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#aaa' },
  tabTextActive: { color: '#1a73e8' },

  loader: { flex: 1, justifyContent: 'center' as const },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Service tab
  serviceTopRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e',
  },
  exportBtn: {
    backgroundColor: '#e8f0fe', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  filterChips: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
  },
  filterChipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  filterChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterChipsScroll: { marginBottom: 10 },
  filterChipsContent: { gap: 8, paddingRight: 16 },
  catFilterScroll: { marginBottom: 10 },
  mileageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 2,
  },
  mileageInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#1a1a2e',
  },
  mileageSep: { fontSize: 14, color: '#aaa' },
  mileageClear: { fontSize: 13, color: '#1a73e8', fontWeight: '600', paddingHorizontal: 4 },
  filterCountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  filterCount: { fontSize: 12, color: '#aaa' },
  clearLink: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },

  // Record cards
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { fontSize: 13, color: '#888', fontWeight: '600' },
  cardCost: { fontSize: 13, color: '#1a73e8', fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: { backgroundColor: '#f0f4ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#1a3a8f', fontWeight: '600' },
  tagMore: { backgroundColor: '#eee', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagMoreText: { fontSize: 12, color: '#888' },
  cardMeta: { fontSize: 12, color: '#aaa', marginTop: 4 },
  cardNotes: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 6 },
  expandedItem: { fontSize: 14, color: '#333', marginBottom: 4 },
  expandHint: { fontSize: 11, color: '#bbb', marginTop: 4 },
  collapseHint: { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'right' },
  photoStrip: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  thumbBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2,
  },
  thumbBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Expense tab
  totalCard: {
    backgroundColor: '#1a73e8', borderRadius: 14, padding: 20, marginBottom: 14, alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 4 },
  totalAmount: { fontSize: 28, color: '#fff', fontWeight: '800' },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  catScroll: { marginBottom: 14 },
  catScrollContent: { gap: 8, paddingRight: 16 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
  },
  catChipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  catChipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  expCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  expTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  expCatBadge: { backgroundColor: '#f0f4ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  expCatText: { fontSize: 12, fontWeight: '700', color: '#1a73e8' },
  expAmount: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  expMeta: { flexDirection: 'row', gap: 12 },
  expDate: { fontSize: 12, color: '#888' },
  expKm: { fontSize: 12, color: '#aaa' },
  expNotes: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },

  // Fuel tab
  fuelSummary: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14, justifyContent: 'space-around',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  fuelStat: { alignItems: 'center', flex: 1 },
  fuelStatVal: { fontSize: 18, fontWeight: '800', color: '#1a73e8' },
  fuelStatLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  fuelCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  fuelCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fuelDate: { fontSize: 13, color: '#666', fontWeight: '600' },
  fuelCost: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  fuelCardMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  fuelMeta: { fontSize: 13, color: '#555' },
  fuelKmL: { fontSize: 12, color: '#aaa' },
  fuelStation: { fontSize: 12, color: '#aaa', marginTop: 4 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Photo viewer modal
  photoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  photoModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12,
  },
  photoModalLabel: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 16 },
  photoModalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  photoModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  photoModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 20 },
  photoNavBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  photoNavBtnDisabled: { opacity: 0.3 },
  photoNavText: { color: '#fff', fontSize: 24, fontWeight: '300' },
  photoCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
