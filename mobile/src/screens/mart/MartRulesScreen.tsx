import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { MART_RULES, MART_RULES_VERSION } from '../../constants/martRules'
import { api } from '../../config/api'
import AppIcon from '../../components/AppIcon'

// Spec: 04-screens.md §20.4 + §22 point 2. Two modes: 'firstAction' (checkbox + Continue,
// gate step 2 of 2 — step 1 is NameDistrictSheet) saves with POST /mart/rules/accept;
// 'readOnly' (My Mart > Mart rules, not wired up yet — My Mart is a later milestone) is
// just a back arrow with no checkbox. Built now so both modes exist once there's a caller.
export default function MartRulesScreen({
  mode, token, onBack, onAccepted,
}: {
  mode: 'firstAction' | 'readOnly'
  token?: string
  onBack: () => void
  onAccepted?: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const continuePress = async () => {
    if (!checked || !token || saving) return
    setSaving(true)
    setError('')
    try {
      await api.acceptMartRules(token, MART_RULES_VERSION)
      onAccepted?.()
    } catch {
      setError("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon icon={{ lib: 'ion', name: 'arrow-back' }} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mart rules</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>{MART_RULES.intro}</Text>
        {MART_RULES.items.map((rule, i) => (
          <View key={rule.title} style={styles.ruleRow}>
            <View style={styles.numberCircle}>
              <Text style={styles.numberText}>{i + 1}</Text>
            </View>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
              <Text style={styles.ruleDesc}>{rule.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {mode === 'firstAction' && (
        <View style={styles.bottomBar}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setChecked(v => !v)}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <AppIcon icon={{ lib: 'ion', name: 'checkmark' }} size={14} color="#fff" /> : null}
            </View>
            <Text style={styles.checkboxLabel}>I have read and agree to follow the Mart rules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueBtn, !checked && styles.continueBtnDisabled]}
            disabled={!checked || saving}
            onPress={continuePress}
          >
            <Text style={styles.continueBtnText}>{saving ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: topInset + 12, paddingBottom: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { padding: 20 },
    intro: { fontSize: 13.5, color: c.textSub, marginBottom: 20, lineHeight: 19 },
    ruleRow: { flexDirection: 'row', marginBottom: 18 },
    numberCircle: {
      width: 26, height: 26, borderRadius: 13, backgroundColor: c.primaryTint,
      alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1,
    },
    numberText: { fontSize: 12.5, fontWeight: '700', color: c.primaryTintText },
    ruleTextWrap: { flex: 1 },
    ruleTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    ruleDesc: { fontSize: 12.5, color: c.textMuted, marginTop: 3, lineHeight: 17 },
    bottomBar: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 20,
    },
    error: { fontSize: 12.5, color: c.error, marginBottom: 10 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    checkbox: {
      width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: c.borderStrong,
      alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    checkboxLabel: { fontSize: 13, color: c.textBody, flex: 1 },
    continueBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    continueBtnDisabled: { opacity: 0.5 },
    continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  })
}
