import React, { useMemo } from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  onPress: () => void
}

export default function FloatingHomeButton({ onPress }: Props) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom])

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.icon}>🏠</Text>
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors, bottomInset: number) {
  return StyleSheet.create({
    btn: {
      position: 'absolute',
      right: 16,
      bottom: bottomInset + 20,
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
      zIndex: 999,
    },
    icon: { fontSize: 20 },
  })
}
