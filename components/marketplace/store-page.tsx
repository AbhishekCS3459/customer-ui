'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { Loader2, Search, Store as StoreIcon, X } from 'lucide-react'

import { QuickAdd } from '@/components/orders/add-to-cart'
import { useApi } from '@/hooks/use-api'
import {
  ApiError,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type Store,
  type StoreProduct,
  type StoreProductsPage,
  apiGet,
  formatPrice,
  storePath,
  storeProductHref,
  storeProductsPath,
  timeAgo,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { BackButton, PageShell } from './app-shell'
import { AvailabilityBadge, DebugQuantity, Notice, ProductGridSkeleton, ProductImage, Spinner, productGridClass } from './shared'
import { StoreCard } from './store-card'

type LoadedMore = { base: string; products: StoreProduct[]; cursor?: string; hasMore: boolean }

export function StorePage({ storeId }: { storeId: string }) {
  const store = useApi<Store>(storePath(storeId))
  const [filter, setFilter] = useState('')
  const firstPath = storeProductsPath(storeId, undefined, filter || undefined)
  const first = useApi<StoreProductsPage>(firstPath)

  // Later pages, kept only while they belong to the current first page.
  const [more, setMore] = useState<LoadedMore | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const extra = more?.base === firstPath ? more : null
  const products = [...(first.data?.products ?? []), ...(extra?.products ?? [])]
  const cursor = extra ? extra.cursor : first.data?.next_cursor
  const hasMore = extra ? extra.hasMore : (first.data?.has_more ?? false)

  async function loadMore() {
    if (!cursor || loadingMore) return
    const base = firstPath
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiGet<StoreProductsPage>(storeProductsPath(storeId, cursor, filter || undefined))
      setMore((prev) => ({
        base,
        products: [...(prev?.base === base ? prev.products : []), ...page.products],
        cursor: page.next_cursor,
        hasMore: page.has_more,
      }))
    } catch (err) {
      setMoreError(err instanceof ApiError ? err.message : 'Could not load more products.')
    } finally {
      setLoadingMore(false)
    }
  }

  function onFilter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMoreError(null)
    setFilter(String(new FormData(e.currentTarget).get('q') ?? '').trim())
  }

  return (
    <PageShell>
      <BackButton />
      {store.error ? (
        store.error.status === 404 ? (
          <Notice tone="error" title="Store not found">
            This store doesn&apos;t exist or isn&apos;t on TodayZ right now.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn't load this store">
            {store.error.message}
          </Notice>
        )
      ) : !store.data ? (
        <Spinner label="Loading store…" />
      ) : (
        <>
          <StoreCard store={store.data} />
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Products at this store</h2>
              {store.data.is_open && (
                <form onSubmit={onFilter} role="search">
                  <label className="flex h-10 items-center gap-2 rounded-full bg-surface pr-1 pl-3 ring-1 ring-line ring-inset focus-within:ring-2 focus-within:ring-brand">
                    <Search className="size-4 text-ink-faint" aria-hidden />
                    <input
                      key={filter}
                      name="q"
                      defaultValue={filter}
                      placeholder="Search this store"
                      aria-label="Search this store"
                      minLength={MIN_QUERY_LENGTH}
                      maxLength={MAX_QUERY_LENGTH}
                      className="w-40 bg-transparent text-sm outline-none placeholder:text-ink-faint sm:w-56"
                    />
                    {filter && (
                      <button type="button" onClick={() => setFilter('')} aria-label="Clear search" className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-canvas">
                        <X className="size-4" />
                      </button>
                    )}
                  </label>
                </form>
              )}
            </div>
            {!store.data.is_open ? (
              <Notice title="This store is closed right now" icon={<StoreIcon className="size-6" aria-hidden />}>
                Its products will show here again when it reopens.
              </Notice>
            ) : first.error ? (
              <Notice tone="error" title="Couldn't load products">
                {first.error.message}
              </Notice>
            ) : !first.data ? (
              <ProductGridSkeleton count={5} />
            ) : products.length === 0 ? (
              <Notice title={filter ? `Nothing matching “${filter}” here` : 'No products listed yet'} />
            ) : (
              <>
                <ul className={productGridClass}>
                  {products.map((p) => (
                    <li key={p.catalog_key} className="relative">
                      <StoreProductCard storeId={storeId} product={p} />
                      <QuickAdd product={p} store={store.data} className="absolute top-4 right-4 sm:top-5 sm:right-5" />
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col items-center gap-2">
                  {hasMore && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
                    >
                      {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      Show more products
                    </button>
                  )}
                  {moreError && (
                    <p role="alert" className="text-sm text-red-700">
                      {moreError}
                    </p>
                  )}
                  <p className="text-xs text-ink-faint">
                    Showing {products.length} {products.length === 1 ? 'product' : 'products'}
                    {hasMore ? '' : ' · that’s everything'}
                  </p>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}

function StoreProductCard({ storeId, product }: { storeId: string; product: StoreProduct }) {
  return (
    <Link
      href={storeProductHref(storeId, product.catalog_key)}
      className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-2.5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift sm:p-3"
    >
      <div className="relative">
        <ProductImage src={product.image_url} alt={product.name} className="aspect-square w-full" />
        <AvailabilityBadge bucket={product.availability_bucket} className="absolute top-2 left-2 bg-surface/95" />
      </div>
      <div className="mt-3 flex flex-1 flex-col px-1">
        {product.brand && <p className="truncate text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{product.brand}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold">{product.name}</h3>
        {product.unit && <p className="mt-0.5 text-xs text-ink-faint">{product.unit}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className={cn('text-lg font-bold', product.availability_bucket === 'OUT' && 'text-ink-faint')}>{formatPrice(product.price)}</span>
          <span className="text-[11px] text-ink-faint">{timeAgo(product.last_stock_update_at)}</span>
        </div>
        <DebugQuantity debug={product.debug} />
      </div>
    </Link>
  )
}
