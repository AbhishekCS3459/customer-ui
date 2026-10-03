// Client for the public marketplace API (backend internal/marketplace).
// Nothing here needs a login; responses never contain exact quantities unless
// the backend runs with DEBUG_MARKETPLACE=true and we send X-Debug: 1.

// Empty means same-origin /api, which next.config.mjs proxies to BACKEND_URL.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
const DEBUG = process.env.NEXT_PUBLIC_MARKETPLACE_DEBUG === 'true'

// Temporary: remove once the deployed backend is confirmed.
if (typeof window !== 'undefined') {
  console.info('[customer-ui] BACKEND_URL:', process.env.BACKEND_URL, '| API calls go to:', API_URL || `${window.location.origin}/api (proxied)`)
}

export type Sort = 'nearest' | 'cheapest' | 'availability'
export type AvailabilityBucket = 'IN_STOCK' | 'LOW' | 'OUT' | 'CONFIRM_WITH_STORE'

export type Debug = { available_qty: number; version: number }

export type Product = {
  catalog_key: string
  name: string
  brand: string
  unit: string
  category_path: string
  image_url: string
}

export type StoreOffer = {
  store_id: string
  store_name: string
  distance_m: number
  lat: number
  lng: number
  price: number
  availability_bucket: AvailabilityBucket
  last_stock_update_at: string
  /** Grows with every change at this store; live updates with a version no higher are already reflected. */
  version: number
  debug?: Debug
}

/** One store's change to a product, from the live stream. Never an exact quantity. */
export type OfferUpdate = {
  catalog_key: string
  store_id: string
  price: number
  availability_bucket: AvailabilityBucket
  /** False once customers can no longer find the product at the store. */
  searchable: boolean
  last_stock_update_at: string
  version: number
}

export type SearchProduct = Product & { stores: StoreOffer[] }

export type SearchResult = {
  query: string
  lat: number
  lng: number
  radius_m: number
  sort: Sort
  products: SearchProduct[]
}

export type CategoryCount = { name: string; product_count: number }

export type NearbyProductsPage = {
  lat: number
  lng: number
  radius_m: number
  sort: Sort
  category?: string
  /** Every product in the listing, across all pages. */
  product_count: number
  /** Every nearby category, whatever category is. First page only. */
  categories?: CategoryCount[]
  products: SearchProduct[]
  next_cursor?: string
  has_more: boolean
}

export type ProductNearby = SearchProduct & { lat: number; lng: number; radius_m: number; sort: Sort }

export type Store = {
  id: string
  name: string
  description: string
  address_line: string
  city: string
  pincode: string
  lat: number
  lng: number
  is_open: boolean
  vacation_until?: string
}

export type NearbyStore = Store & {
  /** The store's kind, e.g. "Pharmacy"; empty when unknown. */
  category: string
  distance_m: number
  cover_image_url?: string
  /** Products customers can find there; a closed store lists none. */
  product_count: number
  /** Of those, the ones not out of stock. */
  available_count: number
}

export type NearbyStoresResult = {
  lat: number
  lng: number
  radius_m: number
  /** Nearest first. */
  stores: NearbyStore[]
  /** More stores are within the radius than were returned. */
  has_more: boolean
}

export type StoreProduct = Product & {
  store_id: string
  price: number
  availability_bucket: AvailabilityBucket
  last_stock_update_at: string
  version: number
  debug?: Debug
}

export type StoreProductsPage = {
  products: StoreProduct[]
  next_cursor?: string
  has_more: boolean
}

// Limits enforced by the backend; the UI mirrors them to fail early.
export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 100
export const NEARBY_PAGE_SIZE = 30
export const DEFAULT_RADIUS_M = 5000
export const RADIUS_OPTIONS_M = [1000, 2000, 5000, 10000, 20000]
export const MAX_RADIUS_M = RADIUS_OPTIONS_M[RADIUS_OPTIONS_M.length - 1]
export const SORTS: { value: Sort; label: string }[] = [
  { value: 'nearest', label: 'Nearest' },
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'availability', label: 'In stock first' },
]

