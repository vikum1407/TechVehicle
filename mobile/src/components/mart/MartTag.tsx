import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'

// Covers every small status/condition pill in the Mart screens (04-screens.md §0.5 plus
// the New/Used, Wanted, Shop/Casual, "Matches you", "Your request" tags scattered through
// the spec) with one component instead of one-off styles per screen.
export type MartTagVariant = 'success-outline' | 'amber-soft' | 'amber-solid' | 'gray'

export default function MartTag({ label, variant }: { label: string; variant: MartTagVariant }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={[styles.base, styles[variant]]}>
      <Text style={[styles.text, styles[textKeyFor(variant)]]}>{label}</Text>
    </View>
  )
}

function textKeyFor(v: MartTagVariant): 'successText' | 'amberSoftText' | 'amberSolidText' | 'grayText' {
  if (v === 'success-outline') return 'successText'
  if (v === 'amber-soft') return 'amberSoftText'
  if (v === 'amber-solid') return 'amberSolidText'
  return 'grayText'
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    text: { fontSize: 11, fontWeight: '700' },

    'success-outline': { backgroundColor: c.surface, borderWidth: 1, borderColor: c.success },
    successText: { color: c.success },

    'amber-soft': { backgroundColor: c.accentTint },
    amberSoftText: { color: c.accentTintText },

    'amber-solid': { backgroundColor: c.accent },
    amberSolidText: { color: '#fff' },

    gray: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    grayText: { color: c.textSub },
  })
}
