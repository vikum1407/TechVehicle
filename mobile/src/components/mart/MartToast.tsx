import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'

// Spec: 05-build-plan.md Step 0.10 "MartToast (minimal)", used for the Followings
// unfollow "Undo" (04-screens.md §18) and short confirmations. Controlled component —
// the screen owns `visible` and a timer to clear it; this just renders + auto-fades.
export default function MartToast({
  visible, message, actionLabel, onAction, durationMs = 4000, onHide,
}: {
  visible: boolean
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
  onHide?: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHide?.())
    }, durationMs)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="box-none">
      <View style={styles.toast}>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingHorizontal: 20 },
    toast: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.text, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
      maxWidth: '100%',
    },
    message: { color: c.surface, fontSize: 13.5, flexShrink: 1 },
    action: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
  })
}
