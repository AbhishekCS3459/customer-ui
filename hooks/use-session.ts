'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { type Session, SESSION_KEY, parseSession } from '@/lib/auth'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Signing in or out in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

/**
 * The signed-in customer, or null when signed out. Undefined while server
 * rendering and hydrating, so the header doesn't flash "Sign in" for someone
 * who is signed in.
 */
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined)
  return useMemo(() => (raw === undefined ? undefined : parseSession(raw)), [raw])
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Private mode or storage full: there's nowhere to keep the session, so it reads as signed out.
  }
  listeners.forEach((notify) => notify())
}

export function endSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored to remove.
  }
  listeners.forEach((notify) => notify())
}
