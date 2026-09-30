'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, Navigation, Store as StoreIcon } from 'lucide-react'

import { useApi } from '@/hooks/use-api'
import { setArea, useArea } from '@/hooks/use-area'
import { cn } from '@/lib/utils'
import {
  type ProductNearby,
  RADIUS_OPTIONS_M,
  type Sort,
  type StoreOffer,
  bestBucket,
  directionsUrl,
  formatDateTime,
  formatDistance,
  formatPrice,
  formatRadius,
  homeHref,
  lowestPrice,
  productPath,
  storeProductHref,
  timeAgo,
} from '@/lib/marketplace'
import { BackButton, PageShell, areaLabel } from './app-shell'
import { AvailabilityBadge, DebugQuantity, Notice, ProductImage, SortPicker, Spinner } from './shared'

export function ProductPage({ catalogKey }: { catalogKey: string }) {
  const area = useArea()
  const [sort, setSort] = useState<Sort>('nearest')
  const product = useApi<ProductNearby>(area ? productPath(catalogKey, area, sort) : null)
  const shown = product.data ?? product.previous

  return (
    <PageShell>
      <BackButton />
      {product.error ? (
        product.error.status === 404 ? (
          <Notice title="Product not found">
            <p>No store lists this product right now.</p>
            <Link href={homeHref()} className="mt-4 inline-block rounded-full bg-ink px-4 py-2 font-semibold text-white">
              Browse nearby products
            </Link>
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn't load this product">
            {product.error.message}
          </Notice>
        )
      ) : !shown || !area ? (
        <Spinner />
      ) : (
        <>
          <section className="grid gap-6 rounded-[28px] border border-line bg-surface p-4 shadow-card sm:p-6 md:grid-cols-[minmax(0,360px)_1fr] md:gap-10">
            <ProductImage src={shown.image_url} alt={shown.name} className="mx-auto aspect-square w-full max-w-64 rounded-3xl md:max-w-none" />
            <div className="flex min-w-0 flex-col justify-center">
              {shown.category_path && <p className="text-xs font-medium text-brand">{shown.category_path}</p>}
              <h1 className="mt-2 text-2xl leading-tight font-black tracking-tight sm:text-4xl">{shown.name}</h1>
              <p className="mt-2 text-ink-soft">{[shown.brand, shown.unit].filter(Boolean).join(' · ')}</p>
              <Summary product={shown} />
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Compare stores</h2>
                <p className="text-sm text-ink-soft">
                  Within {formatRadius(area.radiusM)} of {areaLabel(area)}
                </p>
              </div>
              {shown.stores.length > 1 && <SortPicker value={sort} onChange={setSort} />}
            </div>
            {shown.stores.length === 0 ? (
              <NoStoresNearby radiusM={area.radiusM} onWiden={(radiusM) => setArea({ ...area, radiusM })} />
            ) : (
              <ul className={cn('flex flex-col gap-3 transition-opacity', product.loading && 'opacity-60')}>
                {shown.stores.map((offer, i) => (
                  <li key={offer.store_id}>
                    <OfferRow offer={offer} catalogKey={shown.catalog_key} highlight={i === 0 && shown.stores.length > 1 && offer.availability_bucket !== 'OUT'} sort={sort} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}

function Summary({ product }: { product: ProductNearby }) {
  const price = lowestPrice(product.stores)
  const count = product.stores.length
  if (count === 0) return null
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-canvas p-4">
      {price !== null && (
        <div>
          <div className="text-xs text-ink-faint">{count > 1 ? 'Lowest nearby price' : 'Price'}</div>
          <div className="text-3xl font-black">{formatPrice(price)}</div>
        </div>
      )}
      <div className="space-y-1">
        <AvailabilityBadge bucket={bestBucket(product.stores)} />
        <p className="text-sm text-ink-soft">
          Sold by {count} {count === 1 ? 'store' : 'stores'} near you
        </p>
      </div>
    </div>
  )
}

const highlightLabel: Record<Sort, string> = { nearest: 'Nearest', cheapest: 'Cheapest', availability: 'Best stock' }

function OfferRow({ offer, catalogKey, highlight, sort }: { offer: StoreOffer; catalogKey: string; highlight: boolean; sort: Sort }) {
  const out = offer.availability_bucket === 'OUT'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-3xl border bg-surface p-3 shadow-card sm:gap-4 sm:p-4',
        highlight ? 'border-brand/40 ring-1 ring-brand/20' : 'border-line',
      )}
    >
      <div className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand sm:grid">
        <StoreIcon className="size-5" aria-hidden />
      </div>
      <Link href={storeProductHref(offer.store_id, catalogKey)} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold hover:underline">{offer.store_name}</span>
          {highlight && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">{highlightLabel[sort]}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
          <span>{formatDistance(offer.distance_m)} away</span>
          <span aria-hidden>·</span>
          <AvailabilityBadge bucket={offer.availability_bucket} />
          <span title={formatDateTime(offer.last_stock_update_at)}>
            {offer.availability_bucket === 'CONFIRM_WITH_STORE' ? 'last confirmed' : 'updated'} {timeAgo(offer.last_stock_update_at)}
          </span>
          <DebugQuantity debug={offer.debug} />
        </div>
      </Link>
      <div className={cn('text-right text-lg font-bold sm:text-xl', out && 'text-ink-faint')}>{formatPrice(offer.price)}</div>
      <a
        href={directionsUrl(offer.lat, offer.lng)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Directions to ${offer.store_name}`}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-ink-soft transition hover:bg-brand hover:text-white"
      >
        <Navigation className="size-4" aria-hidden />
      </a>
      <Link
        href={storeProductHref(offer.store_id, catalogKey)}
        aria-label={`Details at ${offer.store_name}`}
        className="hidden size-10 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-canvas hover:text-ink sm:grid"
      >
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </div>
  )
}

function NoStoresNearby({ radiusM, onWiden }: { radiusM: number; onWiden: (radiusM: number) => void }) {
  const wider = RADIUS_OPTIONS_M.find((r) => r > radiusM)
  return (
    <Notice title={`No store within ${formatRadius(radiusM)} has this`} icon={<StoreIcon className="size-6" aria-hidden />}>
      <p>It&apos;s sold further away.</p>
      {wider && (
        <button type="button" onClick={() => onWiden(wider)} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          Look within {formatRadius(wider)}
        </button>
      )}
    </Notice>
  )
}
