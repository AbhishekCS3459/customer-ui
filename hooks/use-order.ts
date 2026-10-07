'use client'

import { useCallback, useEffect, useState } from 'react'

import { endSession } from '@/hooks/use-session'
import { type Order, OrderError, getOrder, isOpen } from '@/lib/orders'

/** How often an order that can still change is fetched again while the page is visible. */
const POLL_MS = 5000

/**
 * The customer's order, kept current: fetched again every few seconds while it
 * can still change (or a refund is on its way), and when the tab comes back.
 */
export function useOrder(token: string, orderId: string) {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  /** Takes an order from any response, unless a newer one is already shown. */
  const accept = useCallback((next: Order) => {
    setOrder((prev) => (prev && prev.id === next.id && prev.version > next.version ? prev : next))
    setError(null)
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    getOrder(token, orderId, ctrl.signal).then(accept, (err: unknown) => {
      if (ctrl.signal.aborted) return
      if (err instanceof OrderError && err.code === 'UNAUTHORIZED') endSession()
      setError(err instanceof Error ? err : new Error('Something went wrong.'))
    })
    return () => ctrl.abort()
  }, [token, orderId, nonce, accept])

  const live = !!order && (isOpen(order.status) || order.payment_status === 'REFUND_PENDING')
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [live, refresh])

  return { order, error, refresh, accept }
}
