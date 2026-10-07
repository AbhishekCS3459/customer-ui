'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Package } from 'lucide-react'

import { PageShell } from '@/components/marketplace/app-shell'
import { Notice, Spinner } from '@/components/marketplace/shared'
import { endSession } from '@/hooks/use-session'
import type { Session } from '@/lib/auth'
import { formatDateTime } from '@/lib/marketplace'
import { type Order, type OrderStatus, OrderError, formatPaise, isOpen, listOrders, orderHref } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { InlineCountdown, StatusBadge } from './order-ui'
import { SignInGate } from './sign-in-gate'

/** How often the list is fetched again while one of its orders can still change. */
const POLL_MS = 15000

const deadlineLabel: Partial<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: 'Pay within',
  PLACED: 'Store responds within',
  READY: 'Collect within',
}

export function OrdersPage() {
  return (
    <PageShell>
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My orders</h1>
      <p className="mt-1 text-sm text-ink-soft">Orders you&apos;ve reserved for pickup.</p>
      <div className="mt-6">
        <SignInGate>{(session) => <OrdersList session={session} />}</SignInGate>
      </div>
    </PageShell>
  )
}

/** Loaded orders, newest first; cursor continues after the oldest page loaded. */
type Loaded = { orders: Order[]; cursor?: string }

/** Puts fresh copies of orders in place of older copies, newest first. */
function merge(current: Order[], fresh: Order[]): Order[] {
  const byId = new Map(current.map((o) => [o.id, o]))
  fresh.forEach((o) => byId.set(o.id, o))
  return [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

function OrdersList({ session }: { session: Session }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const fail = useCallback((err: unknown) => {
    if (err instanceof OrderError && err.code === 'UNAUTHORIZED') endSession()
    setError(err instanceof Error ? err.message : 'Something went wrong.')
  }, [])

  // The first page, fetched again on refresh; older pages already loaded are kept.
  useEffect(() => {
    const ctrl = new AbortController()
    listOrders(session.token, undefined, ctrl.signal).then(
      (page) => {
        setError(null)
        setLoaded((prev) => (prev ? { ...prev, orders: merge(prev.orders, page.orders) } : { orders: page.orders, cursor: page.next_cursor }))
      },
      (err: unknown) => !ctrl.signal.aborted && fail(err),
    )
    return () => ctrl.abort()
  }, [session.token, nonce, fail])

  const orders = loaded?.orders ?? null
  const cursor = loaded?.cursor
  const live = !!orders?.some((o) => isOpen(o.status) || o.payment_status === 'REFUND_PENDING')
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [live, refresh])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const page = await listOrders(session.token, cursor)
      // Copies already shown may be newer than this page's: keep them.
      setLoaded((prev) => ({
        orders: merge(page.orders, prev?.orders ?? []),
        cursor: page.next_cursor,
      }))
    } catch (err) {
      fail(err)
    } finally {
      setLoadingMore(false)
    }
  }

  if (!orders) {
    return error ? (
      <Notice tone="error" title="Couldn't load your orders">
        <p>{error}</p>
        <button type="button" onClick={refresh} className="mt-4 rounded-full bg-ink px-4 py-2 font-semibold text-white">
          Try again
        </button>
      </Notice>
    ) : (
      <Spinner label="Loading your orders…" />
    )
  }
  if (orders.length === 0) {
    return (
      <Notice title="No orders yet" icon={<Package className="size-6" aria-hidden />}>
        <p>Reserve products at a nearby store and they&apos;ll show up here.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-ink px-4 py-2 font-semibold text-white">
          Browse nearby
        </Link>
      </Notice>
    )
  }

  return (
    <>
      {error && (
        <p role="status" className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Couldn&apos;t refresh: {error}
        </p>
      )}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <OrderRow order={o} onElapsed={refresh} />
          </li>
        ))}
      </ul>
      {cursor && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Show older orders
          </button>
        </div>
      )}
    </>
  )
}

function OrderRow({ order, onElapsed }: { order: Order; onElapsed: () => void }) {
  const units = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const label = deadlineLabel[order.status]
  const first = order.items[0]
  const summary = first ? (order.items.length > 1 ? `${first.name} and ${order.items.length - 1} more` : first.name) : ''
  return (
    <Link
      href={orderHref(order.id)}
      className={cn(
        'flex items-center gap-4 rounded-3xl border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5',
        isOpen(order.status) ? 'border-brand/25' : 'border-line',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{order.store_name}</span>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 truncate text-sm text-ink-soft">{summary}</p>
        <p className="mt-1 text-xs text-ink-faint">
          #{order.code} · {units} {units === 1 ? 'item' : 'items'} · {formatPaise(order.total_paise)} · {formatDateTime(order.created_at)}
        </p>
        {label && order.expires_at && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
            {label} <InlineCountdown deadline={order.expires_at} onElapsed={onElapsed} />
          </p>
        )}
        {order.status === 'READY' && order.pickup_code && (
          <p className="mt-2 text-xs text-ink-soft">
            Pickup code <span className="font-mono text-sm font-bold tracking-widest text-ink">{order.pickup_code}</span>
          </p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
    </Link>
  )
}
