import React, { useMemo } from 'react'
import { View, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'

// Shared RN Modal wrapper for every Mart bottom sheet (Who bought it?, Report, Block,
// Offer, Rate seller, Reviews, etc. — 04-screens.md §9.1, §14.1, §17, §20.1, §20.2).
// Spec gives each sheet its own "starts N px below top" value; `topOffset` covers that
// (defaults to a sensible middle value) rather than one fixed height for every sheet.
export default function MartBottomSheet({
  visible, onClose, children, topOffset = 200,
}: {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  topOffset?: number
}) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors, topOffset), [colors, topOffset])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
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
  })
}
