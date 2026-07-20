import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Tab = 'vehicles' | 'garage'

type Props = {
  activeTab: Tab
  onTabPress: (tab: Tab) => void
  vehiclesBadge?: number
  garageBadge?: number
  showGarageTab?: boolean
}

export default function BottomTabBar({ activeTab, onTabPress, vehiclesBadge = 0, garageBadge = 0, showGarageTab = true }: Props) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom])

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabPress('vehicles')}
        activeOpacity={0.8}
      >
        {activeTab === 'vehicles' && <View style={styles.activeBar} />}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🚗</Text>
        </View>
        <Text style={[styles.label, activeTab === 'vehicles' && styles.labelActive]}>
          My Vehicles
        </Text>
      </TouchableOpacity>

      {showGarageTab && (
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress('garage')}
          activeOpacity={0.8}
        >
          {activeTab === 'garage' && <View style={styles.activeBar} />}
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🏭</Text>
          </View>
          <Text style={[styles.label, activeTab === 'garage' && styles.labelActive]}>
            Garage
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function makeStyles(c: Colors, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingBottom: bottomInset + 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 10,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    activeBar: {
      position: 'absolute',
      top: 0,
      width: 48,
      height: 3,
      backgroundColor: c.primary,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
    },
    iconWrap: { position: 'relative', marginBottom: 3 },
    icon: { fontSize: 22 },
    dot: {
      position: 'absolute', top: -2, right: -4,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: c.error,
      borderWidth: 1.5, borderColor: c.surface,
    },
    label: { fontSize: 11, fontWeight: '600', color: c.textFaint, letterSpacing: 0.2 },
    labelActive: { color: c.primary },
  })
}
