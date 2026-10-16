import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'
import MartBottomSheet from '../../components/mart/MartBottomSheet'
import { api } from '../../config/api'

const CONSEQUENCES = [
  'Their ads are hidden from you, and yours from them',
  'Chats with them are hidden and you cannot message each other',
  'Follows between you are removed',
  'They are not told that you blocked them',
]

// Spec: 04-screens.md §20.2 "Block (B Consequences Sheet)". Milestone 3 Step 3.2.
// Shared component, opened from Seller public profile, Ad/Wanted detail, Chat thread
// header "..." menus, and the Report-sent screen's "Also block" button.
export default function MartBlockSheet({
  visible, token, sellerId, sellerName, sellerSubtitle, onClose, onDone,
}: {
  visible: boolean
  token: string
  sellerId: string
  sellerName: string
  // Pre-formatted by the caller, e.g. "Kalutara · Casual seller" — each screen already
  // has this context in a different shape, so the sheet doesn't assume a specific one.
  sellerSubtitle?: string
  onClose: () => void
  onDone: () => void
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [blocking, setBlocking] = useState(false)
  const [error, setError] = useState('')

  const block = async () => {
    setBlocking(true)
    setError('')
    try {
      await api.postMartBlock(token, sellerId)
      onDone()
    } catch (e: any) {
      setError(e.message || "Couldn't block. Check your connection and try again.")
    } finally {
      setBlocking(false)
    }
  }

  return (
    <MartBottomSheet visible={visible} onClose={onClose} topOffset={330}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(sellerName || '?')[0]}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Block {sellerName}?</Text>
          {sellerSubtitle ? <Text style={styles.subtitle}>{sellerSubtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.bulletList}>
        {CONSEQUENCES.map(c => (
          <View key={c} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{c}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={blocking}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.blockBtn, blocking && styles.blockBtnDisabled]} onPress={block} disabled={blocking}>
          <Text style={styles.blockBtnText}>{blocking ? 'Blocking…' : 'Block user'}</Text>
        </TouchableOpacity>
      </View>
    </MartBottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    bulletList: { marginTop: 18, gap: 10 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary, marginTop: 6 },
    bulletText: { flex: 1, fontSize: 13.5, color: c.textBody, lineHeight: 19 },

    error: { fontSize: 12.5, color: c.error, marginTop: 14 },

    btnRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    cancelBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    blockBtn: { flex: 1.4, backgroundColor: '#c0392b', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    blockBtnDisabled: { opacity: 0.6 },
    blockBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}
