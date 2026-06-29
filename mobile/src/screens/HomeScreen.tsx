import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  phoneNumber: string
  onLogout: () => void
}

export default function HomeScreen({ phoneNumber, onLogout }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>TechVehicle</Text>
      <Text style={styles.welcome}>Welcome!</Text>
      <Text style={styles.phone}>{phoneNumber}</Text>
      <Text style={styles.subtitle}>Your vehicle companion is ready.</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: c.background,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 24,
    },
    logo: { fontSize: 32, fontWeight: 'bold', color: c.primary, marginBottom: 24 },
    welcome: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 8 },
    phone: { fontSize: 18, color: c.primary, fontWeight: '600', marginBottom: 8 },
    subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 48 },
    logoutButton: {
      borderWidth: 1.5, borderColor: c.primary,
      borderRadius: 10, paddingVertical: 12,
      paddingHorizontal: 32,
    },
    logoutText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  })
}
