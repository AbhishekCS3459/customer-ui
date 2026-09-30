'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type SearchProduct, bestBucket, formatDistance, formatPrice, lowestPrice, nearestDistance, productHref } from '@/lib/marketplace'
import { AvailabilityBadge, ProductImage } from './shared'

/** A product with a summary of its nearby stores; opens the store comparison. */
export function ProductCard({ product }: { product: SearchProduct }) {
  const bucket = bestBucket(product.stores)
  const price = lowestPrice(product.stores)
  const nearest = nearestDistance(product.stores)
  const storeCount = product.stores.length
  return (
    <Link
      href={productHref(product.catalog_key)}
      className="group flex flex-col rounded-3xl border border-line bg-surface p-2.5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift sm:p-3"
    >
      <div className="relative">
        <ProductImage src={product.image_url} alt={product.name} className="aspect-square w-full transition group-hover:bg-brand-soft/60" />
        <AvailabilityBadge bucket={bucket} className="absolute top-2 left-2 bg-surface/95" />
      </div>
      <div className="mt-3 flex flex-1 flex-col px-1">
        {product.brand && <p className="truncate text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{product.brand}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold">{product.name}</h3>
        {product.unit && <p className="mt-0.5 text-xs text-ink-faint">{product.unit}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {price !== null && (
            <div className="leading-tight">
              {storeCount > 1 && <span className="block text-[11px] text-ink-faint">from</span>}
              <span className={cn('text-lg font-bold', bucket === 'OUT' && 'text-ink-faint')}>{formatPrice(price)}</span>
            </div>
          )}
          <div className="text-right text-[11px] leading-tight text-ink-soft">
            <span className="block font-semibold">
              {storeCount} {storeCount === 1 ? 'store' : 'stores'}
            </span>
            {nearest !== null && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" aria-hidden />
                {formatDistance(nearest)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
