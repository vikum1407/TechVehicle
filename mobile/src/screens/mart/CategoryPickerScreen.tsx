import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { MART_CATEGORIES } from '../../constants/martCategories'
import AppIcon from '../../components/AppIcon'

export type CategoryPickerResult = { categoryId: string; categoryTypeId: string | null }

type SearchHit = { categoryId: string; categoryLabel: string; typeId: string; typeLabel: string }

// Spec: 04-screens.md §21.1. Expandable list — only one category open at a time.
// Search mode replaces the accordion with a flat list of matching types.
export default function CategoryPickerScreen({
  onSelect, onClose,
}: {
  onSelect: (result: CategoryPickerResult) => void
  onClose: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const [query, setQuery] = useState('')
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()

  const searchHits: SearchHit[] = useMemo(() => {
    if (!q) return []
    const hits: SearchHit[] = []
    for (const cat of MART_CATEGORIES) {
      for (const type of cat.types) {
        const haystack = [type.en.toLowerCase(), ...type.keywords.map(k => k.toLowerCase())]
        if (haystack.some(h => h.includes(q))) {
          hits.push({ categoryId: cat.id, categoryLabel: cat.en, typeId: type.id, typeLabel: type.en })
        }
      }
    }
    return hits
  }, [q])

  const choose = (categoryId: string, categoryTypeId: string | null) => {
    onSelect({ categoryId, categoryTypeId })
    onClose()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'close' }} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Select category</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts, e.g. brake pad"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {q ? (
        <FlatList
          data={searchHits}
          keyExtractor={h => h.typeId}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => choose(item.categoryId, item.typeId)}>
              <View>
                <Text style={styles.rowText}>{item.typeLabel}</Text>
                <Text style={styles.subLine}>{item.categoryLabel}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No matches.</Text>}
        />
      ) : (
        <FlatList
          data={MART_CATEGORIES}
          keyExtractor={cat => cat.id}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item: cat }) => {
            const isOpen = openCategoryId === cat.id
            const hasTypes = cat.types.length > 0
            return (
              <View>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    if (!hasTypes) { choose(cat.id, null); return }
                    setOpenCategoryId(isOpen ? null : cat.id)
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowText, isOpen && styles.rowTextOpen]}>{cat.en}</Text>
                    <Text style={styles.subLine}>{cat.examples}</Text>
                  </View>
                  {hasTypes ? (
                    <AppIcon
                      icon={{ lib: 'ion', name: isOpen ? 'chevron-up' : 'chevron-down' }}
                      size={18}
                      color={isOpen ? colors.primary : colors.textMuted}
                    />
                  ) : null}
                </TouchableOpacity>
                {isOpen ? (
                  <View style={styles.panel}>
                    <TouchableOpacity style={styles.typeRow} onPress={() => choose(cat.id, null)}>
                      <Text style={styles.typeRowText}>All {cat.en}</Text>
                    </TouchableOpacity>
                    {cat.types.map(type => (
                      <TouchableOpacity key={type.id} style={styles.typeRow} onPress={() => choose(cat.id, type.id)}>
                        <Text style={styles.typeRowText}>{type.en}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
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
    rowTextOpen: { color: c.primary, fontWeight: '700' },
    subLine: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 20 },
    panel: { backgroundColor: c.surfaceAlt, paddingBottom: 6 },
    typeRow: { paddingHorizontal: 32, paddingVertical: 12 },
    typeRowText: { fontSize: 14, color: c.textBody },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: 14 },
  })
}
