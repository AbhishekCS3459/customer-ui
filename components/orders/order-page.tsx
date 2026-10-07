'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Toast } from '@base-ui/react/toast'
import { CircleSlash, CreditCard, FlaskConical, Loader2, RefreshCw } from 'lucide-react'

import { BackButton, PageShell } from '@/components/marketplace/app-shell'
import { Notice, Spinner } from '@/components/marketplace/shared'
import { StoreCard } from '@/components/marketplace/store-card'
import { useApi } from '@/hooks/use-api'
import { useOrder } from '@/hooks/use-order'
import { endSession } from '@/hooks/use-session'
import type { Session } from '@/lib/auth'
import { type Store, formatDateTime, storeHref, storePath } from '@/lib/marketplace'
import {
  type Order,
  OrderError,
  PAYMENT_INFO,
  canCancel,
  cancelOrder,
  formatPaise,
  simulatePayment,
  startPayment,
} from '@/lib/orders'
import { ConfirmDialog } from './confirm-dialog'
import { Card, DeadlineBanner, OrderItems, PickupCode, Progress, StatusBadge, Timeline } from './order-ui'
import { SignInGate } from './sign-in-gate'

export function OrderPage({ orderId }: { orderId: string }) {
  return (
    <PageShell>
      <BackButton />
      <SignInGate>{(session) => <OrderView session={session} orderId={orderId} />}</SignInGate>
    </PageShell>
  )
}

function OrderView({ session, orderId }: { session: Session; orderId: string }) {
  const { order, error, refresh, accept } = useOrder(session.token, orderId)

  if (!order) {
    if (!error) return <Spinner label="Loading your order…" />
    return error instanceof OrderError && error.status === 404 ? (
      <Notice title="Order not found">
        <p>This order doesn&apos;t exist or belongs to another account.</p>
        <Link href="/orders" className="mt-4 inline-block rounded-full bg-ink px-4 py-2 font-semibold text-white">
          See my orders
        </Link>
      </Notice>
    ) : (
      <Notice tone="error" title="Couldn't load this order">
        <p>{error.message}</p>
        <button type="button" onClick={refresh} className="mt-4 rounded-full bg-ink px-4 py-2 font-semibold text-white">
          Try again
        </button>
      </Notice>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Order #{order.code}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{headline(order)}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {order.store_name} · placed {formatDateTime(order.created_at)}
            </p>
          </div>
          <StatusBadge status={order.status} className="mt-1" />
        </header>

        {error && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <RefreshCw className="size-3.5" aria-hidden /> Couldn&apos;t refresh: {error.message}
          </p>
        )}

        <DeadlineBanner order={order} onElapsed={refresh} />
        {order.status === 'PENDING_PAYMENT' && <PayPanel session={session} order={order} onOrder={accept} onStale={refresh} />}
        {order.pickup_code && <PickupCode code={order.pickup_code} status={order.status} />}
        <ClosedNotice order={order} />

        {order.status !== 'PENDING_PAYMENT' && (
          <Card>
            <Progress status={order.status} />
            <p className="mt-4 text-sm text-ink-soft">{nextStep(order)}</p>
          </Card>
        )}

        <Card title="Items">
          <OrderItems items={order.items} total={order.total_paise} />
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <PaymentCard order={order} />
        <StoreInfo storeId={order.store_id} />
        {order.history && order.history.length > 0 && (
          <Card title="History">
            <Timeline events={order.history} />
          </Card>
        )}
        {canCancel(order.status) && <CancelOrder session={session} order={order} onOrder={accept} onStale={refresh} />}
      </div>
    </div>
  )
}

function headline(order: Order): string {
  switch (order.status) {
    case 'PENDING_PAYMENT':
      return 'Finish paying to send your order'
    case 'PLACED':
      return 'Waiting for the store to accept'
    case 'ACCEPTED':
      return 'The store is packing your order'
    case 'READY':
      return 'Your order is ready to collect'
    case 'COMPLETED':
      return 'Collected. Enjoy!'
    case 'CANCELLED':
      return 'Order cancelled'
    case 'REJECTED':
      return 'The store couldn’t take this order'
    case 'EXPIRED':
      return 'Payment time ran out'
    case 'NO_SHOW':
      return 'This order wasn’t collected'
  }
}

function nextStep(order: Order): string {
  const payLater = order.payment_mode === 'PAY_AT_STORE'
  switch (order.status) {
    case 'PLACED':
      return "We've sent your order to the store. You'll see it change here as soon as they accept it."
    case 'ACCEPTED':
      return `The store is getting your items together. We'll show a pickup timer once it's ready.${payLater ? ' You pay at the counter.' : ''}`
    case 'READY':
      return `Head to the store and show your pickup code.${payLater ? ` Pay ${formatPaise(order.total_paise)} at the counter.` : ''}`
    case 'COMPLETED':
      return order.completed_at ? `Collected ${formatDateTime(order.completed_at)}.` : 'Collected.'
    default:
      return ''
  }
}

