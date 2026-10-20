import React, { useMemo } from 'react'
import { View, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'

// Shared RN Modal wrapper for every Mart bottom sheet (Who bought it?, Report, Block,
// Offer, Rate seller, Reviews, etc. — 04-screens.md §9.1, §14.1, §17, §20.1, §20.2).
// Spec gives each sheet its own "starts N px below top" value; `topOffset` covers that
// (defaults to a sensible middle value) rather than one fixed height for every sheet.
//
// Fixed on-device Oct 11, in two parts, both found testing NameDistrictSheet's name
// field: (1) a RN Modal on Android doesn't automatically resize for the keyboard the
// way a normal screen does, so KeyboardAvoidingView is needed to push the sheet up;
// (2) once pushed up, the sheet's own fixed-height content (district field, Continue
// button) no longer fit on screen with no way to reach them — wrapping `children` in a
// ScrollView (keyboardShouldPersistTaps="handled" so a button tap works without first
// needing a second tap to dismiss the keyboard) fixes that. Both fixes apply to every
// sheet built on this component, not just the one that surfaced them.
//
// `footer` added 2026-10-20: a real bug, found on-device in si/ta (Vikum's screenshots,
// Block sheet) — every sheet used to put its own action buttons inside `children`,
// meaning they scrolled along with the body. Sinhala/Tamil text routinely wraps onto
// more lines than the English original, so once the body got tall enough, the buttons
// slid toward or past the bottom edge with no scroll indicator hinting there was more
// below — they looked "missing" rather than just scrolled away. `footer` renders
// outside the ScrollView, pinned to the bottom of the sheet, always visible regardless
// of how tall the body content is in any language. The ScrollView gets `flexShrink: 1`
// so the body (not the footer) is what absorbs the overflow via internal scrolling.
export default function MartBottomSheet({
  visible, onClose, children, footer, topOffset = 200,
}: {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  topOffset?: number
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors, topOffset), [colors, topOffset])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        pointerEvents="box-none"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(c: Colors, topOffset: number) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,28,40,0.5)' },
    sheetWrap: { flex: 1, justifyContent: 'flex-end', marginTop: topOffset },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 10, paddingHorizontal: 20, paddingBottom: 28,
      maxHeight: '100%',
    },
    grabber: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderMid,
      alignSelf: 'center', marginBottom: 16,
    },
    scrollArea: { flexShrink: 1 },
    footer: { paddingTop: 14 },
  })
}
