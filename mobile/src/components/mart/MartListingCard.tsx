import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon from '../AppIcon'
import MartTag from './MartTag'
import { formatLKR } from '../../utils/martHelpers'

// Spec: 04-screens.md §1 "Mart Home (Browse Feed)" — the 2-column grid card. Selling
// ads only (Wanted has its own distinct card design, §12 — not this component).
export default function MartListingCard({
  title, coverUrl, price, condition, districtLabel, status, isFavorited, onPress, onToggleFavorite,
}: {
  title: string
  coverUrl: string | null
  price: number | null
  condition: 'new' | 'used' | null
  districtLabel: string
  status: 'available' | 'reserved'
  isFavorited: boolean
  onPress: () => void
  onToggleFavorite: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <AppIcon icon={{ lib: 'ion', name: 'cog-outline' }} size={32} color={colors.textFaint} />
          </View>
        )}

        <TouchableOpacity style={styles.heartBtn} onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppIcon icon={{ lib: isFavorited ? 'ion' : 'ion', name: isFavorited ? 'heart' : 'heart-outline' }} size={16} color={colors.accent} />
        </TouchableOpacity>

        {status === 'reserved' ? (
          <View style={styles.reservedWrap}><MartTag label="Reserved" variant="amber-soft" /></View>
        ) : null}

        {condition ? (
          <View style={styles.conditionWrap}>
            <MartTag label={condition === 'new' ? 'New' : 'Used'} variant={condition === 'new' ? 'amber-soft' : 'gray'} />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.price}>{price !== null ? formatLKR(price) : ''}</Text>
        <View style={styles.districtRow}>
          <AppIcon icon={{ lib: 'ion', name: 'location-outline' }} size={11} color={colors.textMuted} />
          <Text style={styles.district} numberOfLines={1}>{districtLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: { flex: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    imageWrap: { height: 108, position: 'relative' },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    heartBtn: {
      position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    },
    reservedWrap: { position: 'absolute', top: 8, left: 8 },
    conditionWrap: { position: 'absolute', bottom: 8, left: 8 },
    info: { padding: 10 },
    title: { fontSize: 13, fontWeight: '600', color: c.text, lineHeight: 17, minHeight: 34 },
    price: { fontSize: 15, fontWeight: '700', color: c.accent, marginTop: 4 },
    districtRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    district: { fontSize: 11, color: c.textMuted, flexShrink: 1 },
  })
}
