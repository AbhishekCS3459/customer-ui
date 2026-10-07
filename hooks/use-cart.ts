'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { MAX_ORDER_QUANTITY } from '@/lib/marketplace'

/** Most products in one order, as the backend allows. */
export const MAX_LINES = 50

export type CartLine = {
  catalogKey: string
  name: string
  unit: string
  imageUrl: string
  /** The price the customer saw, in rupees; checkout sends it so a price change is caught. */
  price: number
  /** How many the store could take an order for when last seen; the quantity can't be raised past it. */
  maxQuantity: number
  quantity: number
}

/** One store's bag: an order is always placed at a single store. */
export type Cart = { storeId: string; storeName: string; lines: CartLine[] }

const CART_KEY = 'todayz.cart'
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(CART_KEY)
  } catch {
    return null
  }
}

function parseCart(raw: string | null): Cart | null {
  try {
    const c = JSON.parse(raw ?? 'null') as Partial<Cart> | null
    if (!c || typeof c.storeId !== 'string' || !Array.isArray(c.lines)) return null
    const lines = c.lines
      .filter(
        (l): l is CartLine =>
          !!l && typeof l.catalogKey === 'string' && typeof l.price === 'number' && Number.isInteger(l.quantity) && l.quantity > 0,
      )
      .map((l) => ({
        ...l,
        // Bags saved before limits existed, or before the cap was lowered.
        maxQuantity: Number.isInteger(l.maxQuantity) ? Math.min(Math.max(l.maxQuantity, 0), MAX_ORDER_QUANTITY) : MAX_ORDER_QUANTITY,
        quantity: Math.min(l.quantity, MAX_ORDER_QUANTITY),
      }))
    return lines.length ? { storeId: c.storeId, storeName: typeof c.storeName === 'string' ? c.storeName : '', lines } : null
  } catch {
    return null
  }
}

function write(cart: Cart | null) {
  try {
    if (cart && cart.lines.length) localStorage.setItem(CART_KEY, JSON.stringify(cart))
    else localStorage.removeItem(CART_KEY)
  } catch {
    // Private mode or storage full: the bag can't be kept.
  }
  listeners.forEach((notify) => notify())
}

function current(): Cart | null {
  return parseCart(readRaw())
}

/** The bag, null when empty; undefined while server rendering and hydrating. */
export function useCart(): Cart | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined)
  return useMemo(() => (raw === undefined ? undefined : parseCart(raw)), [raw])
}

export function cartCount(cart: Cart | null | undefined): number {
  return cart?.lines.reduce((sum, l) => sum + l.quantity, 0) ?? 0
}

export function quantityInCart(cart: Cart | null | undefined, storeId: string, catalogKey: string): number {
  if (cart?.storeId !== storeId) return 0
  return cart.lines.find((l) => l.catalogKey === catalogKey)?.quantity ?? 0
}

export type AddResult = 'added' | 'other-store' | 'full'

/**
 * Adds quantity of a product from a store. A bag holds one store's products:
 * adding from another store returns 'other-store' unless replace is set,
 * which empties the bag first.
 */
export function addToCart(
  store: { id: string; name: string },
  line: Omit<CartLine, 'quantity'>,
  quantity: number,
  replace = false,
): AddResult {
  const cart = current()
  if (cart && cart.storeId !== store.id && !replace) return 'other-store'
  const base = cart && cart.storeId === store.id ? cart : { storeId: store.id, storeName: store.name, lines: [] }
  const existing = base.lines.find((l) => l.catalogKey === line.catalogKey)
  if (!existing && base.lines.length >= MAX_LINES) return 'full'
  const lines = existing
    ? base.lines.map((l) =>
        l.catalogKey === line.catalogKey
          ? { ...l, ...line, quantity: Math.max(l.quantity, Math.min(line.maxQuantity, l.quantity + quantity)) }
          : l,
      )
    : [...base.lines, { ...line, quantity: Math.min(line.maxQuantity, quantity) }]
  write({ ...base, storeName: store.name || base.storeName, lines })
  return 'added'
}

/** Sets a line's quantity, never raising it past the line's limit; zero removes it. */
export function setLineQuantity(catalogKey: string, quantity: number) {
  const cart = current()
  if (!cart) return
  const lines =
    quantity <= 0
      ? cart.lines.filter((l) => l.catalogKey !== catalogKey)
      : cart.lines.map((l) =>
          l.catalogKey === catalogKey ? { ...l, quantity: quantity > l.quantity ? Math.min(l.maxQuantity, quantity) : quantity } : l,
        )
  write({ ...cart, lines })
}

/** Records how many of each product the store can take now, e.g. after checkout found too few. */
export function updateLineLimits(limits: ReadonlyMap<string, number>) {
  const cart = current()
  if (!cart) return
  write({ ...cart, lines: cart.lines.map((l) => (limits.has(l.catalogKey) ? { ...l, maxQuantity: limits.get(l.catalogKey)! } : l)) })
}

/** Lowers each line to its limit, removing the ones the store can't take any of. */
export function fitLinesToLimits(catalogKeys: ReadonlySet<string>) {
  const cart = current()
  if (!cart) return
  const lines = cart.lines
    .map((l) => (catalogKeys.has(l.catalogKey) ? { ...l, quantity: Math.min(l.quantity, l.maxQuantity) } : l))
    .filter((l) => l.quantity > 0)
  write({ ...cart, lines })
}

/** Updates the prices the customer has now seen, e.g. after the store changed them. */
export function updateLinePrices(prices: ReadonlyMap<string, number>) {
  const cart = current()
  if (!cart) return
  write({ ...cart, lines: cart.lines.map((l) => (prices.has(l.catalogKey) ? { ...l, price: prices.get(l.catalogKey)! } : l)) })
}

export function clearCart() {
  write(null)
}
