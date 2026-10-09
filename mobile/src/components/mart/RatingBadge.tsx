import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon from '../AppIcon'

// "★ 4.8 (12)" everywhere a seller/garage rating is shown (seller rows, Detail, My Mart,
// Followings, seller profile). "No reviews yet" when count is 0. Optional onPress opens
// the Reviews sheet.
export default function RatingBadge({
  avg, count, label, onPress, size = 'normal',
}: {
  avg: number | null
  count: number
  label?: string // e.g. "Parts sales" — appended after the count, per 04-screens.md
  onPress?: () => void
  size?: 'normal' | 'small'
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors, size), [colors, size])

  const content = count === 0 || avg === null ? (
    <Text style={styles.noReviews}>No reviews yet</Text>
  ) : (
    <View style={styles.row}>
      <AppIcon icon={{ lib: 'ion', name: 'star' }} size={size === 'small' ? 13 : 15} color={colors.accent} />
      <Text style={styles.avg}>{avg.toFixed(1)}</Text>
      <Text style={styles.count}>({count})</Text>
      {label ? <Text style={styles.label}> · {label}</Text> : null}
    </View>
  )

  if (!onPress) return content
  return <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>{content}</TouchableOpacity>
}

function makeStyles(c: Colors, size: 'normal' | 'small') {
  const fontSize = size === 'small' ? 12 : 13.5
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avg: { fontSize, fontWeight: '700', color: c.text },
    count: { fontSize, color: c.textMuted },
    label: { fontSize, color: c.textMuted },
    noReviews: { fontSize, color: c.textMuted },
  })
}
