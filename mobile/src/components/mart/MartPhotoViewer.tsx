import React, { useMemo, useRef, useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, Image, Dimensions, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../../theme/ThemeContext'
import { Colors } from '../../theme/colors'

// Extracted from the swipeable photo viewer already used in VehicleDashboardScreen /
// BookingScreen / VehicleHistoryScreen (same Modal + horizontal paging FlatList
// pattern, no new dependency) so Mart can reuse it instead of a 4th copy.
export default function MartPhotoViewer({
  visible, photos, initialIndex = 0, label, onClose,
}: {
  visible: boolean
  photos: string[]
  initialIndex?: number
  label?: string
  onClose: () => void
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const listRef = useRef<FlatList<string>>(null)
  const [index, setIndex] = useState(initialIndex)
  const W = Dimensions.get('window').width

  useEffect(() => { if (visible) setIndex(initialIndex) }, [visible, initialIndex])

  const goTo = (i: number) => {
    setIndex(i)
    listRef.current?.scrollToIndex({ index: i, animated: true })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.bg}>
        <View style={styles.header}>
          <Text style={styles.label} numberOfLines={1}>{label || ''}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item: url }) => (
            <View style={{ width: W, justifyContent: 'center', alignItems: 'center' }}>
              <Image source={{ uri: url }} style={{ width: W, height: '100%' }} resizeMode="contain" />
            </View>
          )}
          style={{ flex: 1 }}
        />
        {photos.length > 1 && (
          <View style={styles.footer}>
            <TouchableOpacity disabled={index === 0} onPress={() => goTo(index - 1)} style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.counter}>{index + 1} / {photos.length}</Text>
            <TouchableOpacity disabled={index === photos.length - 1} onPress={() => goTo(index + 1)} style={[styles.navBtn, index === photos.length - 1 && styles.navBtnDisabled]}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}

function makeStyles(c: Colors, topInset: number) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 12 },
    label: { color: '#fff', fontSize: 13, flex: 1, marginRight: 12 },
    closeText: { color: '#fff', fontSize: 22, fontWeight: '700' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 18 },
    counter: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 50, textAlign: 'center' },
    navBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    navBtnDisabled: { opacity: 0.25 },
    navText: { color: '#fff', fontSize: 36, lineHeight: 38, fontWeight: '300' },
  })
}
