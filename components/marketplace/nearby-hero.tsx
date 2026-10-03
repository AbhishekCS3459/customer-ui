'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPinned, Navigation, Store as StoreIcon } from 'lucide-react'

import { useApi } from '@/hooks/use-api'
import { setArea } from '@/hooks/use-area'
import { cn } from '@/lib/utils'
import {
  type Area,
  type NearbyStore,
  type NearbyStoresResult,
  RADIUS_OPTIONS_M,
  formatDistance,
  formatRadius,
  nearbyStoresPath,
  storeHref,
} from '@/lib/marketplace'
import { areaLabel } from './app-shell'
import { RadiusPicker } from './shared'

// Leaflet needs window, so the map only ever renders in the browser.
const StoresMap = dynamic(() => import('./stores-map'), { ssr: false, loading: () => <MapPlaceholder /> })

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The landing hero: the customer's area on a live map of the stores within
 * their radius, with those stores in a strip below. Hovering a card lights up
 * its pin; choosing a pin brings its card into view.
 */
export function NearbyHero({ area, productTotal }: { area?: Area; productTotal?: number }) {
  const stores = useApi<NearbyStoresResult>(area ? nearbyStoresPath(area) : null)
  // The previous area's stores stay on the map while the new ones load.
  const result = stores.data ?? stores.previous
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const openCount = result?.stores.filter((s) => s.is_open).length

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-brand-soft via-[#eef6f0] to-surface ring-1 ring-line ring-inset">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="relative flex flex-col justify-center px-5 py-7 sm:px-10 sm:py-10">
            <StoreIcon className="pointer-events-none absolute -bottom-10 -left-8 size-44 text-brand/[0.06]" aria-hidden />
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-brand uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              {area ? `Live near ${areaLabel(area)}` : 'Live near you'}
            </p>
            <h1 className="mt-3 max-w-xl text-3xl leading-[1.05] font-black tracking-tight sm:text-5xl">
              Every store nearby, <span className="text-accent">on one map.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-ink-soft sm:text-base">
              See who&apos;s open {area ? `within ${formatRadius(area.radiusM)}` : 'around you'}, what they stock and their prices — then
              walk in and buy.
            </p>

            <dl className="mt-6 grid max-w-md grid-cols-3 gap-2 sm:gap-3">
              <Stat label={result?.has_more ? 'nearest stores' : 'stores nearby'} value={result?.stores.length} />
              <Stat label="open now" value={openCount} tone="open" />
              <Stat label="products" value={productTotal} />
            </dl>

            {area && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-ink-soft">Show stores within</span>
                <RadiusPicker value={area.radiusM} onChange={(radiusM) => setArea({ ...area, radiusM })} />
              </div>
            )}
          </div>

          <div className="relative isolate z-0 m-2 h-80 overflow-hidden rounded-[22px] shadow-card ring-1 ring-line sm:m-3 sm:h-104 lg:ml-0 lg:h-auto lg:min-h-112">
            {area ? (
              <StoresMap
                area={area}
                result={result}
                activeId={hoveredId ?? selectedId}
                onHover={setHoveredId}
                onSelect={setSelectedId}
              />
            ) : (
              <MapPlaceholder />
            )}
            <MapLegend loading={stores.loading} />
          </div>
        </div>
      </section>

      <StoreStrip
        area={area}
        result={result}
        loading={stores.loading}
        error={stores.error?.message}
        activeId={hoveredId ?? selectedId}
        selectedId={selectedId}
        onHover={setHoveredId}
      />
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: 'open' }) {
  const shown = useCountUp(value)
  return (
    <div className="flex flex-col-reverse rounded-2xl bg-surface/80 px-3 py-3 ring-1 ring-line backdrop-blur-sm ring-inset sm:px-4">
      <dt className="mt-1.5 text-[11px] font-semibold text-ink-soft sm:text-xs">{label}</dt>
      <dd className={cn('text-2xl leading-none font-black tabular-nums sm:text-3xl', tone === 'open' ? 'text-brand' : 'text-ink')}>
        {value === undefined ? <span className="inline-block h-7 w-8 animate-pulse rounded-md bg-canvas align-middle" /> : shown}
      </dd>
    </div>
  )
}

