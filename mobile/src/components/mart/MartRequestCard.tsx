import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import AppIcon from '../AppIcon'
import MartTag from './MartTag'
import { formatBudget, localizedLabel } from '../../utils/martHelpers'
import { MART_CATEGORIES } from '../../constants/martCategories'

// Spec: 04-screens.md §12 "Switch + Request Cards" — single-column list card for the
// Wanted feed (distinct from MartListingCard's 2-column grid card, since Wanted ads
// have no photo-first layout and instead lead with the budget/vehicle/category text).
export default function MartRequestCard({
  title, matchesYou, make, model, yearFrom, yearTo, categoryId, budgetMin, budgetMax,
  sellerName, districtLabel, ageLabel, repliesCount, isOwner, isFavorited, onPress, onAction, onToggleFavorite,
}: {
  title: string
  matchesYou: boolean
  make: string | null
  model: string | null
  yearFrom: number | null
  yearTo: number | null
  categoryId: string
  budgetMin: number | null
  budgetMax: number | null
  sellerName: string
  districtLabel: string
  ageLabel: string
  repliesCount: number
  isOwner: boolean
  isFavorited: boolean
  onPress: () => void
  onAction: () => void
  onToggleFavorite: () => void
}) {
  const colors = useColors()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const vehicleLabel = make ? `${make}${model ? ` ${model}` : ''}${yearFrom ? ` ${yearFrom}${yearTo && yearTo !== yearFrom ? `–${yearTo}` : ''}` : ''}` : null
  const cat = MART_CATEGORIES.find(c => c.id === categoryId)
  const categoryLabel = cat ? localizedLabel(language, cat) : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.titleRowRight}>
          {matchesYou ? <MartTag label={t('mart.common.matchesYou')} variant="amber-soft" /> : null}
          {!isOwner ? (
            <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon icon={{ lib: 'ion', name: isFavorited ? 'heart' : 'heart-outline' }} size={18} color={colors.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {(vehicleLabel || categoryLabel) ? (
        <View style={styles.chipRow}>
          {vehicleLabel ? <View style={styles.chip}><Text style={styles.chipText}>{vehicleLabel}</Text></View> : null}
          {categoryLabel ? <View style={styles.chip}><Text style={styles.chipText}>{categoryLabel}</Text></View> : null}
        </View>
      ) : null}

      <Text style={styles.budgetLabel}>{t('mart.common.budget')}</Text>
      <Text style={styles.budget}>{formatBudget(t, budgetMin, budgetMax)}</Text>

      <Text style={styles.meta} numberOfLines={1}>
        {sellerName} · {districtLabel} · {ageLabel} · {repliesCount === 1 ? t('mart.common.repliesOne', { count: repliesCount }) : t('mart.common.repliesMany', { count: repliesCount })}
      </Text>

      {isOwner ? (
        <TouchableOpacity style={styles.outlinedBtn} onPress={onAction}>
          <Text style={styles.outlinedBtnText}>{t('mart.common.yourRequest')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.navyBtn} onPress={onAction}>
          <Text style={styles.navyBtnText}>{t('mart.common.iHaveThis')}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    title: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text, lineHeight: 18 },
    titleRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: { backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 11.5, fontWeight: '600', color: c.textBody },
    budgetLabel: { fontSize: 12, color: c.textMuted, marginTop: 10 },
    budget: { fontSize: 16, fontWeight: '700', color: c.accentTintText, marginTop: 2 },
    meta: { fontSize: 11.5, color: c.textMuted, marginTop: 8 },
    navyBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
    navyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
    outlinedBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
    outlinedBtnText: { color: c.primary, fontWeight: '700', fontSize: 13.5 },
  })
}
