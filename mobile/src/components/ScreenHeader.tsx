import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  title: string
  subtitle?: string
  onBack: () => void
  rightElement?: React.ReactNode
}

export default function ScreenHeader({ title, subtitle, onBack, rightElement }: Props) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightElement ? <View style={styles.rightWrap}>{rightElement}</View> : null}
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingTop: topInset + 12, paddingBottom: 16, paddingHorizontal: 20,
    },
    backBtn: { marginRight: 14 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    titleWrap: { flex: 1 },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rightWrap: { marginLeft: 12 },
  })
}
