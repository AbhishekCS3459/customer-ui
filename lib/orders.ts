// Client for the customer's orders (backend internal/orders). Every call needs
// the signed-in customer's token. Money is in paise; the backend's deadlines
// are authoritative, the countdowns here only show them.

import { API_URL, ApiError, apiError, unreachable } from './marketplace'

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'ACCEPTED'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'NO_SHOW'
export type PaymentMode = 'ONLINE' | 'PAY_AT_STORE'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED'

export type OrderItem = {
  id: string
  variant_id: string
  catalog_key: string
  name: string
  unit: string
  quantity: number
  unit_price_paise: number
  line_total_paise: number
}

export type OrderPayment = {
  id: string
  provider: string
  status: 'CREATED' | 'SUCCEEDED' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED'
  amount_paise: number
  created_at: string
  /** Completed with the simulate endpoint instead of a real gateway. */
  simulated: boolean
}

export type OrderEvent = { from: OrderStatus | null; to: OrderStatus; actor: string; reason: string | null; at: string }

export type Order = {
  id: string
  code: string
  store_id: string
  store_name: string
  status: OrderStatus
  payment_mode: PaymentMode
  payment_status: PaymentStatus
  total_paise: number
  /** Deadline of the current status: paying, the store accepting, or collecting. */
  expires_at: string | null
  accepted_at: string | null
  ready_at: string | null
  completed_at: string | null
  closed_reason: string | null
  version: number
  created_at: string
  updated_at: string
  items: OrderItem[]
  /** Shown while the order can still be collected. */
  pickup_code?: string
  payment?: OrderPayment
  history?: OrderEvent[]
}

export type OrdersPage = { orders: Order[]; next_cursor?: string }

export type ItemProblem = {
  catalog_key: string
  reason: 'NOT_SOLD_HERE' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'PRICE_CHANGED'
  current_unit_price?: number
  /** With OUT_OF_STOCK: how many can be ordered now, possibly 0. */
  max_order_quantity?: number
}

/** An order API failure with the backend's machine-readable code, when it sent one. */
export class OrderError extends ApiError {
  constructor(
    status: number,
    message: string,
    readonly code?: string,
    readonly items: ItemProblem[] = [],
  ) {
    super(status, message)
    this.name = 'OrderError'
  }
}

/** Server time minus this device's time, from the last response's Date header. */
let clockOffsetMs = 0

/** Now, by the server's clock, so countdowns are right even when the device clock isn't. */
export function serverNow(): number {
  return Date.now() + clockOffsetMs
}

function learnClock(res: Response) {
  const date = Date.parse(res.headers.get('Date') ?? '')
  // The header has whole seconds; ignore sub-second differences.
  if (Number.isFinite(date) && Math.abs(date - Date.now()) > 1500) clockOffsetMs = date - Date.now()
  else if (Number.isFinite(date)) clockOffsetMs = 0
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  token: string,
  { body, idempotencyKey, signal }: { body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw unreachable()
  }
  learnClock(res)
  if (res.ok) return (await res.json()) as T
  if (res.status === 401) throw new OrderError(401, 'Your session has ended. Sign in again to continue.', 'UNAUTHORIZED')
  const details = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: string; items?: ItemProblem[] } | null
  const { message } = await apiError(res)
  throw new OrderError(res.status, message, details?.code, details?.items ?? [])
}

export type PlaceItem = { catalog_key: string; quantity: number; expected_unit_price?: number }

/**
 * Places an order and reserves its stock. Retrying with the same key returns
 * the same order instead of placing a second one.
 */
export function placeOrder(
  token: string,
  input: { store_id: string; payment_mode: PaymentMode; items: PlaceItem[] },
  idempotencyKey: string,
): Promise<Order> {
  return call('POST', '/api/orders', token, { body: input, idempotencyKey })
}

export function listOrders(token: string, cursor?: string, signal?: AbortSignal): Promise<OrdersPage> {
  const params = new URLSearchParams({ limit: '20' })
  if (cursor) params.set('cursor', cursor)
  return call<OrdersPage>('GET', `/api/orders?${params}`, token, { signal }).then((p) => ({ ...p, orders: p.orders ?? [] }))
}

export function getOrder(token: string, orderId: string, signal?: AbortSignal): Promise<Order> {
  return call('GET', `/api/orders/${encodeURIComponent(orderId)}`, token, { signal })
}

export function cancelOrder(token: string, orderId: string, reason?: string): Promise<Order> {
  return call('POST', `/api/orders/${encodeURIComponent(orderId)}/cancel`, token, { body: { reason: reason ?? '' } })
}

/** Opens a payment for an order waiting to be paid, or returns the one already open. */
export function startPayment(token: string, orderId: string): Promise<OrderPayment> {
  return call('POST', `/api/orders/${encodeURIComponent(orderId)}/payments`, token)
}

/** Completes a dummy payment the way a gateway would report it. */
export function simulatePayment(token: string, orderId: string, paymentId: string, outcome: 'SUCCEEDED' | 'FAILED'): Promise<Order> {
  return call('POST', `/api/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}/simulate`, token, {
    body: { outcome },
  })
}

/** A random v4 UUID. crypto.randomUUID exists only on HTTPS and localhost, so it isn't used. */
export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Presentation

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export const OPEN_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PLACED', 'ACCEPTED', 'READY']

export function isOpen(status: OrderStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'PENDING_PAYMENT' || status === 'PLACED' || status === 'ACCEPTED'
}

export type Tone = 'brand' | 'amber' | 'sky' | 'emerald' | 'zinc' | 'red'

export const STATUS_INFO: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: 'Waiting for payment', tone: 'amber' },
  PLACED: { label: 'Waiting for the store', tone: 'sky' },
  ACCEPTED: { label: 'Being packed', tone: 'brand' },
  READY: { label: 'Ready to collect', tone: 'emerald' },
  COMPLETED: { label: 'Collected', tone: 'zinc' },
  CANCELLED: { label: 'Cancelled', tone: 'zinc' },
  REJECTED: { label: 'Declined by the store', tone: 'red' },
  EXPIRED: { label: 'Payment time ran out', tone: 'zinc' },
  NO_SHOW: { label: 'Not collected', tone: 'red' },
}

export const PAYMENT_INFO: Record<PaymentStatus, string> = {
  UNPAID: 'Not paid',
  PAID: 'Paid',
  REFUND_PENDING: 'Refund on its way',
  REFUNDED: 'Refunded',
}

const PROBLEM_LABEL: Record<ItemProblem['reason'], string> = {
  NOT_SOLD_HERE: 'No longer sold at this store',
  UNAVAILABLE: 'Not available right now',
  OUT_OF_STOCK: 'Not enough left',
  PRICE_CHANGED: 'Price changed',
}

export function problemLabel(p: ItemProblem): string {
  if (p.reason !== 'OUT_OF_STOCK' || p.max_order_quantity === undefined) return PROBLEM_LABEL[p.reason]
  return p.max_order_quantity > 0 ? `Only ${p.max_order_quantity} available` : 'Out of stock'
}

export function ordersHref(): string {
  return '/orders'
}

export function orderHref(orderId: string): string {
  return `/orders/${orderId}`
}
