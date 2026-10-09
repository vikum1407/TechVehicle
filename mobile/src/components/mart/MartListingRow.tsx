import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon from '../AppIcon'
import MartTag from './MartTag'
import { formatLKR } from '../../utils/martHelpers'

// Spec: 04-screens.md §10 Favorites row + §7 My Ads row — same core visual shape
// (thumbnail, title, price, meta line, status tag), reused by both. Each screen
// composes its own extra bits around it: Favorites just needs the heart; My Ads adds
// a stats line + action buttons below, passed in via `footer`.
export default function MartListingRow({
  title, coverUrl, price, metaLine, statusTag, grayedOut, onPress, favoriteButton, footer,
}: {
  title: string
  coverUrl: string | null
  price: number | null
  metaLine: string // e.g. "Colombo 5 · Used" or "Posted 3 days ago"
  statusTag?: { label: string; variant: 'success-outline' | 'amber-soft' | 'amber-solid' | 'gray' }
  grayedOut?: boolean // sold / removed rows
  onPress: () => void
  favoriteButton?: React.ReactNode
  footer?: React.ReactNode
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.row}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={[styles.thumb, grayedOut && styles.thumbGray]} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={22} color={colors.textFaint} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.title, grayedOut && styles.textGray]} numberOfLines={2}>{title}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, grayedOut && styles.textGray]}>{price !== null ? formatLKR(price) : ''}</Text>
            {statusTag ? <MartTag label={statusTag.label} variant={statusTag.variant} /> : null}
          </View>
          <Text style={[styles.meta, grayedOut && styles.textGrayFaint]} numberOfLines={1}>{metaLine}</Text>
        </View>

        {favoriteButton}
      </View>

      {footer}
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 },
    row: { flexDirection: 'row', gap: 12 },
    thumb: { width: 80, height: 80, borderRadius: 8 },
    thumbGray: { opacity: 0.5 },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    info: { flex: 1, justifyContent: 'center', gap: 4 },
    title: { fontSize: 13.5, fontWeight: '600', color: c.text, lineHeight: 18 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    price: { fontSize: 15, fontWeight: '700', color: c.priceSmall },
    meta: { fontSize: 12, color: c.textMuted },
    textGray: { color: c.textMuted },
    textGrayFaint: { color: c.textFaint },
  })
}
