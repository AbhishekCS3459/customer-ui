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
      className="group flex flex-col rounded-3xl border border-line bg-surface p-2.5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift sm:p-3"
    >
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="h-36 w-full bg-linear-to-br from-canvas to-[#e9efe6] transition duration-300 group-hover:from-brand-soft/70 sm:h-40"
        />
        <AvailabilityBadge bucket={bucket} className="absolute top-2 left-2 bg-surface/95 shadow-card backdrop-blur-sm" />
      </div>
      <div className="mt-3 flex flex-1 flex-col px-1">
        {product.brand && <p className="truncate text-[10px] font-bold tracking-[0.14em] text-ink-faint uppercase">{product.brand}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-black tracking-tight transition-colors group-hover:text-brand">
          {product.name}
        </h3>
        {product.unit && <p className="mt-1 text-xs font-medium text-ink-faint">{product.unit}</p>}
        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2 border-t border-dashed border-line pt-3">
            {price !== null && (
              <div className="leading-none">
                {storeCount > 1 && <span className="block text-[10px] font-bold tracking-wider text-ink-faint uppercase">from</span>}
                <span className={cn('mt-1 block text-lg font-black tracking-tight', bucket === 'OUT' && 'text-ink-faint')}>{formatPrice(price)}</span>
              </div>
            )}
            <div className="ml-auto flex flex-col items-end gap-1 text-[11px] leading-none">
              <span className="rounded-full bg-canvas px-2 py-1 font-bold text-ink-soft">
                {storeCount} {storeCount === 1 ? 'store' : 'stores'}
              </span>
              {nearest !== null && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-brand">
                  <MapPin className="size-3" aria-hidden />
                  {formatDistance(nearest)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
