'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { type Area, AREA_KEY, DEFAULT_AREA, parseArea } from '@/lib/marketplace'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Other tabs changing the area.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(AREA_KEY)
  } catch {
    return null
  }
}

/**
 * Where the customer is shopping: their last chosen location and radius, or
 * the default. Undefined while server rendering and hydrating, when storage
 * can't be read yet, so pages don't fetch for the wrong place first.
 */
export function useArea(): Area | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined)
  return useMemo(() => (raw === undefined ? undefined : (parseArea(raw) ?? DEFAULT_AREA)), [raw])
}

export function setArea(area: Area): void {
  try {
    localStorage.setItem(AREA_KEY, JSON.stringify(area))
  } catch {
    // Private mode or storage full: nothing to remember it in.
  }
  listeners.forEach((notify) => notify())
}
