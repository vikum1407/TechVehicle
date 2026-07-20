import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

type Props = {
  onBack: () => void
  onNotificationPrefs: () => void
  onLogout: () => void
}

export default function SettingsScreen({ onBack, onNotificationPrefs, onLogout }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={onNotificationPrefs} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🔔</Text>
          <Text style={styles.rowLabel}>Notification Preferences</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TechVehicle · v1.0.0</Text>
    </ScrollView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 48 },

    card: {
      backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, marginTop: 20,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 16,
    },
    rowIcon: { fontSize: 18 },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    rowChevron: { fontSize: 18, color: c.textMuted },

    logoutBtn: {
      marginHorizontal: 16, marginTop: 24, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.error,
      paddingVertical: 15, alignItems: 'center',
    },
    logoutBtnText: { fontSize: 15, color: c.error, fontWeight: '700' },

    version: { textAlign: 'center', fontSize: 11, color: c.textFaint, marginTop: 20 },
  })
}
