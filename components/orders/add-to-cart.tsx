'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Toast } from '@base-ui/react/toast'
import { Minus, Plus, ShoppingBag } from 'lucide-react'

import { addToCart, quantityInCart, useCart } from '@/hooks/use-cart'
import { MAX_ORDER_QUANTITY, type Store, type StoreProduct, orderLimit } from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './confirm-dialog'

/**
 * Adds a product to the bag, asking first when the bag holds another store's
 * products. Render the returned dialog alongside the control.
 */
function useAddToBag(store: Pick<Store, 'id' | 'name'> | undefined, product: StoreProduct) {
  const toasts = Toast.useToastManager()
  const cart = useCart()
  const [pending, setPending] = useState<number | null>(null)
  const inBag = quantityInCart(cart, product.store_id, product.catalog_key)
  const limit = orderLimit(product)
  const room = Math.max(0, limit - inBag)

  function add(quantity: number, replace = false): boolean {
    if (!store || room <= 0) return false
    const n = Math.min(quantity, room)
    const result = addToCart(
      { id: store.id, name: store.name },
      {
        catalogKey: product.catalog_key,
        name: product.name,
        unit: product.unit,
        imageUrl: product.image_url,
        price: product.price,
        maxQuantity: limit,
      },
      n,
      replace,
    )
    if (result === 'other-store') {
      setPending(n)
      return false
    }
    setPending(null)
    if (result === 'full') {
      toasts.add({ type: 'error', title: 'Your bag is full', description: 'An order can have up to 50 different products.' })
      return false
    }
    toasts.add({ type: 'success', title: 'Added to your bag', description: `${n} × ${product.name}` })
    return true
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title="Start a new bag?"
      description={`Your bag has items from ${cart?.storeName || 'another store'}. An order is picked up from one store, so adding this empties your bag first.`}
      confirmLabel="Empty bag and add"
      cancelLabel="Keep my bag"
      onConfirm={() => pending !== null && add(pending, true)}
    />
  )
  return { add, inBag, limit, room, dialog }
}

function limitNote(limit: number, inBag: number): string | null {
  if (limit >= MAX_ORDER_QUANTITY) return inBag >= limit ? `You can order up to ${MAX_ORDER_QUANTITY} at a time.` : null
  return `Only ${limit} available to order.`
}

/** Quantity picker and "Add to bag" for one product at one store. */
export function AddToCart({ product, store }: { product: StoreProduct; store: Store | undefined }) {
  const { add, inBag, limit, room, dialog } = useAddToBag(store, product)
  const [picked, setQuantity] = useState(1)
  // Stock can drop while the page is open; never offer more than can be added.
  const quantity = Math.max(1, Math.min(picked, room))

  const unavailable = limit <= 0
  const closed = store ? !store.is_open : false
  const disabled = !store || unavailable || closed || room <= 0
  const note = unavailable || closed ? null : limitNote(limit, inBag)

  const stepClass =
    'grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full bg-canvas p-1 ring-1 ring-line ring-inset" role="group" aria-label="Quantity">
          <button
            type="button"
            className={stepClass}
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={disabled || quantity <= 1}
            aria-label="One fewer"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-10 text-center font-bold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className={stepClass}
            onClick={() => setQuantity(Math.min(room, quantity + 1))}
            disabled={disabled || quantity >= room}
            aria-label="One more"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => add(quantity) && setQuantity(1)}
          disabled={disabled}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 font-bold text-white shadow-card transition hover:bg-brand-strong disabled:bg-ink-faint disabled:shadow-none sm:flex-none"
        >
          <ShoppingBag className="size-5" aria-hidden />
          {unavailable ? 'Out of stock' : closed ? 'Store is closed' : room <= 0 ? 'All available in your bag' : 'Add to bag'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {inBag > 0 ? (
          <>
            {inBag} in your bag ·{' '}
            <Link href="/cart" className="font-semibold text-brand hover:text-brand-strong">
              Go to bag
            </Link>
          </>
        ) : closed ? (
          "This store isn't taking orders right now."
        ) : (
          'Reserve it now and pick it up at the store.'
        )}
      </p>
      {note && <p className={cn('mt-1 text-xs font-semibold', limit < MAX_ORDER_QUANTITY ? 'text-amber-700' : 'text-ink-soft')}>{note}</p>}
      {dialog}
    </div>
  )
}

/** A round "add one" button laid over a product card. */
export function QuickAdd({ product, store, className }: { product: StoreProduct; store: Store | undefined; className?: string }) {
  const { add, inBag, limit, room, dialog } = useAddToBag(store, product)
  if (!store?.is_open || limit <= 0) return null
  return (
    <>
      <button
        type="button"
        onClick={() => add(1)}
        disabled={room <= 0}
        title={room <= 0 ? `All ${inBag} available are in your bag` : undefined}
        aria-label={
          room <= 0
            ? `${inBag} ${product.name} in bag, all that can be ordered`
            : inBag
              ? `Add one more ${product.name} (${inBag} in bag)`
              : `Add ${product.name} to bag`
        }
        className={cn(
          'grid size-9 place-items-center rounded-full shadow-lift ring-1 transition disabled:opacity-50',
          inBag ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink ring-line hover:bg-ink hover:text-white',
          className,
        )}
      >
        {inBag ? (
          <span className="text-xs font-bold tabular-nums">{inBag}</span>
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
      </button>
      {dialog}
    </>
  )
}
