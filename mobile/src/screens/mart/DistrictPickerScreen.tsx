import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { DISTRICTS, District } from '../../constants/districts'
import AppIcon from '../../components/AppIcon'

// Spec: 04-screens.md §21.3. Plain full-screen view (no own Modal) so it can be used
// either pushed onto MartNavigator's stack, or wrapped in an ad-hoc Modal by a caller
// like the name+district gate sheet. Single choice, tap = select and close immediately.
export default function DistrictPickerScreen({
  selected, onSelect, onClose,
}: {
  selected: string | null
  onSelect: (districtId: string) => void
  onClose: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? DISTRICTS.filter(d => d.en.toLowerCase().includes(q)) : DISTRICTS
  const yourDistrict = !q && selected ? DISTRICTS.find(d => d.id === selected) || null : null

  const choose = (id: string) => { onSelect(id); onClose() }

  const renderRow = (d: District, isYourDistrict: boolean) => (
    <TouchableOpacity key={d.id} style={styles.row} onPress={() => choose(d.id)}>
      <Text style={[styles.rowText, selected === d.id && styles.rowTextSelected]}>
        {isYourDistrict ? `Your district: ${d.en}` : d.en}
      </Text>
      <View style={[styles.radioRing, selected === d.id && styles.radioRingSelected]}>
        {selected === d.id ? <View style={styles.radioDot} /> : null}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'close' }} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>District</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search district"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={d => d.id}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListHeaderComponent={yourDistrict ? (
          <>
            {renderRow(yourDistrict, true)}
            <View style={styles.divider} />
          </>
        ) : null}
        renderItem={({ item }) => renderRow(item, false)}
      />
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
    searchInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14.5, color: c.text,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
    },
    rowText: { fontSize: 14.5, fontWeight: '600', color: c.text },
    rowTextSelected: { color: c.primary, fontWeight: '700' },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 20 },
    radioRing: {
      width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    radioRingSelected: { borderColor: c.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  })
}