/** Why a closed order ended, and what happens to any money paid. */
function ClosedNotice({ order }: { order: Order }) {
  if (!['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(order.status)) return null
  const refund =
    order.payment_status === 'REFUND_PENDING'
      ? `Your refund of ${formatPaise(order.total_paise)} is on its way.`
      : order.payment_status === 'REFUNDED'
        ? `${formatPaise(order.total_paise)} has been refunded.`
        : "You weren't charged."
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200 ring-inset sm:p-5">
      <CircleSlash className="mt-0.5 size-5 shrink-0 text-zinc-500" aria-hidden />
      <div className="text-sm">
        {order.closed_reason && <p className="font-semibold text-ink">{order.closed_reason}</p>}
        {refund && <p className="mt-0.5 text-ink-soft">{refund}</p>}
        <Link href={storeHref(order.store_id)} className="mt-2 inline-block font-semibold text-brand hover:text-brand-strong">
          Shop {order.store_name} again →
        </Link>
      </div>
    </div>
  )
}

/**
 * Pays with the dummy provider: opens a payment, then reports its outcome the
 * way a real gateway's webhook would. Swapping in a real gateway replaces the
 * simulate step with the gateway's checkout.
 */
function PayPanel({
  session,
  order,
  onOrder,
  onStale,
}: {
  session: Session
  order: Order
  onOrder: (order: Order) => void
  onStale: () => void
}) {
  const toasts = Toast.useToastManager()
  const [busy, setBusy] = useState<'SUCCEEDED' | 'FAILED' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pay(outcome: 'SUCCEEDED' | 'FAILED') {
    setBusy(outcome)
    setError(null)
    try {
      const payment = await startPayment(session.token, order.id)
      const next = await simulatePayment(session.token, order.id, payment.id, outcome)
      onOrder(next)
      if (outcome === 'SUCCEEDED' && next.payment_status === 'PAID') {
        toasts.add({ type: 'success', title: 'Payment received', description: 'Your order has gone to the store.' })
      } else if (outcome === 'FAILED') {
        setError("The payment didn't go through. Your items are still held. Try again before the timer runs out.")
      }
    } catch (err) {
      if (err instanceof OrderError && err.code === 'UNAUTHORIZED') endSession()
      if (err instanceof OrderError && err.code === 'INVALID_STATE') onStale()
      setError(err instanceof Error ? err.message : 'The payment could not be started. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <CreditCard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Pay {formatPaise(order.total_paise)}</h2>
          <p className="text-sm text-ink-soft">Your order goes to the store as soon as it&apos;s paid.</p>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2 text-xs text-ink-soft">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden /> Test payments: no money moves. A real payment gateway will replace this.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => pay('SUCCEEDED')}
          disabled={busy !== null}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink font-bold text-white shadow-card transition hover:bg-brand-strong disabled:opacity-60"
        >
          {busy === 'SUCCEEDED' && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Pay {formatPaise(order.total_paise)}
        </button>
        <button
          type="button"
          onClick={() => pay('FAILED')}
          disabled={busy !== null}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line ring-inset hover:bg-canvas disabled:opacity-60"
        >
          {busy === 'FAILED' && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Simulate a failed payment
        </button>
      </div>
    </Card>
  )
}

function PaymentCard({ order }: { order: Order }) {
  const rows: [string, string][] = [
    ['Payment', order.payment_mode === 'ONLINE' ? 'Online' : 'At the store'],
    ['Status', order.payment_mode === 'PAY_AT_STORE' && order.payment_status === 'UNPAID' ? 'Pay when you collect' : PAYMENT_INFO[order.payment_status]],
    ['Total', formatPaise(order.total_paise)],
  ]
  return (
    <Card title="Payment">
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {order.payment?.simulated && <p className="mt-3 text-xs text-ink-faint">Test payment: no money moved.</p>}
    </Card>
  )
}

function StoreInfo({ storeId }: { storeId: string }) {
  const store = useApi<Store>(storePath(storeId))
  if (!store.data) return null
  return <StoreCard store={store.data} linkToStore />
}

function CancelOrder({
  session,
  order,
  onOrder,
  onStale,
}: {
  session: Session
  order: Order
  onOrder: (order: Order) => void
  onStale: () => void
}) {
  const toasts = Toast.useToastManager()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const paid = order.payment_status === 'PAID'

  async function cancel() {
    setBusy(true)
    setError(null)
    try {
      const next = await cancelOrder(session.token, order.id, reason.trim() || undefined)
      onOrder(next)
      setOpen(false)
      toasts.add({
        type: 'success',
        title: 'Order cancelled',
        description: paid ? 'Your refund is on its way.' : 'Your items have gone back on the shelf.',
      })
    } catch (err) {
      if (err instanceof OrderError && err.code === 'UNAUTHORIZED') endSession()
      if (err instanceof OrderError && err.code === 'INVALID_STATE') {
        onStale()
        setOpen(false)
        toasts.add({ type: 'error', title: "Can't cancel now", description: err.message })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not cancel. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 ring-inset hover:bg-red-50"
      >
        Cancel order
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setError(null)
        }}
        title="Cancel this order?"
        description={
          paid
            ? `Your items go back on the shelf and ${formatPaise(order.total_paise)} is refunded.`
            : 'Your items go back on the shelf for other shoppers.'
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        busy={busy}
        onConfirm={cancel}
      >
        <label className="mt-4 block text-xs font-semibold text-ink-soft">
          Reason (optional)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. Found it somewhere else"
            className="mt-1 h-10 w-full rounded-xl bg-canvas px-3 text-sm font-normal ring-1 ring-line outline-none ring-inset focus:bg-surface focus:ring-2 focus:ring-brand"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
