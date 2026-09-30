'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Store as StoreIcon } from 'lucide-react'

import { useApi } from '@/hooks/use-api'
import { setArea, useArea } from '@/hooks/use-area'
import { cn } from '@/lib/utils'
import {
  ApiError,
  type Area,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type CategoryCount,
  type NearbyProductsPage,
  RADIUS_OPTIONS_M,
  type SearchProduct,
  type SearchResult,
  apiGet,
  formatRadius,
  homeHref,
  nearbyProductsPath,
  searchPath,
} from '@/lib/marketplace'
import { PageShell, areaLabel } from './app-shell'
import { ProductCard } from './product-card'
import { Notice, ProductCardSkeleton, ProductGridSkeleton, RadiusPicker, productGridClass } from './shared'

export function HomePage() {
  const params = useSearchParams()
  const area = useArea()
  const q = (params.get('q') ?? '').trim()
  const category = (params.get('category') ?? '').trim()
  return (
    <PageShell query={q}>
      {q ? <SearchResults q={q} area={area} /> : <Browse category={category} area={area} />}
    </PageShell>
  )
}

function Browse({ category, area }: { category: string; area?: Area }) {
  const firstPath = area ? nearbyProductsPath(area, category || undefined) : null
  const first = useApi<NearbyProductsPage>(firstPath)
  // The previous page stays on screen while a new filter loads, so the chips don't flicker.
  const page = first.data ?? first.previous
  const categories = page ? (page.categories ?? []) : undefined

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-brand-soft via-[#eef6f0] to-surface px-5 py-7 ring-1 ring-line ring-inset sm:px-10 sm:py-10">
        <StoreIcon className="pointer-events-none absolute -right-6 -bottom-8 size-44 text-brand/[0.07] sm:size-56" aria-hidden />
        <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">{area ? `Near ${areaLabel(area)}` : 'Near you'}</p>
        <h1 className="mt-2 max-w-xl text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
          Everything nearby, <span className="text-accent">compared.</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm text-ink-soft sm:text-base">
          Products from stores {area ? `within ${formatRadius(area.radiusM)}` : 'around you'}, each with its own price and stock. Pick a
          store and go.
        </p>
        {area && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink-soft">Show stores within</span>
            <RadiusPicker value={area.radiusM} onChange={(radiusM) => setArea({ ...area, radiusM })} />
          </div>
        )}
      </section>

      {categories && categories.length > 0 && <CategoryChips categories={categories} active={category} />}

      {first.error ? (
        <Notice tone="error" title="Couldn't load nearby products">
          {first.error.message}
        </Notice>
      ) : !area || !firstPath || !page || !categories ? (
        <div className="mt-8">
          <ProductGridSkeleton />
        </div>
      ) : categories.length === 0 ? (
        <EmptyNearby area={area} />
      ) : (
        <NearbyProducts key={firstPath} first={page} loading={first.loading} area={area} category={category} />
      )}
    </>
  )
}

function CategoryChips({ categories, active }: { categories: CategoryCount[]; active: string }) {
  const chip = 'shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition'
  const on = 'bg-ink text-white ring-ink'
  const off = 'bg-surface text-ink-soft ring-line hover:text-ink hover:ring-ink/20'
  return (
    <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <Link href={homeHref()} scroll={false} className={cn(chip, !active ? on : off)} aria-current={!active ? 'page' : undefined}>
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.name}
          href={homeHref({ category: c.name })}
          scroll={false}
          className={cn(chip, active === c.name ? on : off)}
          aria-current={active === c.name ? 'page' : undefined}
        >
          {c.name} <span className={cn('ml-1 font-normal', active === c.name ? 'text-white/70' : 'text-ink-faint')}>{c.product_count}</span>
        </Link>
      ))}
    </nav>
  )
}

function productCount(n: number): string {
  return `${n} ${n === 1 ? 'product' : 'products'}`
}

type LoadedMore = { products: SearchProduct[]; cursor?: string; hasMore: boolean }

/** How far below the viewport the next page starts loading. */
const PREFETCH_MARGIN = '800px'
const MAX_PENDING_SKELETONS = 10

/**
 * Every nearby product, or only those in category, by name. Later pages load as
 * the list scrolls into view. Keyed by the first page's path, so a new area or
 * filter starts over.
 */
