import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert
} from 'react-native'
import { api } from '../config/api'

type Props = {
  onOTPSent: (phoneNumber: string) => void
}

export default function LoginScreen({ onOTPSent }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

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
      <View style={styles.inner}>
        <Text style={styles.logo}>TechVehicle</Text>
        <Text style={styles.tagline}>Your vehicle companion</Text>

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
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  inputRow: { flexDirection: 'row', marginBottom: 20 },
  prefix: {
    backgroundColor: '#f0f0f0', borderRadius: 10,
    paddingHorizontal: 14, justifyContent: 'center', marginRight: 8,
  },
  prefixText: { fontSize: 16, fontWeight: '600', color: '#333' },
  input: {
    flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
