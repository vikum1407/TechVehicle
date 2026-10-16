import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import AppIcon from '../../components/AppIcon'
import { api } from '../../config/api'

const NOTE_MAX = 300

const REASONS: { id: string; label: string; sub: string; adHidden?: boolean }[] = [
  { id: 'scam', label: 'Scam or fraud', sub: 'Asks for money first, fake seller' },
  { id: 'fake', label: 'Fake or misleading ad', sub: 'Wrong photos, counterfeit part' },
  { id: 'prohibited', label: 'Prohibited item', sub: 'Stolen or illegal parts' },
  { id: 'spam', label: 'Spam or duplicate', sub: 'Same ad many times, unrelated' },
  { id: 'abuse', label: 'Abusive messages', sub: 'Threats or harassment in chat', adHidden: true },
  { id: 'other', label: 'Something else', sub: 'Tell us in a few words' },
]

// Spec: 04-screens.md §20.1 "Report sheet (A Reason List Sheet)". Milestone 3 Step 3.1.
// Shared component, opened from Ad detail, Wanted ad detail, Seller public profile and
// Chat thread header. `targetType` 'wanted' is UI-only (changes the title copy) — the
// wire-level POST always sends 'listing' for both selling and wanted ads, since both are
// MartListing rows; `02-data-model.md`/`03-api.md` only ever name 3 real target types.
export default function MartReportSheet({
  visible, token, targetType, targetId, onClose, onDone, onBlock,
}: {
  visible: boolean
  token: string
  targetType: 'listing' | 'wanted' | 'user' | 'message'
  targetId: string
  onClose: () => void
  onDone: () => void
  // "Also block" on the success screen — omit entirely to hide that button (e.g. Block,
  // Step 3.2, doesn't exist yet, so no caller passes this right now).
  onBlock?: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [alreadyReported, setAlreadyReported] = useState(false)

  const isAdType = targetType === 'listing' || targetType === 'wanted'
  const visibleReasons = REASONS.filter(r => !r.adHidden || !isAdType)
  const canSend = !!reason && (reason !== 'other' || note.trim().length > 0) && !sending

  const reset = () => { setReason(null); setNote(''); setError(''); setSent(false); setAlreadyReported(false) }
  const close = () => { reset(); onClose() }
  const finish = () => { reset(); onDone() }

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError('')
    try {
      const apiTargetType = targetType === 'wanted' ? 'listing' : targetType
      const result = await api.postMartReport(token, { targetType: apiTargetType, targetId, reason: reason!, note: note.trim() || undefined })
      setAlreadyReported(result.code === 'ALREADY_REPORTED')
      setSent(true)
    } catch (e: any) {
      setError(e.message || "Couldn't send report. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  const title = targetType === 'user' || targetType === 'message'
    ? 'Report this user'
    : targetType === 'wanted' ? 'Report this request' : 'Report this ad'

  if (sent) {
    return (
      <MartBottomSheet visible={visible} onClose={finish} topOffset={220}>
        <View style={styles.sentWrap}>
          <View style={styles.sentIconCircle}>
            <AppIcon icon={{ lib: 'ion', name: 'checkmark' }} size={28} color="#fff" />
          </View>
          <Text style={styles.sentTitle}>{alreadyReported ? 'Already reported' : 'Report sent'}</Text>
          <Text style={styles.sentBody}>
            {alreadyReported
              ? "You've already reported this recently — our team has it."
              : 'Thank you. We will look at it. You will not get a reply for each report.'}
          </Text>
          {onBlock ? (
            <TouchableOpacity style={styles.blockBtn} onPress={() => { reset(); onBlock() }}>
              <Text style={styles.blockBtnText}>Also block</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.doneBtn} onPress={finish}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </MartBottomSheet>
    )
  }

  return (
    <MartBottomSheet visible={visible} onClose={close} topOffset={150}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subLine}>What is wrong? Only Vocksy sees your report.</Text>

      {visibleReasons.map(r => (
        <TouchableOpacity key={r.id} style={styles.reasonRow} onPress={() => setReason(r.id)}>
          <View style={[styles.radio, reason === r.id && styles.radioActive]}>
            {reason === r.id ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reasonLabel}>{r.label}</Text>
            <Text style={styles.reasonSub}>{r.sub}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {reason === 'other' ? (
        <TextInput
          style={styles.noteInput}
          placeholder="Tell us what's wrong"
          placeholderTextColor={colors.textFaint}
          value={note}
          onChangeText={t => setNote(t.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          multiline
          numberOfLines={3}
        />
      ) : null}

      <View style={styles.disputeBox}>
        <Text style={styles.disputeText}>
          Vocksy cannot settle price or quality disagreements between buyers and sellers. Report scams, fakes and prohibited items only.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={sending}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]} onPress={send} disabled={!canSend}>
          <Text style={styles.sendBtnText}>{sending ? 'Sending…' : 'Send report'}</Text>
        </TouchableOpacity>
      </View>
    </MartBottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    subLine: { fontSize: 12.5, color: c.textMuted, marginTop: 4, marginBottom: 16 },

    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderMid, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    radioActive: { borderColor: c.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
    reasonLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    reasonSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    noteInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14, color: c.text, minHeight: 64, textAlignVertical: 'top', marginTop: 6, marginBottom: 6,
    },

    disputeBox: { backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 14 },
    disputeText: { fontSize: 11.5, color: c.textMuted, lineHeight: 16 },

    error: { fontSize: 12.5, color: c.error, marginTop: 12 },

    btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    cancelBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    sendBtn: { flex: 1.4, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    sentWrap: { alignItems: 'center', paddingVertical: 8 },
    sentIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    sentTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    sentBody: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    blockBtn: { borderWidth: 1, borderColor: '#c0392b', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 24, marginTop: 20, alignSelf: 'stretch', alignItems: 'center' },
    blockBtnText: { color: '#c0392b', fontWeight: '700', fontSize: 14 },
    doneBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 24, marginTop: 12, alignSelf: 'stretch', alignItems: 'center' },
    doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}
