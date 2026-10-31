import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'

// Same sw600dp threshold Android itself uses for its own tablet resource
// qualifier, and the same one App.tsx's OrientationGuard already uses - keep
// these in sync if either ever changes.
const TABLET_BREAKPOINT = 600
const MAX_CONTENT_WIDTH = 480
const TABLET_SCALE = 1.15

// Deliberately reads Dimensions.get('screen') (real physical display), not
// useWindowDimensions()/'window' - see App.tsx's OrientationGuard comment for
// why 'window' can report a false reading on some boundary-sized devices.
export function useResponsiveLayout() {
  const [screen, setScreen] = useState(() => Dimensions.get('screen'))

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setScreen(Dimensions.get('screen')))
    return () => sub.remove()
  }, [])

  const isTablet = Math.min(screen.width, screen.height) >= TABLET_BREAKPOINT

  return {
    isTablet,
    maxContentWidth: MAX_CONTENT_WIDTH,
    // Scales a single size (fontSize, icon size, a key padding/margin) up
    // modestly on tablets. Phones get the value back unchanged - this must
    // never alter existing phone layouts.
    scale: (value: number) => (isTablet ? Math.round(value * TABLET_SCALE) : value),
  }
}
