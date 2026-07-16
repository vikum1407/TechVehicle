import React, { useMemo } from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  label: string
  selected: boolean
  onPress: () => void
}

export default function Chip({ label, selected, onPress }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    chip: {
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.borderMid,
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    text: { fontSize: 13, fontWeight: '600', color: c.textSub },
    textSelected: { color: '#fff', fontWeight: '700' },
  })
}
