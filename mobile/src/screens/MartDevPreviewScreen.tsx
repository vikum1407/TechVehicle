import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import MartTag from '../components/mart/MartTag'
import RatingBadge from '../components/mart/RatingBadge'
import MartEmptyState from '../components/mart/MartEmptyState'
import MartToast from '../components/mart/MartToast'
import MartBottomSheet from '../components/mart/MartBottomSheet'
import MartPhotoViewer from '../components/mart/MartPhotoViewer'
import MartListingCard from '../components/mart/MartListingCard'
import MartListingRow from '../components/mart/MartListingRow'
import ReviewsModal from '../components/mart/ReviewsModal'
import AppIcon from '../components/AppIcon'

// Step 0.10 done-check: "a hidden dev screen renders each [component] in light + dark."
// Not wired into navigation yet — the app follows the phone's system light/dark setting
// everywhere already (no in-app override exists), so check this the same way: toggle
// the phone's own appearance setting while this screen is open. Reachability (how you
// actually get to this screen) is added in Step 0.11 alongside the real Mart tab.
export default function MartDevPreviewScreen({ onBack }: { onBack: () => void }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [toastVisible, setToastVisible] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [reviewsVisible, setReviewsVisible] = useState(false)

  const samplePhotos = ['https://picsum.photos/seed/mart1/800', 'https://picsum.photos/seed/mart2/800']

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mart Component Preview" subtitle="Dev only — Step 0.10" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.section}>MartTag</Text>
        <View style={styles.row}>
          <MartTag label="Available" variant="success-outline" />
          <MartTag label="Reserved" variant="amber-soft" />
          <MartTag label="Sold" variant="gray" />
          <MartTag label="Wanted" variant="amber-solid" />
        </View>

        <Text style={styles.section}>RatingBadge</Text>
        <View style={styles.row}>
          <RatingBadge avg={4.8} count={12} label="Parts sales" />
          <RatingBadge avg={null} count={0} />
        </View>

        <Text style={styles.section}>MartEmptyState</Text>
        <MartEmptyState
          icon={{ lib: 'ion', name: 'heart-outline' }}
          title="No favorites yet. Tap the heart on any ad to save it."
          actionLabel="Browse Mart"
          onAction={() => {}}
        />

        <Text style={styles.section}>MartListingCard (2-column grid)</Text>
        <View style={styles.grid}>
          <MartListingCard
            title="Brake Pads (Front) — Toyota Axio"
            coverUrl={null}
            price={3500}
            condition="used"
            districtLabel="Colombo"
            status="available"
            isFavorited={false}
            onPress={() => {}}
            onToggleFavorite={() => {}}
          />
          <MartListingCard
            title="Side Mirror (Left) — Suzuki Alto"
            coverUrl={null}
            price={6200}
            condition="new"
            districtLabel="Kandy"
            status="reserved"
            isFavorited={true}
            onPress={() => {}}
            onToggleFavorite={() => {}}
          />
        </View>

        <Text style={styles.section}>MartListingRow</Text>
        <MartListingRow
          title="Brake Pads (Front) — Toyota Axio 2015-2018"
          coverUrl={null}
          price={3500}
          metaLine="Colombo 5 · Used"
          statusTag={{ label: 'Reserved', variant: 'amber-soft' }}
          onPress={() => {}}
          favoriteButton={<AppIcon icon={{ lib: 'ion', name: 'heart' }} size={18} color={colors.accent} />}
        />

        <Text style={styles.section}>Buttons that open overlays</Text>
        <View style={styles.row}>
          <Text style={styles.link} onPress={() => setToastVisible(true)}>Show MartToast</Text>
          <Text style={styles.link} onPress={() => setSheetVisible(true)}>Show MartBottomSheet</Text>
          <Text style={styles.link} onPress={() => setPhotoViewerVisible(true)}>Show MartPhotoViewer</Text>
          <Text style={styles.link} onPress={() => setReviewsVisible(true)}>Show ReviewsModal</Text>
        </View>
      </ScrollView>

      <MartToast
        visible={toastVisible}
        message="Unfollowed."
        actionLabel="Undo"
        onAction={() => setToastVisible(false)}
        onHide={() => setToastVisible(false)}
      />
      <MartBottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Sample sheet content</Text>
      </MartBottomSheet>
      <MartPhotoViewer visible={photoViewerVisible} photos={samplePhotos} label="Sample listing" onClose={() => setPhotoViewerVisible(false)} />
      <ReviewsModal
        visible={reviewsVisible}
        onClose={() => setReviewsVisible(false)}
        summary={{ avg: 4.5, count: 31, distribution: { '5': 20, '4': 7, '3': 2, '2': 1, '1': 1 } }}
        items={[
          { id: '1', rating: 5, comment: 'Great seller, fast reply and the part was exactly as described.', timeAgoLabel: '2 days ago', listingTitle: 'Brake Pads (Front) — Toyota Axio' },
          { id: '2', rating: 4, comment: 'Good price. Took a day to answer.', timeAgoLabel: '1 week ago', listingTitle: 'Alternator — Nissan Sunny' },
        ]}
        loading={false}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 8 },
    section: { fontSize: 13, fontWeight: '700', color: c.textMuted, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
    grid: { flexDirection: 'row', gap: 12 },
    link: { color: c.primary, fontWeight: '600', fontSize: 13 },
  })
}
