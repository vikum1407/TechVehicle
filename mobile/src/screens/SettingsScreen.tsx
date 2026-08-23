import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import { useTranslation } from '../i18n/LanguageContext'
import ScreenHeader from '../components/ScreenHeader'

type Props = {
  onBack: () => void
  onNotificationPrefs: () => void
}

export default function SettingsScreen({ onBack, onNotificationPrefs }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, language, setLanguage } = useTranslation()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={t('settings.title')} onBack={onBack} />

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={onNotificationPrefs} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🔔</Text>
          <Text style={styles.rowLabel}>{t('settings.notificationPrefs')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
      <View style={styles.card}>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langOption, language === 'en' && styles.langOptionActive]}
            onPress={() => setLanguage('en')}
            activeOpacity={0.7}
          >
            <Text style={[styles.langOptionText, language === 'en' && styles.langOptionTextActive]}>
              {t('settings.language.english')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langOption, language === 'si' && styles.langOptionActive]}
            onPress={() => setLanguage('si')}
            activeOpacity={0.7}
          >
            <Text style={[styles.langOptionText, language === 'si' && styles.langOptionTextActive]}>
              {t('settings.language.sinhala')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.version}>Vocksy · v1.0.0</Text>
    </ScrollView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 48 },

    card: {
      backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, marginTop: 20,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 16,
    },
    rowIcon: { fontSize: 18 },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    rowChevron: { fontSize: 18, color: c.textMuted },

    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: c.textFaint, textTransform: 'uppercase',
      letterSpacing: 0.5, marginTop: 24, marginBottom: 8, marginHorizontal: 20,
    },
    langRow: { flexDirection: 'row', padding: 12, gap: 10 },
    langOption: {
      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.borderMid,
    },
    langOptionActive: { backgroundColor: c.primary, borderColor: c.primary },
    langOptionText: { fontSize: 14, fontWeight: '700', color: c.textSub },
    langOptionTextActive: { color: '#fff' },

    version: { textAlign: 'center', fontSize: 11, color: c.textFaint, marginTop: 24 },
  })
}
