import React, { useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
import MartHomeScreen from './mart/MartHomeScreen'
import FiltersScreen, { MartFilters, DEFAULT_MART_FILTERS } from './mart/FiltersScreen'
import PostAdScreen, { EditingListing } from './mart/PostAdScreen'
import DetailScreen from './mart/DetailScreen'
import MyMartScreen from './mart/MyMartScreen'
import MyAdsScreen from './mart/MyAdsScreen'
import FavoritesScreen from './mart/FavoritesScreen'
import ChatInboxScreen from './mart/ChatInboxScreen'
import ChatThreadScreen, { ChatThreadEntry } from './mart/ChatThreadScreen'
import OffersListScreen from './mart/OffersListScreen'

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
// Step 1.5: 'postAd' optionally carries `editing`, pushed from Detail's Edit button —
// same screen, prefilled, PATCH instead of POST. Step 1.6 adds 'myMart' and 'myAds'.
// Step 1.7 adds 'favorites'. Step 1.8 adds 'inbox' and 'thread' — 'thread' carries a
// ChatThreadEntry (an existing threadId, or a "draft" with a listing snapshot for
// Message Seller's first-ever message, per 03-api.md §8). None of these 5 are in
// FULL_SCREEN below, so the bottom tab bar stays visible on all of them except
// 'thread' (a full-screen chat, same as the real app's existing booking chat).
// Notifications and Mark Sold/Relist/Confirm-purchase/Report/Block are still stubbed
// with a plain Alert from inside the relevant screen itself for now.
type MartStackEntry =
  | { screen: 'home' }
  | { screen: 'filters' }
  | { screen: 'postAd'; editing?: EditingListing; initialType?: 'selling' | 'wanted' }
  | { screen: 'detail'; listingId: string }
  | { screen: 'myMart' }
  | { screen: 'myAds' }
  | { screen: 'favorites' }
  | { screen: 'inbox' }
  | { screen: 'thread'; entry: ChatThreadEntry }
  | { screen: 'offers'; listingId: string; title: string; budgetMin: number | null; budgetMax: number | null }

// Screens where the spec (04-screens.md §0.2) hides the bottom tab bar. App.tsx can't
// see inside this component's own stack, so it's told via `onFullScreenChange`.
const FULL_SCREEN: MartStackEntry['screen'][] = ['filters', 'postAd', 'detail', 'thread', 'offers']

export default function MartNavigator({ onExit, token, onFullScreenChange, focusThreadId, onFocusHandled, focusListingId, onListingFocusHandled }: {
  onExit: () => void
  token: string
  onFullScreenChange?: (isFullScreen: boolean) => void
  focusThreadId?: string | null
  onFocusHandled?: () => void
  focusListingId?: string | null
  onListingFocusHandled?: () => void
}) {
  const [stack, setStack] = useState<MartStackEntry[]>([{ screen: 'home' }])
  const [filters, setFilters] = useState<MartFilters>(DEFAULT_MART_FILTERS)

  const push = (entry: MartStackEntry) => setStack(prev => [...prev, entry])
  const pop = () => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))

  const current = stack[stack.length - 1]

  useEffect(() => {
    onFullScreenChange?.(FULL_SCREEN.includes(current.screen))
  }, [current.screen])

  // Step 1.9: a mart_message push notification tap, routed in from App.tsx (same
  // focusBookingId-style prop + "handled" callback pattern already used for Garage/
  // Vehicle Dashboard deep links) — pushes straight to the thread, same mount every
  // time this stack opens fresh (it always starts at 'home').
  // Step 2.3: a mart_wanted_match push notification tap — same pattern as focusThreadId
  // above, pushes straight to the matching request's Detail screen.
  useEffect(() => {
    if (focusListingId) {
      push({ screen: 'detail', listingId: focusListingId })
      onListingFocusHandled?.()
    }
  }, [focusListingId])

  useEffect(() => {
    if (focusThreadId) {
      push({ screen: 'thread', entry: { kind: 'thread', threadId: focusThreadId } })
      onFocusHandled?.()
    }
  }, [focusThreadId])

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
        onOpenPostAd={initialType => push({ screen: 'postAd', initialType })}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
        onOpenMyMart={() => push({ screen: 'myMart' })}
        onOpenFavorites={() => push({ screen: 'favorites' })}
        onOpenMessages={() => push({ screen: 'inbox' })}
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
        editing={current.editing}
        initialType={current.initialType}
        onBack={pop}
        onPosted={id => {
          // Spec: "success -> the new ad's Detail." Replace the postAd entry with
          // detail (rather than pushing on top of it) so back from Detail goes to Home
          // (or wherever opened it), not back into the just-submitted/saved form.
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
        onEdit={listing => push({ screen: 'postAd', editing: { listingId: current.listingId, listing } })}
        onOpenThread={entry => push({ screen: 'thread', entry })}
        onOpenOffers={(listingId, title, budgetMin, budgetMax) => push({ screen: 'offers', listingId, title, budgetMin, budgetMax })}
      />
    )
  }

  if (current.screen === 'myMart') {
    return (
      <MyMartScreen
        token={token}
        onBack={pop}
        onOpenMyAds={() => push({ screen: 'myAds' })}
        onOpenFavorites={() => push({ screen: 'favorites' })}
      />
    )
  }

  if (current.screen === 'myAds') {
    return (
      <MyAdsScreen
        token={token}
        onBack={pop}
        onOpenPostAd={() => push({ screen: 'postAd' })}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
        onOpenEdit={listing => push({ screen: 'postAd', editing: { listingId: listing.id, listing } })}
      />
    )
  }

  if (current.screen === 'favorites') {
    return (
      <FavoritesScreen
        token={token}
        onBack={pop}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
      />
    )
  }

  if (current.screen === 'inbox') {
    return (
      <ChatInboxScreen
        token={token}
        onBack={pop}
        onOpenThread={threadId => push({ screen: 'thread', entry: { kind: 'thread', threadId } })}
      />
    )
  }

  if (current.screen === 'thread') {
    return (
      <ChatThreadScreen
        token={token}
        entry={current.entry}
        onBack={pop}
        onOpenListing={id => push({ screen: 'detail', listingId: id })}
      />
    )
  }

  if (current.screen === 'offers') {
    return (
      <OffersListScreen
        token={token}
        listingId={current.listingId}
        title={current.title}
        budgetMin={current.budgetMin}
        budgetMax={current.budgetMax}
        onBack={pop}
        onOpenThread={entry => push({ screen: 'thread', entry })}
      />
    )
  }

  return null
}