export function parseSort(value: string | null): Sort {
  return SORTS.some((s) => s.value === value) ? (value as Sort) : 'nearest'
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      signal,
      cache: 'no-store',
      headers: DEBUG ? { 'X-Debug': '1' } : undefined,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw unreachable()
  }
  if (!res.ok) throw await apiError(res)
  return (await res.json()) as T
}

export function unreachable(): ApiError {
  return new ApiError(0, `Can't reach the marketplace${API_URL ? ` at ${API_URL}` : ''}. Is the backend running?`)
}

/** The backend's error message for a failed response, or a generic one. */
export async function apiError(res: Response): Promise<ApiError> {
  let message = res.status === 429 ? 'Too many requests; wait a moment and try again.' : `Request failed (${res.status})`
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error
  } catch {
    // Not JSON (e.g. the rate limiter's plain-text reply); keep the default message.
  }
  return new ApiError(res.status, message)
}

// Area: where the customer is shopping. Remembered in this browser.

export type Area = { lat: number; lng: number; label?: string; radiusM: number }

/** Koramangala, Bengaluru: the marketplace demo seed's test point. */
export const DEFAULT_AREA: Area = { lat: 12.9352, lng: 77.6245, label: 'Koramangala, Bengaluru', radiusM: DEFAULT_RADIUS_M }

export const AREA_KEY = 'todayz.area'

export function validLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function parseArea(raw: string | null): Area | null {
  try {
    const a = JSON.parse(raw ?? 'null') as Partial<Area> | null
    if (!a || typeof a.lat !== 'number' || typeof a.lng !== 'number' || !validLatLng(a.lat, a.lng)) return null
    const radiusM = typeof a.radiusM === 'number' && a.radiusM > 0 && a.radiusM <= MAX_RADIUS_M ? a.radiusM : DEFAULT_RADIUS_M
    return { lat: a.lat, lng: a.lng, label: typeof a.label === 'string' ? a.label : undefined, radiusM }
  } catch {
    return null
  }
}

function areaParams(area: Area): Record<string, string> {
  return { lat: String(area.lat), lng: String(area.lng), radius_m: String(area.radiusM) }
}

// API paths

export function searchPath(q: string, area: Area, sort: Sort = 'nearest'): string {
  return `/api/marketplace/search?${new URLSearchParams({ q, ...areaParams(area), sort, limit: '50' })}`
}

/** Every product sold in the area by name, or only those in category. */
export function nearbyProductsPath(area: Area, category?: string, cursor?: string): string {
  const params = new URLSearchParams({ ...areaParams(area), limit: String(NEARBY_PAGE_SIZE) })
  if (category) params.set('category', category)
  if (cursor) params.set('cursor', cursor)
  return `/api/marketplace/nearby/products?${params}`
}

/** Stores within the area, nearest first, closed ones included. */
export function nearbyStoresPath(area: Area): string {
  return `/api/marketplace/nearby/stores?${new URLSearchParams({ ...areaParams(area), limit: '100' })}`
}

export function productPath(catalogKey: string, area: Area, sort: Sort): string {
  return `/api/marketplace/products/${encodeURIComponent(catalogKey)}?${new URLSearchParams({ ...areaParams(area), sort })}`
}

/** Server-sent events with the product's availability changes, only storeId's if given. */
export function productLivePath(catalogKey: string, storeId?: string): string {
  const query = storeId ? `?${new URLSearchParams({ store_id: storeId })}` : ''
  return `/api/marketplace/products/${encodeURIComponent(catalogKey)}/live${query}`
}

export function storePath(storeId: string): string {
  return `/api/marketplace/stores/${encodeURIComponent(storeId)}`
}

