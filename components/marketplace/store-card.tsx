'use client'

import Link from 'next/link'
import { MapPin, Navigation, Store as StoreIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type Store, directionsUrl, storeHref } from '@/lib/marketplace'

function formatDate(date: string): string {
  // vacation_until is a calendar date (YYYY-MM-DD); read it as local midnight.
  const d = new Date(`${date}T00:00:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export function StoreCard({ store, linkToStore = false }: { store: Store; linkToStore?: boolean }) {
  const address = [store.address_line, store.city, store.pincode].filter(Boolean).join(', ')
  return (
    <section className="rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <StoreIcon className="size-7" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">{store.name}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset',
                store.is_open ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-zinc-100 text-zinc-600 ring-zinc-200',
              )}
            >
              <span className={cn('size-1.5 rounded-full', store.is_open ? 'bg-emerald-500' : 'bg-zinc-400')} aria-hidden />
              {store.is_open ? 'Open now' : 'Closed'}
            </span>
          </div>
          {store.vacation_until && <p className="mt-1 text-sm font-semibold text-amber-800">On holiday until {formatDate(store.vacation_until)}</p>}
          {store.description && <p className="mt-1 text-sm text-ink-soft">{store.description}</p>}
          {address && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden /> {address}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {linkToStore && (
            <Link href={storeHref(store.id)} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line ring-inset hover:bg-canvas">
              All products here
            </Link>
          )}
          <a
            href={directionsUrl(store.lat, store.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
        </div>
      </div>
    </section>
  )
}
