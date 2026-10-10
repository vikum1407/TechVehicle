import React, { useEffect, useState } from 'react'
import { BackHandler, Alert } from 'react-native'
import MartHomeScreen from './mart/MartHomeScreen'
import FiltersScreen, { MartFilters, DEFAULT_MART_FILTERS } from './mart/FiltersScreen'
import PostAdScreen from './mart/PostAdScreen'

// Step 0.11 — Mart's OWN internal navigation, deliberately separate from App.tsx's
// global `Screen`/`backMap` system rather than adding 15+ entries there. App.tsx only
// knows about ONE screen value ('mart'); everything Mart-internal happens inside this
// component's own stack, with its own BackHandler listener (registered while this
// component is mounted, so it intercepts back-press before App.tsx's root listener —
// RN calls the most-recently-added listener first). When the Mart stack is back down
// to its first entry, this listener returns false and lets the press fall through to
// App.tsx's existing backMap unchanged (mart -> vehicles).
//
// Step 1.3: 'home' now renders the real Mart Home (MartHomeScreen) instead of the Step
// 0.10 dev preview screen — that screen remains in the codebase, just no longer wired
// here. 'filters' and 'postAd' are the first two real stack entries pushed with push()/
// pop(). Screens whose destination isn't built yet (Favorites, Messages, Notifications,
// My Mart, Detail) are stubbed with a plain Alert from MartHomeScreen itself for now.
type MartScreenName = 'home' | 'filters' | 'postAd'
type MartStackEntry = { screen: MartScreenName }

// Screens where the spec (04-screens.md §0.2) hides the bottom tab bar. App.tsx can't
// see inside this component's own stack, so it's told via `onFullScreenChange`.
const FULL_SCREEN: MartScreenName[] = ['filters', 'postAd']

export default function MartNavigator({ onExit, token, onFullScreenChange }: {
  onExit: () => void
  token: string
  onFullScreenChange?: (isFullScreen: boolean) => void
}) {
  const [stack, setStack] = useState<MartStackEntry[]>([{ screen: 'home' }])
  const [filters, setFilters] = useState<MartFilters>(DEFAULT_MART_FILTERS)

  const push = (screen: MartScreenName) => setStack(prev => [...prev, { screen }])
  const pop = () => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))

  const current = stack[stack.length - 1]

  useEffect(() => {
    onFullScreenChange?.(FULL_SCREEN.includes(current.screen))
  }, [current.screen])

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop()
        return true
      }
      return false // let App.tsx's own listener handle it (mart -> vehicles)
    })
    return () => handler.remove()
  }, [stack])

  if (current.screen === 'home') {
    return (
      <MartHomeScreen
        token={token}
        filters={filters}
        onFiltersChange={setFilters}
        onOpenFilters={() => push('filters')}
        onOpenPostAd={() => push('postAd')}
      />
    )
  }

  if (current.screen === 'filters') {
    return (
      <FiltersScreen
        token={token}
        initial={filters}
        onClose={pop}
        onApply={f => { setFilters(f); pop() }}
      />
    )
  }

  if (current.screen === 'postAd') {
    return (
      <PostAdScreen
        token={token}
        onBack={pop}
        onPosted={() => {
          // Detail doesn't exist yet (Step 1.4), so there's nowhere to navigate the new
          // ad to — pop back to Home instead, which remounts fresh and so refetches the
          // feed, making the new ad visible as confirmation that it really posted.
          pop()
          Alert.alert('Posted', 'Your ad is live on Vocksy Mart.')
        }}
      />
    )
  }

  return null
}
