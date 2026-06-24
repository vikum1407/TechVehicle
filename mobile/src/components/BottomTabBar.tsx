import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'

type Tab = 'vehicles' | 'garage'

type Props = {
  activeTab: Tab
  onTabPress: (tab: Tab) => void
}

export default function BottomTabBar({ activeTab, onTabPress }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabPress('vehicles')}
        activeOpacity={0.8}
      >
        {activeTab === 'vehicles' && <View style={styles.activeBar} />}
        <Text style={styles.icon}>🚗</Text>
        <Text style={[styles.label, activeTab === 'vehicles' && styles.labelActive]}>
          My Vehicles
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabPress('garage')}
        activeOpacity={0.8}
      >
        {activeTab === 'garage' && <View style={styles.activeBar} />}
        <Text style={styles.icon}>🏭</Text>
        <Text style={[styles.label, activeTab === 'garage' && styles.labelActive]}>
          Garage
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    // Extra bottom padding so the tab bar clears the Android system nav bar
    paddingBottom: Platform.OS === 'ios' ? 28 : 32,
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
    backgroundColor: '#1a73e8',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  icon: { fontSize: 22, marginBottom: 3 },
  label: { fontSize: 11, fontWeight: '600', color: '#aaa', letterSpacing: 0.2 },
  labelActive: { color: '#1a73e8' },
})