/** Counts up from the last value shown to target; jumps straight there when motion is reduced. */
function useCountUp(target: number | undefined, ms = 900): number {
  const [value, setValue] = useState(0)
  const shown = useRef(0)
  useEffect(() => {
    if (target === undefined) return
    const from = shown.current
    const duration = prefersReducedMotion() ? 0 : ms
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1)
      const next = Math.round(from + (target - from) * (1 - (1 - t) ** 3))
      shown.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

function MapPlaceholder() {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas" aria-hidden>
      <MapPinned className="size-10 animate-pulse text-brand/30" />
    </div>
  )
}

/** Above Leaflet's panes (z-index 400) inside the map's stacking context. */
function MapLegend({ loading }: { loading: boolean }) {
  const item = 'flex items-center gap-1.5'
  return (
    <div className="pointer-events-none absolute top-3 right-3 z-[500] flex items-center gap-3 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-soft shadow-card backdrop-blur-sm">
      <span className={item}>
        <span className="size-2.5 rounded-full bg-accent ring-2 ring-white" /> You
      </span>
      <span className={item}>
        <span className="size-2.5 rounded-full bg-brand ring-2 ring-white" /> Open
      </span>
      <span className={item}>
        <span className="size-2.5 rounded-full bg-zinc-400 ring-2 ring-white" /> Closed
      </span>
      <span className={cn(item, 'max-sm:hidden')}>
        <span className="grid size-4 place-items-center rounded-full bg-white text-[8px] font-black text-ink ring-2 ring-brand">3</span> Group
      </span>
      {loading && <span className="size-2.5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-label="Loading stores" />}
    </div>
  )
}

function storeCount(n: number): string {
  return `${n} ${n === 1 ? 'store' : 'stores'}`
}

function StoreStrip({
  area,
  result,
  loading,
  error,
  activeId,
  selectedId,
  onHover,
}: {
  area?: Area
  result?: NearbyStoresResult
  loading: boolean
  error?: string
  activeId: string | null
  selectedId: string | null
  onHover: (id: string | null) => void
}) {
  const scroller = useRef<HTMLOListElement>(null)

  // A pin chosen on the map centres its card in the strip, without scrolling the page.
  useEffect(() => {
    const el = scroller.current
    const card = selectedId ? el?.querySelector<HTMLElement>(`[data-store-id="${selectedId}"]`) : null
    if (!el || !card) return
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [selectedId])

  function scrollBy(direction: 1 | -1) {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const stores = result?.stores
  const openCount = stores?.filter((s) => s.is_open).length ?? 0
  return (
    <section className="mt-10" aria-labelledby="nearby-stores-heading" aria-busy={loading}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="nearby-stores-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            Stores near you
          </h2>
          <p className="text-sm text-ink-soft">
            {stores && area
              ? `${result?.has_more ? `Nearest ${storeCount(stores.length)}` : storeCount(stores.length)} within ${formatRadius(result?.radius_m ?? area.radiusM)} · ${openCount} open now`
              : 'Finding stores around you…'}
          </p>
        </div>
        {stores && stores.length > 1 && (
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll stores left"
              className="grid size-9 place-items-center rounded-full bg-surface text-ink-soft ring-1 ring-line ring-inset hover:text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Scroll stores right"
              className="grid size-9 place-items-center rounded-full bg-surface text-ink-soft ring-1 ring-line ring-inset hover:text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {error && !stores ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn&apos;t load nearby stores: {error}
        </p>
      ) : !stores || !area ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <NoStores area={area} />
      ) : (
        <ol
          ref={scroller}
          className={cn(
            'no-scrollbar relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 transition-opacity sm:mx-0 sm:scroll-px-0 sm:px-0',
            loading && 'opacity-60',
          )}
        >
          {stores.map((store, i) => (
            <li
              key={store.id}
              data-store-id={store.id}
              className="w-64 shrink-0 animate-rise snap-start sm:w-72"
              style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
            >
              <NearbyStoreCard
                store={store}
                number={i + 1}
                radiusM={result?.radius_m ?? area.radiusM}
                active={store.id === activeId}
                onHover={onHover}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function NearbyStoreCard({
  store,
  number,
  radiusM,
  active,
  onHover,
}: {
  store: NearbyStore
  number: number
  radiusM: number
  active: boolean
  onHover: (id: string | null) => void
}) {
  const nearness = Math.max(4, Math.min(100, (store.distance_m / radiusM) * 100))
  const warm = number % 2 === 0
  return (
    <Link
      href={storeHref(store.id)}
      onMouseEnter={() => onHover(store.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(store.id)}
      onBlur={() => onHover(null)}
      className={cn(
        'group flex h-full flex-col rounded-[1.5rem] border bg-surface p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-lift',
        active ? 'border-brand/50 shadow-lift ring-4 ring-brand/15' : 'border-line shadow-card',
        !store.is_open && 'opacity-85',
      )}
    >
      <div
        className={cn(
          'relative h-32 overflow-hidden rounded-2xl bg-linear-to-br',
          warm ? 'from-[#fbf6ee] to-[#f0e8da]' : 'from-[#eef5ef] to-[#dde9de]',
        )}
      >
        {store.cover_image_url ? (
          // Store photos come from many hosts; next.config has images.unoptimized.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.cover_image_url}
            alt=""
            loading="lazy"
            className={cn('h-full w-full object-cover transition duration-500 group-hover:scale-105', !store.is_open && 'grayscale')}
          />
        ) : (
          <>
            <div
              className={cn(
                'absolute inset-0 [background-size:10px_10px] opacity-25',
                warm
                  ? 'bg-[radial-gradient(var(--color-accent)_1px,transparent_1px)]'
                  : 'bg-[radial-gradient(var(--color-brand)_1px,transparent_1px)]',
              )}
              aria-hidden
            />
            <span
              className={cn(
                'absolute -right-1 -bottom-8 text-[7.5rem] leading-none font-black transition duration-500 group-hover:-translate-y-1 group-hover:scale-110',
                warm ? 'text-accent/15' : 'text-brand/15',
              )}
              aria-hidden
            >
              {store.name.charAt(0).toUpperCase()}
            </span>
          </>
        )}
        <span
          className={cn(
            'absolute top-3 left-3 grid size-8 place-items-center rounded-xl text-xs font-black text-white shadow-card ring-2 ring-white',
            store.is_open ? 'bg-brand' : 'bg-zinc-400',
          )}
          aria-hidden
        >
          {number}
        </span>
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black tracking-wider text-ink uppercase shadow-card backdrop-blur-sm">
          <span className="relative flex size-1.5" aria-hidden>
            {store.is_open && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />}
            <span className={cn('relative inline-flex size-1.5 rounded-full', store.is_open ? 'bg-emerald-500' : 'bg-zinc-400')} />
          </span>
          {store.is_open ? 'Open' : store.vacation_until ? 'On holiday' : 'Closed'}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2 pt-3.5 pb-1">
        <p className="truncate text-[15px] font-black tracking-tight text-ink transition-colors group-hover:text-brand">{store.name}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-ink-faint">{[store.category, store.city].filter(Boolean).join(' · ')}</p>

        <div className="mt-3 mb-3.5 flex items-center gap-2.5">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-canvas px-2 py-1 text-[11px] font-bold text-ink tabular-nums">
            <Navigation className="size-3 fill-brand text-brand" aria-hidden />
            {formatDistance(store.distance_m)}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden>
            <span className="block h-full rounded-full bg-linear-to-r from-brand to-emerald-400" style={{ width: `${nearness}%` }} />
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-line pt-3 text-xs">
          {store.is_open && store.product_count > 0 ? (
            <>
              <span className="text-ink-soft">
                <span className="font-black text-ink">{store.product_count}</span> {store.product_count === 1 ? 'product' : 'products'}
              </span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">{store.available_count} in stock</span>
            </>
          ) : (
            <span className="py-1 font-medium text-ink-faint">{store.is_open ? 'Nothing listed yet' : 'Closed right now'}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function StoreCardSkeleton() {
  return (
    <div className="w-64 shrink-0 rounded-[1.5rem] border border-line bg-surface p-2.5 sm:w-72">
      <div className="h-32 animate-pulse rounded-2xl bg-canvas" />
      <div className="px-2 pt-3.5 pb-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-canvas" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-canvas" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-canvas" />
        <div className="mt-4 h-6 w-full animate-pulse rounded bg-canvas" />
      </div>
    </div>
  )
}

function NoStores({ area }: { area: Area }) {
  const wider = RADIUS_OPTIONS_M.filter((r) => r > area.radiusM)
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-8 text-center">
      <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <StoreIcon className="size-6" aria-hidden />
      </div>
      <h3 className="text-lg font-bold">No stores within {formatRadius(area.radiusM)} yet</h3>
      <p className="text-sm text-ink-soft">None of our stores are near {areaLabel(area)} so far. Try looking a little further.</p>
      {wider.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {wider.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setArea({ ...area, radiusM: r })}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
            >
              Within {formatRadius(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
