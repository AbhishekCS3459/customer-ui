'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'

import { type Area, type NearbyStore, type NearbyStoresResult, formatDistance, storeHref } from '@/lib/marketplace'

// OpenStreetMap's own tiles suit development and light use only
// (https://operations.osmfoundation.org/policies/tiles/); set both variables
// to a hosted tile provider for production traffic.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const BRAND = '#17754a'
const SWEEP_MS = 1800
const FIT_PADDING: L.PointTuple = [18, 18]
// react-leaflet re-applies props that change identity on every render, so
// these must be constants: re-applying would undo the sweep's fade.
const RADIUS_STYLE: L.PathOptions = { color: BRAND, weight: 1.5, dashArray: '6 6', fillColor: BRAND, fillOpacity: 0.05 }
const SWEEP_STYLE: L.PathOptions = { color: BRAND, weight: 2, fillColor: BRAND, fillOpacity: 0.14 }

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type StoresMapProps = {
  /** Where the customer is shopping; the map follows it at once. */
  area: Area
  /** The stores on show, which may still be the previous area's while the new ones load. */
  result?: NearbyStoresResult
  /** The store hovered or chosen in the list, highlighted on the map. */
  activeId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

/**
 * The customer's area with every nearby store pinned. When a new set of stores
 * arrives, a ring sweeps out from the customer and drops each pin as it reaches
 * the store's real distance.
 */
export default function StoresMap({ area, result, activeId, onHover, onSelect }: StoresMapProps) {
  const center = useMemo<L.LatLngTuple>(() => [area.lat, area.lng], [area.lat, area.lng])
  const bounds = useMemo(() => L.latLng(center).toBounds(area.radiusM * 2), [center, area.radiusM])
  const [reachedM, setReachedM] = useState(0)
  const stores = result?.stores ?? []

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: FIT_PADDING }}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      className="tz-map h-full w-full bg-canvas"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <FitArea bounds={bounds} />
      <Circle center={center} radius={area.radiusM} interactive={false} pathOptions={RADIUS_STYLE} />
      {result && <Sweep key={`${result.lat},${result.lng},${result.radius_m}`} result={result} onReach={setReachedM} />}
      <Marker position={center} icon={youIcon} interactive={false} keyboard={false} zIndexOffset={-1000} />
      {stores.map((store, i) =>
        store.distance_m <= reachedM ? (
          <StoreMarker
            key={store.id}
            store={store}
            number={i + 1}
            active={store.id === activeId}
            onHover={onHover}
            onSelect={onSelect}
          />
        ) : null,
      )}
    </MapContainer>
  )
}

