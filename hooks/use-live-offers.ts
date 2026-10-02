'use client'

import { useEffect, useEffectEvent, useState } from 'react'

import { API_URL, type OfferUpdate, productLivePath } from '@/lib/marketplace'

/** How often to refetch while the stream is down. */
const POLL_MS = 15_000
/** First wait before reopening a refused stream; doubles up to MAX_REOPEN_MS. */
const REOPEN_MS = 30_000
const MAX_REOPEN_MS = 5 * 60_000
/** Shortest gap between refetches asked for by needsSnapshot. */
const SNAPSHOT_GAP_MS = 10_000

const NO_UPDATES: ReadonlyMap<string, OfferUpdate> = new Map()

type State = { path: string; revision: number; connected: boolean; updates: ReadonlyMap<string, OfferUpdate> }

function forPath(state: State, path: string): State {
  return state.path === path ? state : { path, revision: 0, connected: false, updates: NO_UPDATES }
}

export type LiveOffers = {
  /** Grows whenever the snapshot must be fetched again: pass it to useApi as (part of) the nonce. */
  revision: number
  /** The newest update per store; apply each only over an older version (mergeOfferUpdates). */
  updates: ReadonlyMap<string, OfferUpdate>
  /** The stream is open. While it isn't, revision grows every POLL_MS instead. */
  connected: boolean
}

/**
 * Follows a product's availability changes, only storeId's if given. Each
 * time the stream (re)opens, revision grows: the stream is subscribed by then,
 * so a snapshot fetched now misses nothing. needsSnapshot asks for a refetch
 * when an update can't be applied to what's on screen, e.g. a store the
 * snapshot doesn't list.
 */
export function useLiveOffers(
  catalogKey: string,
  { storeId, needsSnapshot }: { storeId?: string; needsSnapshot?: (update: OfferUpdate) => boolean } = {},
): LiveOffers {
  const path = productLivePath(catalogKey, storeId)
  const [state, setState] = useState<State>({ path, revision: 0, connected: false, updates: NO_UPDATES })
  const wantsSnapshot = useEffectEvent((update: OfferUpdate) => needsSnapshot?.(update) ?? false)

  useEffect(() => {
    let source: EventSource | undefined
    let poll: ReturnType<typeof setInterval> | undefined
    let reopen: ReturnType<typeof setTimeout> | undefined
    let snapshot: ReturnType<typeof setTimeout> | undefined
    let lastSnapshot = 0
    let reopenDelay = REOPEN_MS

    const set = (next: (s: State) => State) => setState((prev) => next(forPath(prev, path)))
    const refetch = () => set((s) => ({ ...s, revision: s.revision + 1 }))
    const setConnected = (connected: boolean) => set((s) => (s.connected === connected ? s : { ...s, connected }))
    const requestSnapshot = () => {
      if (snapshot !== undefined) return
      snapshot = setTimeout(
        () => {
          snapshot = undefined
          lastSnapshot = Date.now()
          refetch()
        },
        Math.max(0, lastSnapshot + SNAPSHOT_GAP_MS - Date.now()),
      )
    }
    const startPolling = () => {
      poll ??= setInterval(() => {
        if (!document.hidden) refetch()
      }, POLL_MS)
    }
    const stopPolling = () => {
      clearInterval(poll)
      poll = undefined
    }

    const open = () => {
      const es = new EventSource(`${API_URL}${path}`)
      source = es
      es.addEventListener('ready', () => {
        reopenDelay = REOPEN_MS
        stopPolling()
        setConnected(true)
        refetch()
      })
      es.addEventListener('resync', refetch)
      es.addEventListener('offer', (event) => {
        const update = parseUpdate(event.data)
        if (!update) return
        set((s) => {
          const known = s.updates.get(update.store_id)
          if (known && known.version >= update.version) return s
          return { ...s, updates: new Map(s.updates).set(update.store_id, update) }
        })
        if (wantsSnapshot(update)) requestSnapshot()
      })
      es.addEventListener('error', () => {
        setConnected(false)
        startPolling()
        // CLOSED means the server refused the stream (e.g. 503); the browser won't retry that itself.
        if (es.readyState === EventSource.CLOSED) {
          reopen = setTimeout(open, reopenDelay * (0.5 + Math.random()))
          reopenDelay = Math.min(reopenDelay * 2, MAX_REOPEN_MS)
        }
      })
    }

    open()
    return () => {
      source?.close()
      stopPolling()
      clearTimeout(reopen)
      clearTimeout(snapshot)
    }
  }, [path])

  const current = forPath(state, path)
  return { revision: current.revision, updates: current.updates, connected: current.connected }
}

function parseUpdate(data: unknown): OfferUpdate | null {
  if (typeof data !== 'string') return null
  try {
    const update = JSON.parse(data) as Partial<OfferUpdate> | null
    if (!update || typeof update.store_id !== 'string' || typeof update.version !== 'number') return null
    return update as OfferUpdate
  } catch {
    return null
  }
}
