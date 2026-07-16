import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Modal, FlatList, Dimensions, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { api } from '../config/api'
import { exportVehiclePdf } from '../utils/pdfExport'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

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

  // Edit/delete state
  const [editService, setEditService] = useState<ServiceRecord | null>(null)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [editFuel, setEditFuel] = useState<FuelLog | null>(null)
  const [draftService, setDraftService] = useState({ date: '', description: '', mileage: '', parts: '', brand: '', cost: '', notes: '' })
  const [draftExpense, setDraftExpense] = useState({ date: '', category: '', amount: '', description: '', mileage: '', notes: '' })
  const [draftFuel, setDraftFuel] = useState({ date: '', mileage: '', litres: '', cost: '', station: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Quick-add past record
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickDraft, setQuickDraft] = useState({ description: '', year: '', mileage: '', cost: '' })
  const [savingQuick, setSavingQuick] = useState(false)
  const colors = useColors()
  const s = useMemo(() => makeStyles(colors), [colors])

  const handleQuickAdd = async () => {
    if (!quickDraft.description.trim()) { Alert.alert('Required', 'Please describe what was done.'); return }
    const yearNum = parseInt(quickDraft.year)
    const isoDate = (!isNaN(yearNum) && yearNum >= 1990 && yearNum <= new Date().getFullYear())
      ? new Date(`${yearNum}-07-01`).toISOString()
      : new Date().toISOString()
    setSavingQuick(true)
    try {
      await api.addServiceRecord(token, vehicle.id, {
        date: isoDate,
        description: quickDraft.description.trim(),
        mileage: quickDraft.mileage.trim() ? parseInt(quickDraft.mileage) : undefined,
        cost: quickDraft.cost.trim() ? parseFloat(quickDraft.cost) : undefined,
        notes: 'Historical record',
      })
      setQuickDraft({ description: '', year: '', mileage: '', cost: '' })
      setShowQuickAdd(false)
      await loadAll()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save record.')
    } finally {
      setSavingQuick(false)
    }
  }

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
      const catLower = catFilter.toLowerCase()
      if (!cats.some(c => c.toLowerCase() === catLower || c.toLowerCase().includes(catLower) || catLower.includes(c.toLowerCase()))) return false
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
      Alert.alert('Export failed', (e as any).message || 'Could not generate PDF')
    } finally {
      setExporting(false)
    }
  }

  // ── Edit/delete handlers ──────────────────────────────────────────────────

  const openEditService = (r: ServiceRecord) => {
    setDraftService({
      date: new Date(r.date).toISOString().split('T')[0],
      description: r.description,
      mileage: r.mileage?.toString() ?? '',
      parts: r.parts ?? '',
      brand: r.brand ?? '',
      cost: r.cost?.toString() ?? '',
      notes: r.notes ?? '',
    })
    setEditService(r)
  }

  const openEditExpense = (e: Expense) => {
    setDraftExpense({
      date: new Date(e.date).toISOString().split('T')[0],
      category: e.category,
      amount: e.amount.toString(),
      description: e.description ?? '',
      mileage: e.mileage?.toString() ?? '',
      notes: e.notes ?? '',
    })
    setEditExpense(e)
  }

  const openEditFuel = (f: FuelLog) => {
    setDraftFuel({
      date: new Date(f.date).toISOString().split('T')[0],
      mileage: f.mileage?.toString() ?? '',
      litres: f.litres?.toString() ?? '',
      cost: f.cost?.toString() ?? '',
      station: f.station ?? '',
    })
    setEditFuel(f)
  }

  const handleSaveService = async () => {
    if (!editService) return
    setSavingEdit(true)
    try {
      const updated = await api.updateServiceRecord(token, editService.id, {
        date: draftService.date || undefined,
        description: draftService.description || undefined,
        mileage: draftService.mileage ? Number(draftService.mileage) : null,
        parts: draftService.parts || null,
        brand: draftService.brand || null,
        cost: draftService.cost ? Number(draftService.cost) : null,
        notes: draftService.notes || null,
      })
      setRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      setEditService(null)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSaveExpense = async () => {
    if (!editExpense) return
    setSavingEdit(true)
    try {
      const updated = await api.updateExpense(token, editExpense.id, {
        date: draftExpense.date || undefined,
        category: draftExpense.category || undefined,
        amount: draftExpense.amount ? Number(draftExpense.amount) : undefined,
        description: draftExpense.description || null,
        mileage: draftExpense.mileage ? Number(draftExpense.mileage) : null,
        notes: draftExpense.notes || null,
      })
      setExpenses(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
      setEditExpense(null)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSaveFuel = async () => {
    if (!editFuel) return
    setSavingEdit(true)
    try {
      const updated = await api.updateFuelLog(token, editFuel.id, {
        date: draftFuel.date || undefined,
        mileage: draftFuel.mileage ? Number(draftFuel.mileage) : undefined,
        litres: draftFuel.litres ? Number(draftFuel.litres) : null,
        cost: draftFuel.cost ? Number(draftFuel.cost) : null,
        station: draftFuel.station || null,
      })
      setFuelLogs(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f))
      setEditFuel(null)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDeleteService = (id: string) => {
    Alert.alert('Delete Record', 'Delete this service record permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteServiceRecord(token, id)
          setRecords(prev => prev.filter(r => r.id !== id))
        } catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const confirmDeleteExpense = (id: string) => {
    Alert.alert('Delete Expense', 'Delete this expense permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteExpense(token, id)
          setExpenses(prev => prev.filter(e => e.id !== id))
        } catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const confirmDeleteFuel = (id: string) => {
    Alert.alert('Delete Fuel Log', 'Delete this fill-up record permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteFuelLog(token, id)
          setFuelLogs(prev => prev.filter(f => f.id !== id))
        } catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const openServiceMenu = (r: ServiceRecord) => {
    Alert.alert(fmt(r.date), r.description.split(',')[0].trim(), [
      { text: 'Edit', onPress: () => openEditService(r) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteService(r.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const openExpenseMenu = (e: Expense) => {
    Alert.alert(fmt(e.date), `${e.category} — LKR ${e.amount.toLocaleString()}`, [
      { text: 'Edit', onPress: () => openEditExpense(e) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteExpense(e.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const openFuelMenu = (f: FuelLog) => {
    Alert.alert(fmt(f.date), `${f.mileage?.toLocaleString() ?? '?'} km${f.litres ? ` · ${f.litres}L` : ''}`, [
      { text: 'Edit', onPress: () => openEditFuel(f) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteFuel(f.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
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
          <View style={s.cardTopRight}>
            {r.cost != null && <Text style={s.cardCost}>LKR {r.cost.toLocaleString()}</Text>}
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); openServiceMenu(r) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.menuBtn}>
              <Text style={s.menuBtnText}>⋮</Text>
            </TouchableOpacity>
          </View>
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
      <ScreenHeader
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        subtitle={`${vehicle.registrationNo} · History`}
        onBack={onBack}
      />

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
        <ActivityIndicator size="large" color={colors.primary} style={s.loader} />
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
                  placeholderTextColor={colors.textFaint}
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
                <TouchableOpacity style={s.addPastBtn} onPress={() => setShowQuickAdd(true)}>
                  <Text style={s.addPastBtnText}>+ Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.exportBtn, exporting && s.exportBtnDisabled]}
                  onPress={handleExportPdf}
                  disabled={exporting}
                >
                  {exporting
                    ? <ActivityIndicator size="small" color={colors.primary} />
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
                    placeholderTextColor={colors.textFaint}
                    value={mileageMin}
                    onChangeText={setMileageMin}
                    keyboardType="number-pad"
                  />
                  <Text style={s.mileageSep}>—</Text>
                  <TextInput
                    style={s.mileageInput}
                    placeholder="Max km"
                    placeholderTextColor={colors.textFaint}
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
                placeholderTextColor={colors.textFaint}
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
                      <TouchableOpacity onPress={() => openExpenseMenu(exp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.menuBtn}>
                        <Text style={s.menuBtnText}>⋮</Text>
                      </TouchableOpacity>
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
                placeholderTextColor={colors.textFaint}
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
                      <View style={s.cardTopRight}>
                        {f.cost != null && <Text style={s.fuelCost}>LKR {f.cost.toLocaleString()}</Text>}
                        <TouchableOpacity onPress={() => openFuelMenu(f)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.menuBtn}>
                          <Text style={s.menuBtnText}>⋮</Text>
                        </TouchableOpacity>
                      </View>
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

      {/* ── Quick-add past record modal ─── */}
      <Modal visible={showQuickAdd} transparent animationType="slide" onRequestClose={() => setShowQuickAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editModalOverlay}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Add Past Record</Text>
              <TouchableOpacity onPress={() => setShowQuickAdd(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.editLabel}>What was done? *</Text>
              <TextInput
                style={s.editInput}
                value={quickDraft.description}
                onChangeText={v => setQuickDraft(p => ({ ...p, description: v }))}
                placeholder="e.g. Full service, Tyre change, Timing belt"
                placeholderTextColor={colors.textFaint}
                autoFocus
              />
              <Text style={s.editLabel}>Approximate year</Text>
              <TextInput
                style={s.editInput}
                value={quickDraft.year}
                onChangeText={v => setQuickDraft(p => ({ ...p, year: v }))}
                placeholder="e.g. 2022  (leave blank if unsure)"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text style={s.editLabel}>Mileage at the time (km)</Text>
              <TextInput
                style={s.editInput}
                value={quickDraft.mileage}
                onChangeText={v => setQuickDraft(p => ({ ...p, mileage: v }))}
                placeholder="Optional"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
              />
              <Text style={s.editLabel}>Cost (LKR)</Text>
              <TextInput
                style={s.editInput}
                value={quickDraft.cost}
                onChangeText={v => setQuickDraft(p => ({ ...p, cost: v }))}
                placeholder="Optional"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
              />
              <Text style={[s.editLabel, { color: '#aaa', fontSize: 12, marginTop: 4 }]}>
                All fields except the description are optional — approximate values are fine.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[s.editSaveBtn, (!quickDraft.description.trim() || savingQuick) && s.editSaveBtnDisabled]}
              onPress={handleQuickAdd}
              disabled={!quickDraft.description.trim() || savingQuick}
            >
              {savingQuick
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.editSaveBtnText}>Save Record</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit service record modal ─── */}
      <Modal visible={!!editService} transparent animationType="slide" onRequestClose={() => setEditService(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editModalOverlay}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Edit Service Record</Text>
              <TouchableOpacity onPress={() => setEditService(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.editLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.editInput} value={draftService.date} onChangeText={v => setDraftService(p => ({ ...p, date: v }))} placeholder="2024-01-15" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Services done</Text>
              <TextInput style={s.editInput} value={draftService.description} onChangeText={v => setDraftService(p => ({ ...p, description: v }))} placeholder="Oil Change, Air Filter" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Odometer (km)</Text>
              <TextInput style={s.editInput} value={draftService.mileage} onChangeText={v => setDraftService(p => ({ ...p, mileage: v }))} keyboardType="number-pad" placeholder="e.g. 45200" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Parts</Text>
              <TextInput style={s.editInput} value={draftService.parts} onChangeText={v => setDraftService(p => ({ ...p, parts: v }))} placeholder="e.g. NGK Spark Plug" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Brand</Text>
              <TextInput style={s.editInput} value={draftService.brand} onChangeText={v => setDraftService(p => ({ ...p, brand: v }))} placeholder="e.g. Bosch" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Cost (LKR)</Text>
              <TextInput style={s.editInput} value={draftService.cost} onChangeText={v => setDraftService(p => ({ ...p, cost: v }))} keyboardType="number-pad" placeholder="e.g. 4500" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Notes</Text>
              <TextInput style={[s.editInput, s.editInputMulti]} value={draftService.notes} onChangeText={v => setDraftService(p => ({ ...p, notes: v }))} multiline placeholder="Additional notes..." placeholderTextColor={colors.textFaint} />
              <TouchableOpacity style={[s.editSaveBtn, savingEdit && s.editSaveBtnDisabled]} onPress={handleSaveService} disabled={savingEdit}>
                {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit expense modal ─── */}
      <Modal visible={!!editExpense} transparent animationType="slide" onRequestClose={() => setEditExpense(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editModalOverlay}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditExpense(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.editLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.editInput} value={draftExpense.date} onChangeText={v => setDraftExpense(p => ({ ...p, date: v }))} placeholder="2024-01-15" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Category</Text>
              <TextInput style={s.editInput} value={draftExpense.category} onChangeText={v => setDraftExpense(p => ({ ...p, category: v }))} placeholder="e.g. Insurance" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Amount (LKR)</Text>
              <TextInput style={s.editInput} value={draftExpense.amount} onChangeText={v => setDraftExpense(p => ({ ...p, amount: v }))} keyboardType="number-pad" placeholder="e.g. 24000" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Description</Text>
              <TextInput style={s.editInput} value={draftExpense.description} onChangeText={v => setDraftExpense(p => ({ ...p, description: v }))} placeholder="Optional description" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Odometer (km)</Text>
              <TextInput style={s.editInput} value={draftExpense.mileage} onChangeText={v => setDraftExpense(p => ({ ...p, mileage: v }))} keyboardType="number-pad" placeholder="e.g. 45200" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Notes</Text>
              <TextInput style={[s.editInput, s.editInputMulti]} value={draftExpense.notes} onChangeText={v => setDraftExpense(p => ({ ...p, notes: v }))} multiline placeholder="Additional notes..." placeholderTextColor={colors.textFaint} />
              <TouchableOpacity style={[s.editSaveBtn, savingEdit && s.editSaveBtnDisabled]} onPress={handleSaveExpense} disabled={savingEdit}>
                {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit fuel log modal ─── */}
      <Modal visible={!!editFuel} transparent animationType="slide" onRequestClose={() => setEditFuel(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editModalOverlay}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Edit Fill-up</Text>
              <TouchableOpacity onPress={() => setEditFuel(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.editLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.editInput} value={draftFuel.date} onChangeText={v => setDraftFuel(p => ({ ...p, date: v }))} placeholder="2024-01-15" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Odometer (km)</Text>
              <TextInput style={s.editInput} value={draftFuel.mileage} onChangeText={v => setDraftFuel(p => ({ ...p, mileage: v }))} keyboardType="number-pad" placeholder="e.g. 45200" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Litres</Text>
              <TextInput style={s.editInput} value={draftFuel.litres} onChangeText={v => setDraftFuel(p => ({ ...p, litres: v }))} keyboardType="decimal-pad" placeholder="e.g. 35.5" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Cost (LKR)</Text>
              <TextInput style={s.editInput} value={draftFuel.cost} onChangeText={v => setDraftFuel(p => ({ ...p, cost: v }))} keyboardType="number-pad" placeholder="e.g. 8900" placeholderTextColor={colors.textFaint} />
              <Text style={s.editLabel}>Station</Text>
              <TextInput style={s.editInput} value={draftFuel.station} onChangeText={v => setDraftFuel(p => ({ ...p, station: v }))} placeholder="e.g. Ceylinco Petrol" placeholderTextColor={colors.textFaint} />
              <TouchableOpacity style={[s.editSaveBtn, savingEdit && s.editSaveBtnDisabled]} onPress={handleSaveFuel} disabled={savingEdit}>
                {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    tabBar: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: 12, fontWeight: '600', color: c.textFaint },
    tabTextActive: { color: c.primary },

    loader: { flex: 1, justifyContent: 'center' as const },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    serviceTopRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
    searchInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: c.text,
    },
    addPastBtn: {
      backgroundColor: '#e6f4ea', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginLeft: 6,
    },
    addPastBtnText: { fontSize: 13, color: '#1e7e34', fontWeight: '700' },
    exportBtn: {
      backgroundColor: c.primaryTint, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginLeft: 6,
    },
    exportBtnDisabled: { opacity: 0.5 },
    exportBtnText: { fontSize: 13, color: c.primary, fontWeight: '700' },
    filterChips: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    filterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderMid,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText: { fontSize: 12, color: c.textSub, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },
    filterChipsScroll: { marginBottom: 10 },
    filterChipsContent: { gap: 8, paddingRight: 16 },
    catFilterScroll: { marginBottom: 10 },
    mileageRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginBottom: 10, marginTop: 2,
    },
    mileageInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: c.text,
    },
    mileageSep: { fontSize: 14, color: c.textFaint },
    mileageClear: { fontSize: 13, color: c.primary, fontWeight: '600', paddingHorizontal: 4 },
    filterCountRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 8,
    },
    filterCount: { fontSize: 12, color: c.textFaint },
    clearLink: { fontSize: 13, color: c.primary, fontWeight: '600' },

    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    menuBtn: { paddingHorizontal: 4 },
    menuBtnText: { fontSize: 18, color: c.textFaint, fontWeight: '700', lineHeight: 22 },

    card: {
      backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardDate: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    cardCost: { fontSize: 13, color: c.primary, fontWeight: '700' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    tag: { backgroundColor: c.primaryTint, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { fontSize: 12, color: c.primaryTintText, fontWeight: '600' },
    tagMore: { backgroundColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    tagMoreText: { fontSize: 12, color: c.textMuted },
    cardMeta: { fontSize: 12, color: c.textFaint, marginTop: 4 },
    cardNotes: { fontSize: 12, color: c.textSub, fontStyle: 'italic', marginTop: 6 },
    expandedItem: { fontSize: 14, color: c.textBody, marginBottom: 4 },
    expandHint: { fontSize: 11, color: c.textFaint, marginTop: 4 },
    collapseHint: { fontSize: 11, color: c.textFaint, marginTop: 8, textAlign: 'right' },
    photoStrip: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: c.border },
    thumbBadge: {
      position: 'absolute', bottom: 4, right: 4,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2,
    },
    thumbBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    totalCard: {
      backgroundColor: c.primary, borderRadius: 14, padding: 20, marginBottom: 14, alignItems: 'center',
    },
    totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 4 },
    totalAmount: { fontSize: 28, color: '#fff', fontWeight: '800' },
    totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    catScroll: { marginBottom: 14 },
    catScrollContent: { gap: 8, paddingRight: 16 },
    catChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderMid,
    },
    catChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    catChipText: { fontSize: 13, color: c.textSub, fontWeight: '600' },
    catChipTextActive: { color: '#fff' },
    expCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
    },
    expTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    expCatBadge: { backgroundColor: c.primaryTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    expCatText: { fontSize: 12, fontWeight: '700', color: c.primary },
    expAmount: { fontSize: 16, fontWeight: '800', color: c.text },
    expMeta: { flexDirection: 'row', gap: 12 },
    expDate: { fontSize: 12, color: c.textMuted },
    expKm: { fontSize: 12, color: c.textFaint },
    expNotes: { fontSize: 12, color: c.textSub, marginTop: 4, fontStyle: 'italic' },

    fuelSummary: {
      flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, padding: 16,
      marginBottom: 14, justifyContent: 'space-around',
      elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
    },
    fuelStat: { alignItems: 'center', flex: 1 },
    fuelStatVal: { fontSize: 18, fontWeight: '800', color: c.primary },
    fuelStatLabel: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    fuelCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10,
      elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
    },
    fuelCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    fuelDate: { fontSize: 13, color: c.textSub, fontWeight: '600' },
    fuelCost: { fontSize: 14, fontWeight: '800', color: c.text },
    fuelCardMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    fuelMeta: { fontSize: 13, color: c.textSub },
    fuelKmL: { fontSize: 12, color: c.textFaint },
    fuelStation: { fontSize: 12, color: c.textFaint, marginTop: 4 },

    empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 17, fontWeight: '700', color: c.textBody, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyBtn: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    editModalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    editModalCard: {
      backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%',
    },
    editModalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
    },
    editModalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
    editModalClose: { fontSize: 18, color: c.textMuted, fontWeight: '700' },
    editLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    editInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: c.text,
    },
    editInputMulti: { minHeight: 80, textAlignVertical: 'top' },
    editSaveBtn: {
      backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24,
    },
    editSaveBtnDisabled: { opacity: 0.6 },
    editSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

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
}