/** MapContainer's props only apply on mount, so later areas are fitted here. */
function FitArea({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap()
  useEffect(() => {
    map.flyToBounds(bounds, { padding: FIT_PADDING, duration: 0.8, animate: !prefersReducedMotion() })
  }, [map, bounds])
  return null
}

/**
 * The ring that sweeps out to result's radius. onReach gets how far it has
 * reached, only when that uncovers another store, then Infinity once done.
 */
function Sweep({ result, onReach }: { result: NearbyStoresResult; onReach: (metres: number) => void }) {
  const ring = useRef<L.Circle>(null)
  const center = useMemo<L.LatLngTuple>(() => [result.lat, result.lng], [result.lat, result.lng])

  const reach = useEffectEvent((metres: number, done: boolean) => {
    if (done) {
      onReach(Infinity)
      return
    }
    onReach(result.stores.reduce((reached, s) => (s.distance_m <= metres ? Math.max(reached, s.distance_m) : reached), 0))
  })

  useEffect(() => {
    const circle = ring.current
    if (!circle) return
    if (prefersReducedMotion()) {
      circle.setStyle({ opacity: 0, fillOpacity: 0 })
      reach(Infinity, true)
      return
    }
    reach(0, false)
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / SWEEP_MS, 1)
      const eased = 1 - (1 - t) ** 3
      circle.setRadius(Math.max(result.radius_m * eased, 1))
      circle.setStyle({ opacity: 0.7 * (1 - t), fillOpacity: 0.14 * (1 - t) })
      reach(result.radius_m * eased, t === 1)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [result])

  return (
    <Circle ref={ring} center={center} radius={1} interactive={false} pathOptions={SWEEP_STYLE} />
  )
}

const youIcon = L.divIcon({
  className: 'tz-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `<div class="relative size-5" aria-hidden="true">
    <span class="absolute inset-0 rounded-full bg-accent animate-locate-pulse"></span>
    <span class="absolute inset-0 rounded-full bg-accent animate-locate-pulse [animation-delay:1.2s]"></span>
    <span class="absolute inset-0 rounded-full border-[3px] border-white bg-accent shadow-lift"></span>
  </div>`,
})

/** A teardrop pin numbered like the store's card. Open stores are green, closed grey. */
function pinIcon(number: number, open: boolean): L.DivIcon {
  return L.divIcon({
    className: 'tz-marker group',
    iconSize: [32, 32],
    iconAnchor: [16, 39],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -38],
    html: `<div class="animate-pin-drop">
      <div class="origin-[50%_120%] transition-transform duration-200 group-[.is-active]:scale-125">
        <div class="grid size-8 -rotate-45 place-items-center rounded-[50%_50%_50%_0] border-2 border-white shadow-lift ${open ? 'bg-brand' : 'bg-zinc-400'}">
          <span class="rotate-45 text-xs font-black text-white">${number}</span>
        </div>
      </div>
    </div>`,
  })
}

function StoreMarker({
  store,
  number,
  active,
  onHover,
  onSelect,
}: {
  store: NearbyStore
  number: number
  active: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const marker = useRef<L.Marker>(null)
  const position = useMemo<L.LatLngTuple>(() => [store.lat, store.lng], [store.lat, store.lng])
  const icon = useMemo(() => pinIcon(number, store.is_open), [number, store.is_open])

  const onClick = useEffectEvent(() => onSelect(store.id))
  const onOver = useEffectEvent(() => onHover(store.id))
  const onOut = useEffectEvent(() => onHover(null))
  const eventHandlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({ click: () => onClick(), mouseover: () => onOver(), mouseout: () => onOut() }),
    [],
  )

  // Swapping the icon would replace its element and replay the drop, so the
  // highlight is a class on the existing one. The label is set here, not in
  // the icon's HTML, so a store's name is never parsed as markup.
  const label = `${number}. ${store.name}, ${formatDistance(store.distance_m)} away${store.is_open ? '' : ', closed'}`
  useEffect(() => {
    const el = marker.current?.getElement()
    el?.classList.toggle('is-active', active)
    el?.setAttribute('aria-label', label)
  }, [active, icon, label])

  return (
    <Marker
      ref={marker}
      position={position}
      icon={icon}
      zIndexOffset={active ? 1000 : 0}
      title={store.name}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" opacity={1}>
        <span className="font-semibold">{store.name}</span> · {formatDistance(store.distance_m)}
      </Tooltip>
      {/* Divs, not paragraphs: Leaflet's unlayered popup paragraph margins beat Tailwind's utilities. */}
      <Popup>
        <div className="min-w-48">
          <div className="text-sm font-bold text-ink">{store.name}</div>
          <div className="mt-0.5 text-xs text-ink-soft">
            {[store.category, `${formatDistance(store.distance_m)} away`].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-2 text-xs font-semibold">
            {store.is_open ? (
              <span className="text-emerald-700">
                Open · {store.available_count} of {store.product_count} in stock
              </span>
            ) : (
              <span className="text-zinc-500">Closed right now</span>
            )}
          </div>
          <Link href={storeHref(store.id)} className="mt-3 inline-block text-sm font-semibold text-brand! hover:underline">
            View store →
          </Link>
        </div>
      </Popup>
    </Marker>
  )
}
