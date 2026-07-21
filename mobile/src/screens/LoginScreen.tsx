import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  onOTPSent: (phoneNumber: string) => void
}

const PERKS = [
  { icon: '🔧', label: 'Service\nhistory' },
  { icon: '⛽', label: 'Fuel &\nmileage' },
  { icon: '📄', label: 'Verified\ntransfer' },
]

export default function LoginScreen({ onOTPSent }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const handleSendOTP = async () => {
    const digits = phone.trim()
    if (digits.length < 9) {
      Alert.alert('Invalid number', 'Please enter a valid Sri Lankan mobile number.')
      return
    }

    const fullNumber = `+94${digits.startsWith('0') ? digits.slice(1) : digits}`

    setLoading(true)
    try {
      await api.sendOTP(fullNumber)
      onOTPSent(fullNumber)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroRoad} />
          <Text style={styles.logo}>TechVehicle</Text>
          <Text style={styles.tagline}>Your vehicle's digital service file</Text>
        </View>

        <View style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🚗</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Enter your Sri Lankan mobile number</Text>

          <View style={styles.inputRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+94</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="7X XXX XXXX"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Send OTP</Text>
            }
          </TouchableOpacity>

          <View style={styles.perksRow}>
            {PERKS.map(perk => (
              <View key={perk.label} style={styles.perk}>
                <Text style={styles.perkIcon}>{perk.icon}</Text>
                <Text style={styles.perkLabel}>{perk.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },

    hero: {
      backgroundColor: c.primary,
      paddingTop: 64, paddingBottom: 56, paddingHorizontal: 24,
      alignItems: 'center', overflow: 'hidden', position: 'relative',
    },
    heroRoad: {
      position: 'absolute', bottom: 34, left: -20, right: -20, height: 3,
      backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ rotate: '-2deg' }],
    },
    logo: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    tagline: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },

    badgeWrap: { alignItems: 'center', height: 0 },
    badge: {
      position: 'absolute', top: -32, alignSelf: 'center',
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
      borderWidth: 4, borderColor: c.background,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    badgeIcon: { fontSize: 26 },

    card: {
      backgroundColor: c.surface, borderRadius: 20,
      marginHorizontal: 20, marginTop: 40,
      paddingTop: 24, paddingHorizontal: 24, paddingBottom: 20,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
    },
    title: { fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 22 },
    inputRow: { flexDirection: 'row', marginBottom: 20 },
    prefix: {
      backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, justifyContent: 'center', marginRight: 8,
    },
    prefixText: { fontSize: 16, fontWeight: '600', color: c.textBody },
    input: {
      flex: 1, backgroundColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: c.text, letterSpacing: 0,
    },
    button: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    perksRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border,
    },
    perk: { flex: 1, alignItems: 'center' },
    perkIcon: { fontSize: 18 },
    perkLabel: { fontSize: 10, color: c.textMuted, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: 13 },
  })
}
