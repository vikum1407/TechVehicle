import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  phoneNumber: string
  onVerified: (token: string, phoneNumber: string) => void
  onBack: () => void
}

export default function OTPScreen({ phoneNumber, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code.')
      return
    }

    setLoading(true)
    try {
      const result = await api.verifyOTP(phoneNumber, otp)
      onVerified(result.token, result.phoneNumber)
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
        <Text style={styles.logo}>TechVehicle</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#1a73e8', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, shadowColor: '#000',
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 4, lineHeight: 22 },
  phone: { fontWeight: '700', color: '#1a73e8' },
  devNote: { fontSize: 12, color: '#f0a500', marginBottom: 20 },
  otpInput: {
    backgroundColor: '#f0f0f0', borderRadius: 10,
    paddingVertical: 18, fontSize: 28,
    fontWeight: '700', letterSpacing: 12,
    color: '#1a1a1a', marginBottom: 20,
  },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: '#1a73e8', fontSize: 14 },
})
