import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  token: string
  onSelected: (userType: 'owner' | 'garage') => void
  onCancel: () => void
}

export default function RoleSelectScreen({ token, onSelected, onCancel }: Props) {
  const [selected, setSelected] = useState<'owner' | 'garage' | null>(null)
  const [saving, setSaving] = useState(false)
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  const handleContinue = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.setUserType(token, selected)
      onSelected(selected)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onCancel} style={styles.cancelLink} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.cancelLinkText}>← Use a different number</Text>
      </TouchableOpacity>

      <View style={styles.top}>
        <Text style={styles.appName}>Vocksy</Text>
        <Text style={styles.title}>How will you use the app?</Text>
        <Text style={styles.subtitle}>
          Choose your primary role. You can always use both features after setup.
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, selected === 'owner' && styles.cardSelected]}
          onPress={() => setSelected('owner')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🚗</Text>
          <Text style={[styles.cardTitle, selected === 'owner' && styles.cardTitleSelected]}>
            Vehicle Owner
          </Text>
          <Text style={[styles.cardDesc, selected === 'owner' && styles.cardDescSelected]}>
            Track your vehicles, log service history, manage expenses and book garage appointments.
          </Text>
          {selected === 'owner' && (
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓ Selected</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, selected === 'garage' && styles.cardSelected]}
          onPress={() => setSelected('garage')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🏭</Text>
          <Text style={[styles.cardTitle, selected === 'garage' && styles.cardTitleSelected]}>
            Garage / Service Center
          </Text>
          <Text style={[styles.cardDesc, selected === 'garage' && styles.cardDescSelected]}>
            Manage your garage, receive bookings, submit service records to customers — and track your own personal vehicles too.
          </Text>
          {selected === 'garage' && (
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓ Selected</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, (!selected || saving) && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!selected || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.continueBtnText}>Continue →</Text>
        }
      </TouchableOpacity>

      <Text style={styles.note}>
        You can access all features after setup. This setting can be changed in your profile.
      </Text>
    </ScrollView>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    content: {
      paddingHorizontal: 24, paddingTop: topInset + 20, paddingBottom: 40,
    },
    cancelLink: { marginBottom: 20 },
    cancelLinkText: { fontSize: 14, color: c.primary, fontWeight: '600' },
    top: { marginBottom: 32 },
    appName: {
      fontSize: 14, fontWeight: '700', color: c.primary,
      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20,
    },
    title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 10, lineHeight: 34 },
    subtitle: { fontSize: 15, color: c.textMuted, lineHeight: 22 },

    cards: { gap: 16, marginBottom: 24 },
    card: {
      borderWidth: 2, borderColor: c.borderMid, borderRadius: 18,
      padding: 24, backgroundColor: c.surface,
    },
    cardSelected: { borderColor: c.primary, backgroundColor: c.primaryTint },
    cardIcon: { fontSize: 36, marginBottom: 12 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 8 },
    cardTitleSelected: { color: c.primary },
    cardDesc: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
    cardDescSelected: { color: c.textSub },
    checkBadge: {
      marginTop: 14, alignSelf: 'flex-start',
      backgroundColor: c.primary, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 6,
    },
    checkText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    continueBtn: {
      backgroundColor: c.primary, borderRadius: 14,
      paddingVertical: 18, alignItems: 'center', marginTop: 24,
    },
    continueBtnDisabled: { opacity: 0.4 },
    continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    note: { fontSize: 12, color: c.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  })
}
