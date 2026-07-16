import React, { useMemo } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'destructive'
}

export default function Button({ title, onPress, loading, disabled, variant = 'primary' }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'destructive' && styles.destructive,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} size="small" />
      ) : (
        <Text style={[
          styles.text,
          variant === 'primary' && styles.textPrimary,
          variant === 'secondary' && styles.textSecondary,
          variant === 'destructive' && styles.textDestructive,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    base: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.borderStrong },
    destructive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.error },
    disabled: { opacity: 0.6 },
    text: { fontSize: 16, fontWeight: '700' },
    textPrimary: { color: '#fff' },
    textSecondary: { color: c.textMuted },
    textDestructive: { color: c.error },
  })
}
