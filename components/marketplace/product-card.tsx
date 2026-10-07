'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type SearchProduct, bestOffer, formatDistance, formatPrice, productHref, storeProductHref } from '@/lib/marketplace'
import { AvailabilityBadge, ProductImage } from './shared'

/** A product at its best nearby store; opens that store's page for it, where it can be added to the bag. */
export function ProductCard({ product }: { product: SearchProduct }) {
  const offer = bestOffer(product.stores)
  const otherStores = product.stores.length - 1
  return (
    <Link
      href={offer ? storeProductHref(offer.store_id, product.catalog_key) : productHref(product.catalog_key)}
      className="group flex flex-col rounded-3xl border border-line bg-surface p-2.5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift sm:p-3"
    >
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="h-36 w-full bg-linear-to-br from-canvas to-[#e9efe6] transition duration-300 group-hover:from-brand-soft/70 sm:h-40"
        />
        {offer && (
          <AvailabilityBadge bucket={offer.availability_bucket} className="absolute top-2 left-2 bg-surface/95 shadow-card backdrop-blur-sm" />
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col px-1">
        {product.brand && <p className="truncate text-[10px] font-bold tracking-[0.14em] text-ink-faint uppercase">{product.brand}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-black tracking-tight transition-colors group-hover:text-brand">
          {product.name}
        </h3>
        {product.unit && <p className="mt-1 text-xs font-medium text-ink-faint">{product.unit}</p>}
        {offer && (
          <div className="mt-auto pt-3">
            <div className="flex items-end justify-between gap-2 border-t border-dashed border-line pt-3">
              <span className={cn('text-lg leading-none font-black tracking-tight', offer.availability_bucket === 'OUT' && 'text-ink-faint')}>
                {formatPrice(offer.price)}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] leading-none font-semibold text-brand">
                <MapPin className="size-3" aria-hidden />
                {formatDistance(offer.distance_m)}
              </span>
            </div>
            <p className="mt-2 truncate text-[11px] text-ink-soft">
              at <span className="font-semibold text-ink">{offer.store_name}</span>
              {otherStores > 0 && ` · +${otherStores} more ${otherStores === 1 ? 'store' : 'stores'}`}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
