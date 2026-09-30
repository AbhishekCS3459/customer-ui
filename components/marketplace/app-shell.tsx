'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ChevronDown, Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'

import { setArea, useArea } from '@/hooks/use-area'
import { type Area, DEFAULT_AREA, MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, formatRadius, homeHref, validLatLng } from '@/lib/marketplace'
import { RadiusPicker } from './shared'

export function PageShell({ query, children }: { query?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader query={query} />
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-20 sm:px-6 sm:pt-8">{children}</main>
    </div>
  )
}

function AppHeader({ query = '' }: { query?: string }) {
  const router = useRouter()
  const area = useArea()
  const [locationOpen, setLocationOpen] = useState(false)

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (q.length >= MIN_QUERY_LENGTH) router.push(homeHref({ q }))
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:py-4">
        <div className="flex items-center gap-3 lg:gap-8">
          <Link href="/" className="flex shrink-0 flex-col leading-none" aria-label="TodayZ home">
            <span className="text-[26px] font-black tracking-[-0.06em] text-ink sm:text-3xl">
              Today<span className="text-brand">Z</span>
            </span>
            <span className="mt-1 hidden text-[9px] font-bold tracking-[0.22em] text-ink-faint uppercase sm:block">Shop the everyday</span>
          </Link>

          <form onSubmit={onSearch} role="search" className="min-w-0 flex-1">
            <label className="flex h-11 items-center gap-2 rounded-2xl bg-canvas px-3 ring-1 ring-line transition ring-inset focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand sm:h-12 sm:rounded-full sm:px-4">
              <Search className="size-4 shrink-0 text-brand sm:size-[18px]" aria-hidden />
              <input
                key={query}
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search products, brands or stores"
                aria-label="Search products"
                minLength={MIN_QUERY_LENGTH}
                maxLength={MAX_QUERY_LENGTH}
                required
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden rounded-md bg-surface px-2 py-1 text-[10px] font-semibold text-ink-faint ring-1 ring-line sm:block">⌘ K</kbd>
            </label>
          </form>

          <button type="button" onClick={() => setLocationOpen(true)} className="group flex shrink-0 items-center gap-2 rounded-2xl p-1.5 text-left transition hover:bg-canvas sm:px-2">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand"><MapPin className="size-4" aria-hidden /></span>
            <span className="hidden max-w-36 leading-tight sm:block">
              <span className="block text-[10px] font-semibold tracking-wide text-ink-faint uppercase">Delivering to</span>
              <span className="block truncate text-sm font-bold">{area ? areaLabel(area) : 'Choose location'}</span>
            </span>
            <ChevronDown className="hidden size-4 text-ink-faint sm:block" aria-hidden />
          </button>
        </div>
        <nav aria-label="Customer shortcuts" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-line/70 pt-3 text-xs font-semibold text-ink-soft">
          <Link href="/" className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-white">Discover</Link>
          <button type="button" onClick={() => setLocationOpen(true)} className="shrink-0 rounded-full bg-canvas px-3.5 py-2 hover:bg-brand-soft">Nearby stores</button>
          <span className="shrink-0 rounded-full bg-canvas px-3.5 py-2">Compare prices</span>
          <span className="shrink-0 rounded-full bg-canvas px-3.5 py-2">Offers today</span>
        </nav>
      </div>
      {area && <LocationDialog open={locationOpen} onOpenChange={setLocationOpen} area={area} />}
    </header>
  )
}

export function areaLabel(area: Area): string {
  return area.label ?? `${area.lat.toFixed(4)}, ${area.lng.toFixed(4)}`
}

function LocationDialog({ open, onOpenChange, area }: { open: boolean; onOpenChange: (open: boolean) => void; area: Area }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function choose(next: Area) {
    setArea(next)
    setError(null)
    onOpenChange(false)
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share its location. Enter it below instead.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const round = (n: number) => Math.round(n * 1e5) / 1e5
        choose({ ...area, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude), label: 'Your location' })
      },
      (err) => {
        setLocating(false)
        setError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. Enter it below instead.' : "Couldn't get your location. Enter it below instead.")
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  function onManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const lat = Number(form.get('lat'))
    const lng = Number(form.get('lng'))
    if (!validLatLng(lat, lng)) {
      setError('Latitude must be -90 to 90 and longitude -180 to 180.')
      return
    }
    const isDefault = lat === DEFAULT_AREA.lat && lng === DEFAULT_AREA.lng
    choose({ ...area, lat, lng, label: isDefault ? DEFAULT_AREA.label : undefined })
  }

  const inputClass = 'h-10 w-full rounded-xl bg-canvas px-3 text-sm ring-1 ring-line outline-none ring-inset focus:bg-surface focus:ring-2 focus:ring-brand'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-surface p-6 shadow-lift transition duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold">Where are you shopping?</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-soft">We show stores around this spot.</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-full bg-canvas text-ink-soft hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
            Use my current location
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" /> or enter coordinates <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={onManual} className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-soft">
              Latitude
              <input name="lat" defaultValue={area.lat} inputMode="decimal" required className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Longitude
              <input name="lng" defaultValue={area.lng} inputMode="decimal" required className={`mt-1 ${inputClass}`} />
            </label>
            <button type="submit" className="col-span-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/90">
              Use these coordinates
            </button>
          </form>

          <button
            type="button"
            onClick={() => choose({ ...area, lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng, label: DEFAULT_AREA.label })}
            className="mt-3 w-full rounded-2xl px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
          >
            Use {DEFAULT_AREA.label} (demo)
          </button>

          <div className="mt-5 border-t border-line pt-5">
            <p className="mb-2 text-xs font-semibold text-ink-soft">Show stores within</p>
            <RadiusPicker value={area.radiusM} onChange={(radiusM) => setArea({ ...area, radiusM })} />
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Goes back to where the customer came from, or home. */
export function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm font-semibold text-ink-soft hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back
    </button>
  )
}
