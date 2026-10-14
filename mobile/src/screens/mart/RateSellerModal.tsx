import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import AppIcon from '../../components/AppIcon'
import { api } from '../../config/api'

const COMMENT_MAX = 500

// Spec: 04-screens.md §9.3 "Rate the seller" — centered modal, dimmed background,
// identical pattern to the existing garage rating modal (VehicleDashboardScreen).
export default function RateSellerModal({
  visible, token, listingId, sellerName, onClose, onDone,
}: {
  visible: boolean
  token: string
  listingId: string
  sellerName: string
  onClose: () => void
  onDone: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => { setRating(0); setComment('') }

  const submit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await api.rateMartSeller(token, listingId, rating, comment.trim() || undefined)
      reset()
      onDone()
    } catch (e: any) {
      // Rating is a nice-to-have at this point in the flow (the deal is already
      // confirmed) — a failed submit shouldn't trap the user, so this just closes
      // like Skip rather than blocking on an inline error.
      reset()
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  const skip = () => { reset(); onClose() }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Purchase confirmed</Text>
          <Text style={styles.subtitle}>How was your experience with {sellerName}?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <AppIcon icon={{ lib: 'mci', name: n <= rating ? 'star' : 'star-outline' }} size={38} color={colors.accent} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={t => setComment(t.slice(0, COMMENT_MAX))}
            placeholder="Add a comment (optional)"
            placeholderTextColor={colors.textFaint}
            multiline
            numberOfLines={3}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={skip} disabled={submitting}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={rating === 0 || submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(20,28,40,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 360, backgroundColor: c.surface, borderRadius: 18, padding: 22 },
    title: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: 13.5, color: c.textMuted, textAlign: 'center', marginTop: 8 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 20, marginBottom: 20 },
    commentInput: {
      backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 14, color: c.text, minHeight: 72, textAlignVertical: 'top',
    },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    skipBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
    skipBtnText: { color: c.textMuted, fontWeight: '700', fontSize: 14 },
    submitBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}
