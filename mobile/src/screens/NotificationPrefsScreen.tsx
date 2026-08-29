import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations/en'

type Props = {
  token: string
  onBack: () => void
}

const PREFS: { key: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    key: 'service_due',
    titleKey: 'notificationPrefs.serviceDue.title',
    descKey: 'notificationPrefs.serviceDue.desc',
  },
  {
    key: 'mileage_reminder',
    titleKey: 'notificationPrefs.mileageReminder.title',
    descKey: 'notificationPrefs.mileageReminder.desc',
  },
  {
    key: 'renewal',
    titleKey: 'notificationPrefs.renewal.title',
    descKey: 'notificationPrefs.renewal.desc',
  },
  {
    key: 'insurance_reminder',
    titleKey: 'notificationPrefs.insuranceReminder.title',
    descKey: 'notificationPrefs.insuranceReminder.desc',
  },
  {
    key: 'booking',
    titleKey: 'notificationPrefs.booking.title',
    descKey: 'notificationPrefs.booking.desc',
  },
  {
    key: 'transfer',
    titleKey: 'notificationPrefs.transfer.title',
    descKey: 'notificationPrefs.transfer.desc',
  },
  {
    key: 'submission',
    titleKey: 'notificationPrefs.submission.title',
    descKey: 'notificationPrefs.submission.desc',
  },
  {
    key: 'garage_reminder',
    titleKey: 'notificationPrefs.garageReminder.title',
    descKey: 'notificationPrefs.garageReminder.desc',
  },
]

export default function NotificationPrefsScreen({ token, onBack }: Props) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    service_due: true,
    mileage_reminder: true,
    renewal: true,
    insurance_reminder: true,
    booking: true,
    transfer: true,
    submission: true,
    garage_reminder: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useTranslation()

  useEffect(() => {
    api.getNotificationPrefs(token)
      .then(setPrefs)
      .catch((e: any) => Alert.alert(t('common.error'), e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: string, value: boolean) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSaving(key)
    try {
      await api.saveNotificationPrefs(token, updated)
    } catch (e: any) {
      setPrefs(prefs)
      Alert.alert(t('common.error'), e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('notificationPrefs.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t('notificationPrefs.subtitle')}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <View style={styles.card}>
          {PREFS.map((pref, index) => (
            <View
              key={pref.key}
              style={[styles.row, index < PREFS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(pref.titleKey)}</Text>
                <Text style={styles.rowDesc}>{t(pref.descKey)}</Text>
              </View>
              <View style={styles.switchWrapper}>
                {saving === pref.key ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={prefs[pref.key] ?? true}
                    onValueChange={(v) => handleToggle(pref.key, v)}
                    trackColor={{ false: colors.borderMid, true: colors.primaryTint }}
                    thumbColor={prefs[pref.key] ? colors.primary : colors.surfaceAlt}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {t('notificationPrefs.easNote')}
        </Text>
      </View>
      </ScrollView>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 13, color: c.textMuted, marginBottom: 28 },
    card: {
      backgroundColor: c.surface, borderRadius: 14,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 18, gap: 12,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 3 },
    rowDesc: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
    switchWrapper: { width: 52, alignItems: 'center' },
    noteBox: {
      backgroundColor: c.primaryTint, borderRadius: 10, padding: 14, marginTop: 24,
    },
    noteText: { fontSize: 12, color: c.primaryTintText, lineHeight: 18 },
  })
}
