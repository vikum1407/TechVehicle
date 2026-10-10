import React, { useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
import MartDevPreviewScreen from './MartDevPreviewScreen'

// Step 0.11 — Mart's OWN internal navigation, deliberately separate from App.tsx's
// global `Screen`/`backMap` system rather than adding 15+ entries there. App.tsx only
// knows about ONE screen value ('mart'); everything Mart-internal happens inside this
// component's own stack, with its own BackHandler listener (registered while this
// component is mounted, so it intercepts back-press before App.tsx's root listener —
// RN calls the most-recently-added listener first). When the Mart stack is back down
// to its first entry, this listener returns false and lets the press fall through to
// App.tsx's existing backMap unchanged (mart -> vehicles).
//
// Only 'home' exists right now (rendering the Step 0.10 dev preview screen, since the
// real Mart Home is Milestone 1 Step 1.3 — swap it in then). push()/pop() are already
// here so Milestone 1 screens plug straight in without touching this file's shape.
type MartScreenName = 'home'
type MartStackEntry = { screen: MartScreenName; params?: Record<string, unknown> }

export default function MartNavigator({ onExit, token }: { onExit: () => void; token: string }) {
  const [stack, setStack] = useState<MartStackEntry[]>([{ screen: 'home' }])

  const push = (screen: MartScreenName, params?: Record<string, unknown>) => {
    setStack(prev => [...prev, { screen, params }])
  }
  const pop = () => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

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

  const current = stack[stack.length - 1]

  if (current.screen === 'home') {
    // push/pop are wired in but unused until Milestone 1 adds a real destination to
    // navigate to (e.g. push('detail', { listingId })) — expected to show as unused
    // until then.
    return <MartDevPreviewScreen onBack={onExit} token={token} />
  }

  return null
}
