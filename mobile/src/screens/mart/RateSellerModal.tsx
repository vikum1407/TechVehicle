import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native'
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
  const [error, setError] = useState('')

  const reset = () => { setRating(0); setComment(''); setError('') }

  const submit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    setError('')
    try {
      await api.rateMartSeller(token, listingId, rating, comment.trim() || undefined)
      reset()
      onDone()
    } catch (e: any) {
      if (e.code === 'ALREADY_RATED') {
        // Previously this closed silently (same as success) for any error, which made
        // a second attempt on the same deal look like it worked every time, even
        // though the backend correctly rejected it — no feedback meant no way to tell
        // the difference. Show it instead.
        setError("You've already rated this seller.")
        return
      }
      // Any other failure (connectivity, validation) — rating is a nice-to-have at
      // this point (the deal's already confirmed), so don't trap the user on an error
      // for something optional; just close like Skip.
      reset()
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  const skip = () => { reset(); onClose() }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={skip}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
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

                {error ? <Text style={styles.error}>{error}</Text> : null}

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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    error: { fontSize: 12.5, color: c.error, marginTop: 10, textAlign: 'center' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    skipBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
    skipBtnText: { color: c.textMuted, fontWeight: '700', fontSize: 14 },
    submitBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}
