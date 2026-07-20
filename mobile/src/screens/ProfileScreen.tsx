import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'

type Props = {
  token: string
  phoneNumber: string
  userType: 'owner' | 'garage'
  onBack: () => void
  onSettings: () => void
  onOpenGarage: () => void
  onLogout: () => void
}

export default function ProfileScreen({ token, phoneNumber, userType, onBack, onSettings, onOpenGarage, onLogout }: Props) {
  const [stats, setStats] = useState<{ vehicleCount: number; serviceCount: number; fuelCount: number; expenseCount: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [garageName, setGarageName] = useState<string | null>(null)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    api.getAccountStats(token)
      .then(data => { setStats(data); setPhotoUrl(data.profilePhotoUrl) })
      .catch(() => {})
      .finally(() => setLoadingStats(false))

    api.getGarage(token)
      .then(g => setGarageName(g.name))
      .catch(() => setGarageName(null))
  }, [])

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access in your device settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    setUploadingPhoto(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )
      const url = await api.uploadPhoto(token, compressed.uri)
      await api.updateProfilePhoto(token, url)
      setPhotoUrl(url)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const initials = phoneNumber.slice(-4)

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Profile" onBack={onBack} />

      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatar} onPress={pickPhoto} activeOpacity={0.8} disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <ActivityIndicator color="#fff" />
          ) : photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.phone}>{phoneNumber}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {userType === 'garage' ? '🔧 Garage / Service Center' : '🚗 Vehicle Owner'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Account Summary</Text>
      {loadingStats ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : stats ? (
        <View style={styles.statsGrid}>
          <StatCard value={stats.vehicleCount} label="Vehicles" icon="🚗" colors={colors} />
          <StatCard value={stats.serviceCount} label="Service Records" icon="🔧" colors={colors} />
          <StatCard value={stats.fuelCount}    label="Fuel Logs" icon="⛽" colors={colors} />
          <StatCard value={stats.expenseCount} label="Expenses" icon="💰" colors={colors} />
        </View>
      ) : null}

      {garageName ? (
        <TouchableOpacity style={[styles.settingsRow, styles.garageRowLive]} onPress={onOpenGarage} activeOpacity={0.7}>
          <Text style={styles.settingsRowIcon}>🏭</Text>
          <Text style={styles.settingsRowLabel}>{garageName}</Text>
          <Text style={styles.garageLiveBadge}>✓ Live</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.settingsRow, styles.garageRowNew]} onPress={onOpenGarage} activeOpacity={0.7}>
          <Text style={styles.settingsRowIcon}>🏭</Text>
          <Text style={styles.settingsRowLabel}>Register a Garage / Service Center</Text>
          <Text style={styles.garageNewBadge}>New</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.settingsRow} onPress={onSettings} activeOpacity={0.7}>
        <Text style={styles.settingsRowIcon}>⚙️</Text>
        <Text style={styles.settingsRowLabel}>Settings</Text>
        <Text style={styles.settingsRowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function StatCard({ value, label, icon, colors }: { value: number; label: string; icon: string; colors: Colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 48 },

    avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: c.surface, marginBottom: 8 },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12, position: 'relative',
    },
    avatarImage: { width: 72, height: 72, borderRadius: 36 },
    avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
    avatarEditBadge: {
      position: 'absolute', right: -2, bottom: -2,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.surface,
    },
    avatarEditBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
    phone: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
    roleBadge: {
      backgroundColor: c.primaryTint, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 5,
    },
    roleBadgeText: { fontSize: 13, color: c.primaryTintText, fontWeight: '600' },

    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: c.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginTop: 20, marginBottom: 8, paddingHorizontal: 16,
    },

    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      paddingHorizontal: 16,
    },
    statCard: {
      flex: 1, minWidth: '44%', backgroundColor: c.surface, borderRadius: 12,
      padding: 16, alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statIcon: { fontSize: 22, marginBottom: 6 },
    statValue: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 2 },
    statLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600', textAlign: 'center' },

    settingsRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, marginTop: 12,
      paddingHorizontal: 16, paddingVertical: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    settingsRowIcon: { fontSize: 18 },
    settingsRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    settingsRowChevron: { fontSize: 18, color: c.textMuted },

    garageRowNew: { marginTop: 24, borderWidth: 1, borderColor: c.accent },
    garageRowLive: { marginTop: 24, borderWidth: 1, borderColor: c.primaryTintText + '55' },
    garageNewBadge: {
      fontSize: 10, fontWeight: '800', color: '#3a2900', backgroundColor: c.accent,
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    },
    garageLiveBadge: { fontSize: 12, fontWeight: '700', color: c.primary },

    logoutBtn: {
      marginHorizontal: 16, marginTop: 12, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.error,
      paddingVertical: 15, alignItems: 'center',
    },
    logoutBtnText: { fontSize: 15, color: c.error, fontWeight: '700' },
  })
}
