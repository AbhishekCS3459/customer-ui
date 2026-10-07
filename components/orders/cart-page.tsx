'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Toast } from '@base-ui/react/toast'
import { AlertCircle, CreditCard, Loader2, Minus, Plus, ShoppingBag, Store as StoreIcon, Trash2 } from 'lucide-react'

import { AuthDialog } from '@/components/marketplace/auth-dialog'
import { BackButton, PageShell } from '@/components/marketplace/app-shell'
import { Notice, ProductImage, Spinner } from '@/components/marketplace/shared'
import {
  type Cart,
  clearCart,
  fitLinesToLimits,
  setLineQuantity,
  updateLineLimits,
  updateLinePrices,
  useCart,
} from '@/hooks/use-cart'
import { endSession, useSession } from '@/hooks/use-session'
import { MAX_ORDER_QUANTITY, storeHref, storeProductHref } from '@/lib/marketplace'
import {
  type ItemProblem,
  OrderError,
  type PaymentMode,
  formatPaise,
  newIdempotencyKey,
  orderHref,
  placeOrder,
  problemLabel,
  toPaise,
} from '@/lib/orders'
import { cn } from '@/lib/utils'
import { Card } from './order-ui'

const modes: { value: PaymentMode; title: string; detail: string; icon: typeof CreditCard }[] = [
  {
    value: 'ONLINE',
    title: 'Pay & reserve',
    detail: 'Pay now and the store keeps your items aside. You have 10 minutes to finish paying.',
    icon: CreditCard,
  },
  {
    value: 'PAY_AT_STORE',
    title: 'Reserve, pay at store',
    detail: 'Pay when you collect. Pick up within 2 hours of the store getting your order ready.',
    icon: StoreIcon,
  },
]

/** What the order would contain; a different bag or payment choice is a different order. */
function signature(cart: Cart, mode: PaymentMode): string {
  return JSON.stringify([cart.storeId, mode, cart.lines.map((l) => [l.catalogKey, l.quantity, l.price])])
}

