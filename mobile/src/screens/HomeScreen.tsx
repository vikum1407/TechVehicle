import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

type Props = {
  phoneNumber: string
  onLogout: () => void
}

export default function HomeScreen({ phoneNumber, onLogout }: Props) {
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

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#1a73e8', marginBottom: 24 },
  welcome: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  phone: { fontSize: 18, color: '#1a73e8', fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 48 },
  logoutButton: {
    borderWidth: 1.5, borderColor: '#1a73e8',
    borderRadius: 10, paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },
})
