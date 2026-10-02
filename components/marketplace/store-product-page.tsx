'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Clock, RefreshCw, ShoppingBag } from 'lucide-react'

import { useApi } from '@/hooks/use-api'
import { useLiveOffers } from '@/hooks/use-live-offers'
import {
  type AvailabilityBucket,
  type Store,
  type StoreProduct,
  formatDateTime,
  formatPrice,
  productHref,
  storeHref,
  storePath,
  storeProductPath,
  timeAgo,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { BackButton, PageShell } from './app-shell'
import { AvailabilityBadge, DebugQuantity, LiveIndicator, Notice, ProductImage, Spinner } from './shared'
import { StoreCard } from './store-card'

const bucketHelp: Record<AvailabilityBucket, string> = {
  IN_STOCK: 'The store has this in stock.',
  LOW: 'Only a few left. Go soon, or call ahead.',
  OUT: 'Out of stock at this store right now.',
  CONFIRM_WITH_STORE: "The store hasn't confirmed its stock recently. Check with them before you go.",
}

export function StoreProductPage({ storeId, catalogKey }: { storeId: string; catalogKey: string }) {
  // Bumping the nonce refetches; the API reads the primary database, so this is always current.
  const [nonce, setNonce] = useState(0)
  const live = useLiveOffers(catalogKey, {
    storeId,
    // Listing changes decide between the product and "not available": fetch it again.
    needsSnapshot: (u) => (product.error?.status === 404 ? u.searchable : !u.searchable),
  })
  const product = useApi<StoreProduct>(storeProductPath(storeId, catalogKey), nonce + live.revision)
  const store = useApi<Store>(storePath(storeId))
  const fetched = product.data ?? product.previous
  const update = live.updates.get(storeId)
  const shown =
    fetched && update?.searchable && update.version > fetched.version
      ? {
          ...fetched,
          price: update.price,
          availability_bucket: update.availability_bucket,
          last_stock_update_at: update.last_stock_update_at,
          version: update.version,
        }
      : fetched

  return (
    <PageShell>
      <BackButton />
      {product.error && !shown ? (
        product.error.status === 404 ? (
          <Notice title="Not available at this store">
            <p>This store doesn&apos;t list this product right now.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={productHref(catalogKey)} className="rounded-full bg-ink px-4 py-2 font-semibold text-white">
                Find it at other stores
              </Link>
              {store.data && (
                <Link href={storeHref(storeId)} className="rounded-full px-4 py-2 font-semibold text-brand ring-1 ring-line ring-inset">
                  See what {store.data.name} has
                </Link>
              )}
            </div>
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn't load this product">
            {product.error.message}
          </Notice>
        )
      ) : !shown ? (
        <Spinner />
      ) : (
        <>
          <section className="grid gap-6 rounded-[28px] border border-line bg-surface p-4 shadow-card sm:p-6 md:grid-cols-[minmax(0,360px)_1fr] md:gap-10">
            <ProductImage src={shown.image_url} alt={shown.name} className="mx-auto aspect-square w-full max-w-64 rounded-3xl md:max-w-none" />
            <div className="flex min-w-0 flex-col">
              {shown.category_path && <p className="text-xs font-medium text-brand">{shown.category_path}</p>}
              <h1 className="mt-2 text-2xl leading-tight font-black tracking-tight sm:text-4xl">{shown.name}</h1>
              <p className="mt-2 text-ink-soft">{[shown.brand, shown.unit].filter(Boolean).join(' · ')}</p>
              {store.data && <p className="mt-1 text-sm text-ink-faint">at {store.data.name}</p>}

              <div className="mt-6 rounded-2xl bg-canvas p-4">
                <div className={cn('text-4xl font-black', shown.availability_bucket === 'OUT' && 'text-ink-faint')}>{formatPrice(shown.price)}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AvailabilityBadge bucket={shown.availability_bucket} />
                  <DebugQuantity debug={shown.debug} />
                </div>
                <p className="mt-2 text-sm text-ink-soft">{bucketHelp[shown.availability_bucket]}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1.5" title={formatDateTime(shown.last_stock_update_at)}>
                  <Clock className="size-4 text-ink-faint" aria-hidden />
                  Stock updated {timeAgo(shown.last_stock_update_at)} · {formatDateTime(shown.last_stock_update_at)}
                </span>
                <LiveIndicator connected={live.connected} />
                <button
                  type="button"
                  onClick={() => setNonce((n) => n + 1)}
                  disabled={product.loading}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-brand ring-1 ring-line ring-inset hover:bg-brand-soft disabled:opacity-60"
                >
                  <RefreshCw className={cn('size-4', product.loading && 'animate-spin')} aria-hidden /> Refresh
                </button>
              </div>
              <p className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-ink-faint">
                <ShoppingBag className="size-3.5" aria-hidden /> Buy it at the store. Online ordering isn&apos;t available yet.
              </p>
              <Link href={productHref(shown.catalog_key)} className="mt-2 text-sm font-semibold text-brand hover:text-brand-strong">
                Compare prices at other stores →
              </Link>
            </div>
          </section>
          <div className="mt-6">{store.data && <StoreCard store={store.data} linkToStore />}</div>
        </>
      )}
    </PageShell>
  )
}