function NearbyProducts({
  first,
  loading,
  area,
  category,
}: {
  first: NearbyProductsPage
  loading: boolean
  area: Area
  category: string
}) {
  const [more, setMore] = useState<LoadedMore | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const products = [...first.products, ...(more?.products ?? [])]
  const cursor = more ? more.cursor : first.next_cursor
  const hasMore = more ? more.hasMore : first.has_more
  const sentinel = useRef<HTMLDivElement>(null)
  // product_count can run ahead of what arrives (products with no stores are skipped), so keep at least a couple.
  const pendingSkeletons = Math.min(Math.max(first.product_count - products.length, 2), MAX_PENDING_SKELETONS)

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiGet<NearbyProductsPage>(nearbyProductsPath(area, category || undefined, cursor))
      setMore((prev) => ({
        products: [...(prev?.products ?? []), ...page.products],
        cursor: page.next_cursor,
        hasMore: page.has_more,
      }))
    } catch (err) {
      setMoreError(err instanceof ApiError ? err.message : 'Could not load more products.')
    } finally {
      setLoadingMore(false)
    }
  }

  const onReachEnd = useEffectEvent(() => {
    void loadMore()
  })

  // Re-observing after every page makes the observer report again if the end of
  // the list is still in view, so tall screens keep filling.
  const paused = !cursor || loading || loadingMore || moreError !== null
  useEffect(() => {
    const el = sentinel.current
    if (paused || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReachEnd()
      },
      { rootMargin: `0px 0px ${PREFETCH_MARGIN} 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [paused, cursor])

  if (category && first.product_count === 0) {
    return (
      <Notice title={`No ${category} nearby`}>
        <p>Nothing in this category is sold within this distance.</p>
        <Link href={homeHref()} className="mt-4 inline-block rounded-full bg-ink px-4 py-2 font-semibold text-white">
          See all products
        </Link>
      </Notice>
    )
  }
  return (
    <section className={cn('mt-10 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{category || 'All products'}</h2>
        <p className="text-sm text-ink-soft">{productCount(first.product_count)} nearby</p>
      </div>
      <div className={productGridClass}>
        {products.map((p) => (
          <ProductCard key={p.catalog_key} product={p} />
        ))}
        {hasMore &&
          !moreError &&
          Array.from({ length: pendingSkeletons }, (_, i) => <ProductCardSkeleton key={`pending-${i}`} />)}
      </div>
      <div ref={sentinel} aria-hidden />
      <p role="status" className="sr-only">
        {loadingMore ? 'Loading more products' : ''}
      </p>
      {moreError ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p role="alert" className="text-sm text-red-700">
            {moreError}
          </p>
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      ) : (
        !hasMore &&
        products.length > 0 && (
          <p className="mt-8 text-center text-xs text-ink-faint">That’s all {productCount(products.length)} nearby</p>
        )
      )}
    </section>
  )
}

function EmptyNearby({ area }: { area: Area }) {
  const wider = RADIUS_OPTIONS_M.filter((r) => r > area.radiusM)
  return (
    <Notice title={`No products within ${formatRadius(area.radiusM)} yet`} icon={<StoreIcon className="size-6" aria-hidden />}>
      <p>Stores near {areaLabel(area)} haven&apos;t listed anything so far. Try looking a little further.</p>
      {wider.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
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
    </Notice>
  )
}

function SearchResults({ q, area }: { q: string; area?: Area }) {
  const valid = q.length >= MIN_QUERY_LENGTH && q.length <= MAX_QUERY_LENGTH
  const search = useApi<SearchResult>(area && valid ? searchPath(q, area) : null)
  const result = search.data ?? search.previous

  if (!valid) {
    return (
      <Notice tone="error" title="Search needs a few more letters">
        Type {MIN_QUERY_LENGTH} to {MAX_QUERY_LENGTH} characters.
      </Notice>
    )
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Results for “{q}”</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {search.data ? `${search.data.products.length} ${search.data.products.length === 1 ? 'product' : 'products'} · ` : ''}
            {area ? `within ${formatRadius(area.radiusM)} of ${areaLabel(area)}` : ''}
          </p>
        </div>
        {area && <RadiusPicker value={area.radiusM} onChange={(radiusM) => setArea({ ...area, radiusM })} />}
      </div>

      {search.error ? (
        <Notice tone="error" title="Search failed">
          {search.error.message}
        </Notice>
      ) : !result ? (
        <div className="mt-6">
          <ProductGridSkeleton />
        </div>
      ) : result.products.length === 0 ? (
        <NoResults q={q} area={area} />
      ) : (
        <div className={cn('mt-6', productGridClass, search.loading && 'opacity-60 transition-opacity')}>
          {result.products.map((p) => (
            <ProductCard key={p.catalog_key} product={p} />
          ))}
        </div>
      )}
    </>
  )
}

function NoResults({ q, area }: { q: string; area?: Area }) {
  const wider = area ? RADIUS_OPTIONS_M.find((r) => r > area.radiusM) : undefined
  return (
    <Notice title={`No nearby stores have “${q}”`}>
      <p>Check the spelling, try a brand name, or look further away.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {area && wider && (
          <button
            type="button"
            onClick={() => setArea({ ...area, radiusM: wider })}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
          >
            Search within {formatRadius(wider)}
          </button>
        )}
        <Link href={homeHref()} className="rounded-full px-4 py-2 text-sm font-semibold text-brand ring-1 ring-line ring-inset hover:bg-brand-soft">
          Browse nearby products
        </Link>
      </div>
    </Notice>
  )
}
