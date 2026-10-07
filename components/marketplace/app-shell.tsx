'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { Toast } from '@base-ui/react/toast'
import { ArrowLeft, ChevronDown, Crosshair, Loader2, LogOut, MapPin, Package, Search, ShoppingBag, UserRound, X } from 'lucide-react'

import { setArea, useArea } from '@/hooks/use-area'
import { cartCount, useCart } from '@/hooks/use-cart'
import { endSession, useSession } from '@/hooks/use-session'
import { type Session, displayName, initials } from '@/lib/auth'
import { type Area, DEFAULT_AREA, MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, formatRadius, homeHref, validLatLng } from '@/lib/marketplace'
import { AuthDialog } from './auth-dialog'
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
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <Link href="/" className="order-1 flex shrink-0 flex-col leading-none" aria-label="TodayZ home">
          <span className="text-2xl font-black tracking-tight text-ink">
            Today<span className="text-brand">Z</span>
          </span>
          <span className="mt-1 text-[9px] font-bold tracking-[0.2em] text-ink-faint uppercase">Find it nearby</span>
        </Link>

        <form onSubmit={onSearch} role="search" className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
          <label className="flex h-11 items-center gap-2 rounded-full bg-canvas px-4 ring-1 ring-line transition ring-inset focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <input
              // Remount when the URL's query changes so the box shows it.
              key={query}
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search products or brands, e.g. coke"
              aria-label="Search products"
              minLength={MIN_QUERY_LENGTH}
              maxLength={MAX_QUERY_LENGTH}
              required
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </label>
        </form>

        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="order-2 ml-auto flex max-w-[60%] items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-left transition hover:bg-canvas lg:order-3 lg:ml-0 lg:max-w-xs"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <MapPin className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] text-ink-faint">{area ? `Within ${formatRadius(area.radiusM)} of` : 'Shopping near'}</span>
            <span className="block truncate text-sm font-semibold">{area ? areaLabel(area) : '…'}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-faint" aria-hidden />
        </button>

        <div className="order-2 flex shrink-0 items-center gap-2 lg:order-4">
          <BagButton />
          <AccountButton />
        </div>
      </div>
      {area && <LocationDialog open={locationOpen} onOpenChange={setLocationOpen} area={area} />}
    </header>
  )
}

function BagButton() {
  const count = cartCount(useCart())
  return (
    <Link
      href="/cart"
      aria-label={count ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag'}
      className="relative grid size-10 place-items-center rounded-full text-ink transition hover:bg-canvas"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-surface tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function AccountButton() {
  const session = useSession()
  const [signInOpen, setSignInOpen] = useState(false)

  // Holds the space while the stored session is read, so the header doesn't jump.
  if (session === undefined) return <span className="block size-10 rounded-full bg-canvas" aria-hidden />
  if (session) return <AccountMenu session={session} />
  return (
    <>
      <button
        type="button"
        onClick={() => setSignInOpen(true)}
        aria-label="Sign in"
        className="flex h-10 items-center gap-2 rounded-full bg-ink px-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-strong sm:px-4"
      >
        <UserRound className="size-4" aria-hidden />
        <span className="max-sm:hidden">Sign In</span>
      </button>
      <AuthDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  )
}

function Avatar({ session, className }: { session: Session; className?: string }) {
  const { user } = session
  return user.avatar_url ? (
    // Avatars come from many hosts; next.config has images.unoptimized.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar_url} alt="" className={`rounded-full object-cover ${className ?? ''}`} />
  ) : (
    <span className={`grid place-items-center rounded-full bg-linear-to-br from-brand to-brand-strong font-black text-white ${className ?? ''}`}>
      {initials(user)}
    </span>
  )
}

function AccountMenu({ session }: { session: Session }) {
  const toasts = Toast.useToastManager()
  const { user } = session

  function signOut() {
    endSession()
    toasts.add({ type: 'success', title: 'Signed out', description: 'See you again soon.' })
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account: ${displayName(user)}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-canvas data-[popup-open]:bg-canvas sm:pr-2.5"
      >
        <Avatar session={session} className="size-9 text-sm ring-2 ring-white shadow-card" />
        <span className="max-w-28 truncate text-sm font-bold max-sm:hidden">{displayName(user)}</span>
        <ChevronDown className="size-4 text-ink-faint max-sm:hidden" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="w-64 origin-(--transform-origin) rounded-2xl bg-surface p-1.5 shadow-lift ring-1 ring-line transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <Avatar session={session} className="size-10 shrink-0 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user.full_name || displayName(user)}</p>
                <p className="truncate text-xs text-ink-faint">{user.phone || user.email}</p>
              </div>
            </div>
            <Menu.Separator className="mx-2 my-1 h-px bg-line" />
            <Menu.LinkItem
              render={<Link href="/orders" />}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold outline-none data-[highlighted]:bg-canvas"
            >
              <Package className="size-4" aria-hidden /> My orders
            </Menu.LinkItem>
            <Menu.Item
              onClick={signOut}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-red-700 outline-none data-[highlighted]:bg-red-50"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
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
