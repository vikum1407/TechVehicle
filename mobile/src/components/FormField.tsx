import React, { useMemo } from 'react'
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = TextInputProps & {
  label: string
  required?: boolean
  error?: string
}

export default function FormField({ label, required, error, style, ...inputProps }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textFaint}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 6 },
    required: { color: c.error },
    input: {
      backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: c.text, letterSpacing: 0,
    },
    error: { fontSize: 12, color: c.error, marginTop: 4 },
  })
}
