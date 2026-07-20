import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

type Props = {
  onBack: () => void
  onNotificationPrefs: () => void
}

export default function SettingsScreen({ onBack, onNotificationPrefs }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

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

    version: { textAlign: 'center', fontSize: 11, color: c.textFaint, marginTop: 24 },
  })
}