export function CartPage() {
  const router = useRouter()
  const toasts = Toast.useToastManager()
  const cart = useCart()
  const session = useSession()
  const [mode, setMode] = useState<PaymentMode>('ONLINE')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [problems, setProblems] = useState<ReadonlyMap<string, ItemProblem>>(new Map())
  const [signInOpen, setSignInOpen] = useState(false)
  // Kept across retries of the same order so a lost response can't place it twice.
  const attempt = useRef<{ signature: string; key: string } | null>(null)

  async function place() {
    if (!cart) return
    if (!session) {
      setSignInOpen(true)
      return
    }
    const sig = signature(cart, mode)
    if (attempt.current?.signature !== sig) attempt.current = { signature: sig, key: newIdempotencyKey() }
    setPlacing(true)
    setError(null)
    setProblems(new Map())
    try {
      const order = await placeOrder(
        session.token,
        {
          store_id: cart.storeId,
          payment_mode: mode,
          items: cart.lines.map((l) => ({ catalog_key: l.catalogKey, quantity: l.quantity, expected_unit_price: l.price })),
        },
        attempt.current.key,
      )
      attempt.current = null
      clearCart()
      toasts.add({
        type: 'success',
        title: mode === 'ONLINE' ? 'Items reserved' : 'Order placed',
        description: mode === 'ONLINE' ? 'Finish paying to send it to the store.' : 'The store will accept it shortly.',
      })
      router.push(orderHref(order.id))
    } catch (err) {
      setPlacing(false)
      if (!(err instanceof OrderError)) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
        return
      }
      switch (err.code) {
        case 'UNAUTHORIZED':
          endSession()
          setSignInOpen(true)
          return
        case 'IDEMPOTENCY_KEY_REUSED':
          attempt.current = null
          break
        case 'ITEMS_UNAVAILABLE':
        case 'PRICE_CHANGED': {
          setProblems(new Map(err.items.map((p) => [p.catalog_key, p])))
          const prices = new Map(
            err.items.filter((p) => p.current_unit_price !== undefined).map((p) => [p.catalog_key, p.current_unit_price!]),
          )
          if (prices.size) updateLinePrices(prices)
          const limits = new Map(
            err.items.filter((p) => p.max_order_quantity !== undefined).map((p) => [p.catalog_key, p.max_order_quantity!]),
          )
          if (limits.size) updateLineLimits(limits)
          break
        }
      }
      setError(err.message)
    }
  }

  /** Lowers short lines to what the store has and removes the ones it can't sell. */
  function fitToStock() {
    const lowered = new Set<string>()
    problems.forEach((p) => {
      if (p.reason === 'PRICE_CHANGED') return
      if (p.reason === 'OUT_OF_STOCK' && p.max_order_quantity !== undefined) lowered.add(p.catalog_key)
      else setLineQuantity(p.catalog_key, 0)
    })
    if (lowered.size) fitLinesToLimits(lowered)
    setProblems(new Map([...problems].filter(([, p]) => p.reason === 'PRICE_CHANGED')))
    setError(null)
  }

  if (cart === undefined) {
    return (
      <PageShell>
        <Spinner />
      </PageShell>
    )
  }
  if (!cart) {
    return (
      <PageShell>
        <BackButton />
        <Notice title="Your bag is empty" icon={<ShoppingBag className="size-6" aria-hidden />}>
          <p>Add products from a nearby store to reserve them for pickup.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/" className="rounded-full bg-ink px-4 py-2 font-semibold text-white">
              Browse nearby
            </Link>
            {session && (
              <Link href="/orders" className="rounded-full px-4 py-2 font-semibold text-brand ring-1 ring-line ring-inset">
                My orders
              </Link>
            )}
          </div>
        </Notice>
      </PageShell>
    )
  }

  const total = cart.lines.reduce((sum, l) => sum + toPaise(l.price) * l.quantity, 0)
  const units = cart.lines.reduce((sum, l) => sum + l.quantity, 0)
  const hasUnavailable = [...problems.values()].some((p) => p.reason !== 'PRICE_CHANGED' && cart.lines.some((l) => l.catalogKey === p.catalog_key))
  const stepClass = 'grid size-8 place-items-center rounded-full hover:bg-surface disabled:pointer-events-none disabled:opacity-40'

  return (
    <PageShell>
      <BackButton />
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Your bag</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Pickup from{' '}
        <Link href={storeHref(cart.storeId)} className="font-semibold text-brand hover:text-brand-strong">
          {cart.storeName || 'the store'}
        </Link>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Card>
          <ul className="divide-y divide-line">
            {cart.lines.map((line) => {
              const problem = problems.get(line.catalogKey)
              return (
                <li key={line.catalogKey} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                  <Link href={storeProductHref(cart.storeId, line.catalogKey)} className="shrink-0">
                    <ProductImage src={line.imageUrl} alt={line.name} className="size-16 rounded-2xl sm:size-20" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={storeProductHref(cart.storeId, line.catalogKey)} className="line-clamp-2 font-semibold hover:text-brand">
                          {line.name}
                        </Link>
                        <p className="text-xs text-ink-faint">{[line.unit, `${formatPaise(toPaise(line.price))} each`].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="shrink-0 font-bold tabular-nums">{formatPaise(toPaise(line.price) * line.quantity)}</span>
                    </div>
                    {problem && (
                      <p
                        className={cn(
                          'mt-1 flex items-center gap-1 text-xs font-semibold',
                          problem.reason === 'PRICE_CHANGED' ? 'text-amber-700' : 'text-red-700',
                        )}
                      >
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                        {problemLabel(problem)}
                        {problem.reason === 'PRICE_CHANGED' && problem.current_unit_price !== undefined
                          ? ` — now ${formatPaise(toPaise(problem.current_unit_price))}`
                          : ''}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                      <div className="flex items-center rounded-full bg-canvas p-0.5 ring-1 ring-line ring-inset" role="group" aria-label={`Quantity of ${line.name}`}>
                        <button
                          type="button"
                          className={stepClass}
                          onClick={() => setLineQuantity(line.catalogKey, line.quantity - 1)}
                          disabled={placing}
                          aria-label="One fewer"
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                        <button
                          type="button"
                          className={stepClass}
                          onClick={() => setLineQuantity(line.catalogKey, line.quantity + 1)}
                          disabled={placing || line.quantity >= line.maxQuantity}
                          aria-label="One more"
                        >
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      {!problem && line.quantity >= line.maxQuantity && (
                        <span className="mr-auto text-[11px] text-ink-faint">
                          {line.maxQuantity < MAX_ORDER_QUANTITY ? `Only ${line.maxQuantity} available` : `Max ${MAX_ORDER_QUANTITY} per order`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setLineQuantity(line.catalogKey, 0)}
                        disabled={placing}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24">
          <Card title="How do you want to pay?">
            <div role="radiogroup" aria-label="Payment" className="space-y-2">
              {modes.map((m) => {
                const selected = mode === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m.value)}
                    disabled={placing}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 transition ring-inset',
                      selected ? 'bg-brand-soft ring-2 ring-brand' : 'ring-line hover:bg-canvas',
                    )}
                  >
                    <span
                      className={cn('grid size-9 shrink-0 place-items-center rounded-xl', selected ? 'bg-brand text-white' : 'bg-canvas text-ink-soft')}
                    >
                      <m.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{m.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{m.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card>
            <p className="text-sm text-ink-soft">
              {units} {units === 1 ? 'item' : 'items'}
            </p>
            <div className="mt-1 flex items-center justify-between text-lg font-black">
              <span>Total</span>
              <span className="tabular-nums">{formatPaise(total)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">If a price changed since you added it, we&apos;ll show you before placing the order.</p>

            {error && (
              <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
                <p>{error}</p>
                {hasUnavailable && (
                  <button type="button" onClick={fitToStock} className="mt-2 font-semibold underline underline-offset-2">
                    Update my bag to what&apos;s available
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={place}
              disabled={placing || session === undefined}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink font-bold text-white shadow-card transition hover:bg-brand-strong disabled:opacity-60"
            >
              {placing && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {!session ? 'Sign in to place order' : mode === 'ONLINE' ? `Reserve & pay ${formatPaise(total)}` : 'Reserve for pickup'}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-faint">Items are held only for you once the order is placed.</p>
          </Card>
        </div>
      </div>
      <AuthDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </PageShell>
  )
}
