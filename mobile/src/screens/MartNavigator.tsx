import React, { useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
import MartHomeScreen from './mart/MartHomeScreen'
import FiltersScreen, { MartFilters, DEFAULT_MART_FILTERS } from './mart/FiltersScreen'
import PostAdScreen from './mart/PostAdScreen'
import DetailScreen from './mart/DetailScreen'

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
// here. Step 1.4 adds 'detail', pushed with a listingId (also from Detail's own Similar
// Parts strip, so tapping a similar ad stacks another Detail rather than replacing it).
// Screens whose destination isn't built yet (Favorites, Messages, Notifications, My
// Mart, Edit, Mark Sold, Message Seller) are stubbed with a plain Alert from inside the
// relevant screen itself for now.
type MartStackEntry =
  | { screen: 'home' }
  | { screen: 'filters' }
  | { screen: 'postAd' }
  | { screen: 'detail'; listingId: string }

// Screens where the spec (04-screens.md §0.2) hides the bottom tab bar. App.tsx can't
// see inside this component's own stack, so it's told via `onFullScreenChange`.
const FULL_SCREEN: MartStackEntry['screen'][] = ['filters', 'postAd', 'detail']

export default function MartNavigator({ onExit, token, onFullScreenChange }: {
  onExit: () => void
  token: string
  onFullScreenChange?: (isFullScreen: boolean) => void
}) {
  const [stack, setStack] = useState<MartStackEntry[]>([{ screen: 'home' }])
  const [filters, setFilters] = useState<MartFilters>(DEFAULT_MART_FILTERS)

  const push = (entry: MartStackEntry) => setStack(prev => [...prev, entry])
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
        onOpenFilters={() => push({ screen: 'filters' })}
        onOpenPostAd={() => push({ screen: 'postAd' })}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
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
        onPosted={id => {
          // Spec: "success -> the new ad's Detail." Replace the postAd entry with
          // detail (rather than pushing on top of it) so back from Detail goes to Home,
          // not back into the just-submitted form.
          setStack(prev => [...prev.slice(0, -1), { screen: 'detail', listingId: id }])
        }}
      />
    )
  }

  if (current.screen === 'detail') {
    return (
      <DetailScreen
        token={token}
        listingId={current.listingId}
        onBack={pop}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
      />
    )
  }

  return null
}
