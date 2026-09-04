import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useTranslation } from '../i18n/LanguageContext'

type Props = {
  token: string
  onDone: () => void
}

export default function EmailSetupScreen({ token, onDone }: Props) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      await api.saveEmail(token, email.trim())
      onDone()
    } catch (e: any) {
      setError(e.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📧</Text>
        </View>

        <Text style={styles.title}>{t('emailSetup.title')}</Text>
        <Text style={styles.subtitle}>{t('emailSetup.subtitle')}</Text>

        <View style={styles.reasons}>
          <ReasonRow icon="🔑" text={t('emailSetup.reason1')} />
          <ReasonRow icon="📅" text={t('emailSetup.reason2')} />
          <ReasonRow icon="🔔" text={t('emailSetup.reason3')} />
        </View>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={email}
          onChangeText={t => { setEmail(t); setError('') }}
          placeholder={t('profile.emailPlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!isValidEmail || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isValidEmail || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{t('emailSetup.save')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={onDone} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>{t('emailSetup.skip')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function ReasonRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: '#555', flex: 1 }}>{text}</Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 28, paddingTop: 60, alignItems: 'center' },

    iconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    },
    icon: { fontSize: 32 },

    title: {
      fontSize: 22, fontWeight: '800', color: c.text,
      textAlign: 'center', marginBottom: 10,
    },
    subtitle: {
      fontSize: 14, color: c.textSub, textAlign: 'center',
      lineHeight: 20, marginBottom: 24,
    },

    reasons: {
      width: '100%', backgroundColor: c.surface,
      borderRadius: 14, padding: 16, marginBottom: 24,
    },

    input: {
      width: '100%', borderWidth: 1.5, borderColor: c.borderMid,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: c.text, backgroundColor: c.surface,
    },
    inputError: { borderColor: c.error },
    errorText: { color: c.error, fontSize: 13, marginTop: 6, alignSelf: 'flex-start' },

    saveBtn: {
      width: '100%', backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center', marginTop: 16,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    skipBtn: { marginTop: 16, paddingVertical: 10 },
    skipBtnText: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
  })
}