export function storeProductPath(storeId: string, catalogKey: string): string {
  return `/api/marketplace/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(catalogKey)}`
}

export function storeProductsPath(storeId: string, cursor?: string, q?: string): string {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (q) params.set('q', q)
  const query = params.toString()
  return `/api/marketplace/stores/${encodeURIComponent(storeId)}/products${query ? `?${query}` : ''}`
}

// UI links

export function homeHref({ q, category }: { q?: string; category?: string } = {}): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const query = params.toString()
  return query ? `/?${query}` : '/'
}

export function productHref(catalogKey: string): string {
  return `/products/${encodeURIComponent(catalogKey)}`
}

export function storeHref(storeId: string): string {
  return `/stores/${storeId}`
}

export function storeProductHref(storeId: string, catalogKey: string): string {
  return `/stores/${storeId}/products/${encodeURIComponent(catalogKey)}`
}

/**
 * Route params may arrive encoded or already decoded depending on the router;
 * catalog keys never contain '%', so decoding an already decoded key is a no-op.
 */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Summaries of a product's nearby stores

const bucketRank: Record<AvailabilityBucket, number> = { IN_STOCK: 0, LOW: 1, CONFIRM_WITH_STORE: 2, OUT: 3 }

/** The best availability among the stores, e.g. IN_STOCK if any store has it. */
export function bestBucket(stores: StoreOffer[]): AvailabilityBucket {
  return stores.reduce<AvailabilityBucket>(
    (best, s) => (bucketRank[s.availability_bucket] < bucketRank[best] ? s.availability_bucket : best),
    'OUT',
  )
}

/** The lowest price among stores that may have it, or among all when every store is out. */
export function lowestPrice(stores: StoreOffer[]): number | null {
  const available = stores.filter((s) => s.availability_bucket !== 'OUT')
  const pool = available.length ? available : stores
  return pool.length ? Math.min(...pool.map((s) => s.price)) : null
}

// The backend's store order for each sort (marketplace storeOrder).
const storeOrder: Record<Sort, (a: StoreOffer, b: StoreOffer) => number> = {
  nearest: (a, b) => Number(a.availability_bucket === 'OUT') - Number(b.availability_bucket === 'OUT') || a.distance_m - b.distance_m,
  cheapest: (a, b) =>
    Number(a.availability_bucket === 'OUT') - Number(b.availability_bucket === 'OUT') || a.price - b.price || a.distance_m - b.distance_m,
  availability: (a, b) => bucketRank[a.availability_bucket] - bucketRank[b.availability_bucket] || a.distance_m - b.distance_m,
}

function compareStoreIds(a: StoreOffer, b: StoreOffer): number {
  return a.store_id < b.store_id ? -1 : a.store_id > b.store_id ? 1 : 0
}

/**
 * Applies live updates newer than the stores' own versions, drops stores that
 * stopped listing the product and restores sort order. Returns stores itself
 * when nothing applies.
 */
export function mergeOfferUpdates(stores: StoreOffer[], updates: ReadonlyMap<string, OfferUpdate>, sort: Sort): StoreOffer[] {
  let changed = false
  const merged: StoreOffer[] = []
  for (const offer of stores) {
    const u = updates.get(offer.store_id)
    if (!u || u.version <= offer.version) {
      merged.push(offer)
      continue
    }
    changed = true
    if (!u.searchable) continue
    merged.push({
      ...offer,
      price: u.price,
      availability_bucket: u.availability_bucket,
      last_stock_update_at: u.last_stock_update_at,
      version: u.version,
    })
  }
  if (!changed) return stores
  return merged.sort((a, b) => storeOrder[sort](a, b) || compareStoreIds(a, b))
}

export function nearestDistance(stores: StoreOffer[]): number | null {
  return stores.length ? Math.min(...stores.map((s) => s.distance_m)) : null
}

// Formatting

export function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`
}

export function formatRadius(metres: number): string {
  return `${metres / 1000} km`
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
