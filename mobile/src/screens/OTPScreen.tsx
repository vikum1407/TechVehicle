import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  phoneNumber: string
  onVerified: (token: string, phoneNumber: string, userType: string | null, isNewUser: boolean) => void
  onBack: () => void
}

export default function OTPScreen({ phoneNumber, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code.')
      return
    }

    setLoading(true)
    try {
      const result = await api.verifyOTP(phoneNumber, otp)
      onVerified(result.token, result.phoneNumber, result.userType || null, result.isNewUser || false)
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
      <View style={styles.inner}>
        <Text style={styles.logo}>Vocksy</Text>
        <Text style={styles.tagline}>Your vehicle companion</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            A 6-digit code was sent to{'\n'}
            <Text style={styles.phone}>{phoneNumber}</Text>
          </Text>
          <Text style={styles.devNote}>
            (Development mode: check the backend terminal for the OTP)
          </Text>

          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            textAlign="center"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Verify</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>Change number</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logo: { fontSize: 32, fontWeight: '700', color: c.primary, textAlign: 'center' },
    tagline: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 40 },
    card: {
      backgroundColor: c.surface, borderRadius: 16,
      padding: 24, shadowColor: '#000',
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    },
    title: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 6 },
    subtitle: { fontSize: 14, color: c.textSub, marginBottom: 4, lineHeight: 22 },
    phone: { fontWeight: '700', color: c.primary },
    devNote: { fontSize: 12, color: '#f0a500', marginBottom: 20 },
    otpInput: {
      backgroundColor: c.border, borderRadius: 10,
      paddingVertical: 18, fontSize: 28,
      fontWeight: '700', letterSpacing: 12,
      color: c.text, marginBottom: 20,
    },
    button: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 16, alignItems: 'center', marginBottom: 12,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    backButton: { alignItems: 'center', paddingVertical: 8 },
    backText: { color: c.primary, fontSize: 14 },
  })
}
