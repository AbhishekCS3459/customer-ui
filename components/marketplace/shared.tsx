'use client'

import type { ReactNode } from 'react'
import { AlertCircle, Loader2, Package, SearchX } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type AvailabilityBucket, type Debug, RADIUS_OPTIONS_M, SORTS, type Sort, formatRadius } from '@/lib/marketplace'

const buckets: Record<AvailabilityBucket, { label: string; dot: string; className: string }> = {
  IN_STOCK: { label: 'In stock', dot: 'bg-emerald-500', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80' },
  LOW: { label: 'Low stock', dot: 'bg-amber-500', className: 'bg-amber-50 text-amber-800 ring-amber-200/80' },
  CONFIRM_WITH_STORE: { label: 'Confirm with store', dot: 'bg-sky-500', className: 'bg-sky-50 text-sky-800 ring-sky-200/80' },
  OUT: { label: 'Out of stock', dot: 'bg-zinc-400', className: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
}

export function AvailabilityBadge({ bucket, className }: { bucket: AvailabilityBucket; className?: string }) {
  const b = buckets[bucket] ?? buckets.CONFIRM_WITH_STORE
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset',
        b.className,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', b.dot)} aria-hidden />
      {b.label}
    </span>
  )
}

/** Exact stock, present only when the backend is in debug mode and we asked for it. */
export function DebugQuantity({ debug }: { debug?: Debug }) {
  if (!debug) return null
  return (
    <span className="rounded-md bg-fuchsia-50 px-1.5 py-0.5 font-mono text-[11px] text-fuchsia-700" title="Debug mode only">
      qty {debug.available_qty} · v{debug.version}
    </span>
  )
}

export function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn('grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-canvas', className)}>
      {src ? (
        // Catalogue images come from many hosts; next.config has images.unoptimized.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-contain p-2 mix-blend-multiply" loading="lazy" />
      ) : (
        <Package className="size-1/3 max-h-10 max-w-10 text-ink-faint/60" aria-hidden />
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  )
}

/** Placeholder with the same footprint as a ProductCard. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-surface p-2.5 sm:p-3" aria-hidden>
      <div className="aspect-square animate-pulse rounded-2xl bg-canvas" />
      <div className="mt-3 px-1">
        <div className="h-3 w-1/3 animate-pulse rounded bg-canvas" />
        <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-canvas" />
        <div className="mt-1.5 h-3 w-1/4 animate-pulse rounded bg-canvas" />
        <div className="mt-4 flex items-end justify-between">
          <div className="h-5 w-1/3 animate-pulse rounded bg-canvas" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-canvas" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={productGridClass} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export const productGridClass = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'

export function Notice({
  title,
  children,
  tone = 'info',
  icon,
}: {
  title: string
  children?: ReactNode
  tone?: 'info' | 'error'
  icon?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'mx-auto my-8 flex max-w-lg flex-col items-center gap-2 rounded-3xl border px-6 py-10 text-center',
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-line bg-surface',
      )}
    >
      <div className={cn('mb-1 grid size-12 place-items-center rounded-2xl', tone === 'error' ? 'bg-red-100' : 'bg-brand-soft text-brand')}>
        {icon ?? (tone === 'error' ? <AlertCircle className="size-6" aria-hidden /> : <SearchX className="size-6" aria-hidden />)}
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="text-sm text-ink-soft">{children}</div>}
    </div>
  )
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-full bg-canvas p-1 ring-1 ring-line ring-inset', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm',
            o.value === value ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const radiusOptions = RADIUS_OPTIONS_M.map((r) => ({ value: r, label: formatRadius(r) }))

export function RadiusPicker({ value, onChange, className }: { value: number; onChange: (m: number) => void; className?: string }) {
  const options = radiusOptions.some((o) => o.value === value) ? radiusOptions : [...radiusOptions, { value, label: formatRadius(value) }]
  return <Segmented label="Distance" value={value} options={options} onChange={onChange} className={className} />
}

export function SortPicker({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return <Segmented label="Sort stores" value={value} options={SORTS} onChange={onChange} />
}
