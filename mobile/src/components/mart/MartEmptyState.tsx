import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon, { AppIconSpec } from '../AppIcon'

// Spec: 04-screens.md §0.4 "Empty: icon + one line + (where useful) one button." and
// §0.4/§22 "Error: inline message + 'Try again' button." — one component covers both
// (pass `isError` to swap styling slightly and default the icon to an alert glyph).
export default function MartEmptyState({
  icon, title, actionLabel, onAction, isError = false,
}: {
  icon?: AppIconSpec
  title: string
  actionLabel?: string
  onAction?: () => void
  isError?: boolean
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const resolvedIcon: AppIconSpec = icon || (isError
    ? { lib: 'ion', name: 'cloud-offline-outline' }
    : { lib: 'ion', name: 'file-tray-outline' })

  return (
    <View style={styles.container}>
      <AppIcon icon={resolvedIcon} size={40} color={colors.textFaint} />
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
    title: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 20 },
    button: { marginTop: 16, backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  })
}
