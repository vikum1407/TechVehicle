import React, { useMemo, useState } from 'react'
import { Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import { useTranslation } from '../../i18n/LanguageContext'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import DistrictPickerScreen from './DistrictPickerScreen'
import { DISTRICTS } from '../../constants/districts'
import { localizedLabel } from '../../utils/martHelpers'
import { api } from '../../config/api'

// Spec: 04-screens.md §22 point 1 — first-action gate, step 1 of 2 (step 2 is
// MartRulesScreen). Saves with PATCH /mart/me. The district field opens the full-screen
// District picker (21.3) as its own ad-hoc Modal layered above this sheet, since the
// picker is meant to cover the whole screen, not fit inside the sheet's card.
//
// Step 1.6: also reused as-is for My Mart's "Edit" action (name + district only, no
// photo) — `title`/`continueLabel` let that caller swap the gate's "Before you start" /
// "Continue" copy for "Edit profile" / "Save" without duplicating this whole component.
export default function NameDistrictSheet({
  visible, token, initialName, initialDistrict, title, continueLabel, onDone, onClose,
}: {
  visible: boolean
  token: string
  initialName?: string | null
  initialDistrict?: string | null
  title?: string
  continueLabel?: string
  onDone: () => void
  onClose?: () => void
}) {
  const colors = useColors()
  const { t, language } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [name, setName] = useState(initialName || '')
  const [district, setDistrict] = useState<string | null>(initialDistrict || null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmedName = name.trim()
  const canContinue = trimmedName.length >= 2 && trimmedName.length <= 40 && !!district && !saving
  const selectedDistrict = district ? DISTRICTS.find(d => d.id === district) : null
  const districtLabel = selectedDistrict ? localizedLabel(language, selectedDistrict) : null

  const submit = async () => {
    if (!canContinue) return
    setSaving(true)
    setError('')
    try {
      await api.patchMartMe(token, { displayName: trimmedName, district: district! })
      onDone()
    } catch {
      setError(t('mart.editProfile.couldntSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MartBottomSheet
        visible={visible}
        onClose={onClose || (() => {})}
        topOffset={260}
        footer={
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
              disabled={!canContinue}
              onPress={submit}
            >
              <Text style={styles.continueBtnText}>{saving ? t('mart.postAd.saving') : (continueLabel ?? t('mart.nameDistrict.continue'))}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <Text style={styles.title}>{title ?? t('mart.nameDistrict.beforeYouStart')}</Text>

        <Text style={styles.label}>{t('mart.editProfile.yourName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('mart.editProfile.namePlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={v => setName(v.slice(0, 40))}
          maxLength={40}
        />
        <Text style={styles.hint}>{t('mart.editProfile.nameHint')}</Text>

        <Text style={styles.label}>{t('mart.detail.district')}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setPickerOpen(true)}>
          <Text style={districtLabel ? styles.inputValueText : styles.inputPlaceholderText}>
            {districtLabel || t('mart.editProfile.selectYourDistrict')}
          </Text>
        </TouchableOpacity>

      </MartBottomSheet>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <DistrictPickerScreen
          selected={district}
          onSelect={setDistrict}
          onClose={() => setPickerOpen(false)}
        />
      </Modal>
    </>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 16 },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textSub, marginBottom: 6, marginTop: 10 },
    input: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14.5, color: c.text, justifyContent: 'center',
    },
    inputValueText: { fontSize: 14.5, color: c.text },
    inputPlaceholderText: { fontSize: 14.5, color: c.textFaint },
    hint: { fontSize: 11.5, color: c.textMuted, marginTop: 6 },
    error: { fontSize: 12.5, color: c.error, marginTop: 14 },
    continueBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
    continueBtnDisabled: { opacity: 0.5 },
    continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  })
}
