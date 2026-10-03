'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import Link from 'next/link'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvent } from 'react-leaflet'
import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'

import { type Area, type NearbyStore, type NearbyStoresResult, formatDistance, storeHref } from '@/lib/marketplace'

// OpenStreetMap's own tiles suit development and light use only
// (https://operations.osmfoundation.org/policies/tiles/); set both variables
// to a hosted tile provider for production traffic.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const BRAND = '#17754a'
const CLOSED = '#a1a1aa'
const SWEEP_MS = 1800
const FIT_PADDING: L.PointTuple = [18, 18]
const MAX_ZOOM = 19
// Pins closer than this many pixels merge into a group; a pin is 32px wide.
const CLUSTER_RADIUS_PX = 60
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
 * the store's real distance. Pins that would overlap at the current zoom are
 * grouped into one bubble that zooms in to split them apart.
 */
export default function StoresMap({ area, result, activeId, onHover, onSelect }: StoresMapProps) {
  const center = useMemo<L.LatLngTuple>(() => [area.lat, area.lng], [area.lat, area.lng])
  const bounds = useMemo(() => L.latLng(center).toBounds(area.radiusM * 2), [center, area.radiusM])
  const [reachedM, setReachedM] = useState(0)

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: FIT_PADDING }}
      zoomSnap={0.25}
      maxZoom={MAX_ZOOM}
      scrollWheelZoom={false}
      className="tz-map h-full w-full bg-canvas"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={MAX_ZOOM} />
      <FitArea bounds={bounds} />
      <Circle center={center} radius={area.radiusM} interactive={false} pathOptions={RADIUS_STYLE} />
      {result && <Sweep key={`${result.lat},${result.lng},${result.radius_m}`} result={result} onReach={setReachedM} />}
      <Marker position={center} icon={youIcon} interactive={false} keyboard={false} zIndexOffset={-1000} />
      <StoreMarkers stores={result?.stores} reachedM={reachedM} activeId={activeId} onHover={onHover} onSelect={onSelect} />
    </MapContainer>
  )
}

type StorePoint = { store: NearbyStore; number: number }
type GroupStats = { open: number; nearestM: number }
type StoreIndex = Supercluster<StorePoint, GroupStats>
type MapView = { bbox: [number, number, number, number]; zoom: number }

function storeIndex(stores: NearbyStore[]): StoreIndex {
  const index: StoreIndex = new Supercluster<StorePoint, GroupStats>({
    radius: CLUSTER_RADIUS_PX,
    // Supercluster measures the radius against 512px tiles by default; Leaflet's are 256px.
    extent: 256,
    maxZoom: MAX_ZOOM,
    map: ({ store }) => ({ open: store.is_open ? 1 : 0, nearestM: store.distance_m }),
    reduce: (group, other) => {
      group.open += other.open
      group.nearestM = Math.min(group.nearestM, other.nearestM)
    },
  })
  return index.load(
    stores.map((store, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [store.lng, store.lat] },
      properties: { store, number: i + 1 },
    })),
  )
}

/** What's on screen, with a margin so pins don't pop in at the edges while panning. */
function viewOf(map: L.Map): MapView {
  const b = map.getBounds().pad(0.25)
  return {
    bbox: [Math.max(b.getWest(), -180), Math.max(b.getSouth(), -90), Math.min(b.getEast(), 180), Math.min(b.getNorth(), 90)],
    // Supercluster works in whole zoom levels; rounding down keeps groups from overlapping between them.
    zoom: Math.floor(map.getZoom()),
  }
}

function isGroup(feature: ClusterFeature<GroupStats> | PointFeature<StorePoint>): feature is ClusterFeature<GroupStats> {
  return 'cluster' in feature.properties && feature.properties.cluster === true
}

/** The stores, regrouped every time the map stops moving. */
function StoreMarkers({
  stores,
  reachedM,
  activeId,
  onHover,
  onSelect,
}: {
  stores?: NearbyStore[]
  reachedM: number
  activeId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const map = useMap()
  const [view, setView] = useState(() => viewOf(map))
  const onMoveEnd = useCallback(() => setView(viewOf(map)), [map])
  useMapEvent('moveend', onMoveEnd)
  const index = useMemo(() => storeIndex(stores ?? []), [stores])
  const features = useMemo(() => index.getClusters(view.bbox, view.zoom), [index, view])

  // A store highlighted from its card may be inside a group; light up the group instead.
  const activeGroupId = useMemo(() => {
    if (!activeId) return null
    for (const f of features) {
      if (isGroup(f) && index.getLeaves(f.properties.cluster_id, Infinity).some((leaf) => leaf.properties.store.id === activeId)) {
        return f.properties.cluster_id
      }
    }
    return null
  }, [activeId, features, index])

  return features.map((f) => {
    if (isGroup(f)) {
      return f.properties.nearestM <= reachedM ? (
        <GroupMarker key={`group-${f.properties.cluster_id}`} group={f} index={index} active={f.properties.cluster_id === activeGroupId} />
      ) : null
    }
    const { store, number } = f.properties
    return store.distance_m <= reachedM ? (
      <StoreMarker key={store.id} store={store} number={number} active={store.id === activeId} onHover={onHover} onSelect={onSelect} />
    ) : null
  })
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

/** A count bubble for a group of stores; its ring is green for the share that's open and grey for the rest. */
function groupIcon(count: number, open: number): L.DivIcon {
  const size = count < 10 ? 40 : count < 25 ? 46 : 54
  const openDeg = Math.round((open / count) * 360)
  return L.divIcon({
    className: 'tz-marker group',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2],
    html: `<div class="animate-pin-drop">
      <div class="relative transition-transform duration-200 group-[.is-active]:scale-125" style="width:${size}px;height:${size}px">
        <span class="absolute -inset-1.5 rounded-full ${open > 0 ? 'bg-brand/15' : 'bg-zinc-400/20'}"></span>
        <span class="relative grid size-full place-items-center rounded-full p-1 shadow-lift ring-2 ring-white" style="background:conic-gradient(${BRAND} ${openDeg}deg, ${CLOSED} 0)">
          <span class="grid size-full place-items-center rounded-full bg-white text-sm font-black text-ink tabular-nums">${count > 99 ? '99+' : count}</span>
        </span>
      </div>
    </div>`,
  })
}

/**
 * Stores too close together to pin separately at this zoom. Choosing the group
 * zooms in until they split apart; stores at practically the same spot never
 * split, so their group lists them instead.
 */
function GroupMarker({ group, index, active }: { group: ClusterFeature<GroupStats>; index: StoreIndex; active: boolean }) {
  const map = useMap()
  const marker = useRef<L.Marker>(null)
  const { cluster_id: id, point_count: count, open, nearestM } = group.properties
  const [lng, lat] = group.geometry.coordinates
  const position = useMemo<L.LatLngTuple>(() => [lat, lng], [lat, lng])
  const icon = useMemo(() => groupIcon(count, open), [count, open])
  const splitsAt = useMemo(() => index.getClusterExpansionZoom(id), [index, id])
  const members = useMemo(
    () => index.getLeaves(id, Infinity).map((leaf) => leaf.properties).sort((a, b) => a.number - b.number),
    [index, id],
  )
  const listed = splitsAt > MAX_ZOOM

  const onClick = useEffectEvent(() => {
    if (!listed) map.flyTo(position, splitsAt, { duration: 0.6, animate: !prefersReducedMotion() })
  })
  const eventHandlers = useMemo<L.LeafletEventHandlerFnMap>(() => ({ click: () => onClick() }), [])

  const label = `${count} stores, ${open} open, nearest ${formatDistance(nearestM)} away. ${listed ? 'Show them' : 'Zoom in to see them'}`
  useEffect(() => {
    const el = marker.current?.getElement()
    el?.classList.toggle('is-active', active)
    el?.setAttribute('aria-label', label)
  }, [active, icon, label])

  return (
    <Marker ref={marker} position={position} icon={icon} zIndexOffset={active ? 1000 : 0} eventHandlers={eventHandlers}>
      <Tooltip direction="top" opacity={1}>
        <span className="font-semibold">{count} stores</span> · {open} open · {listed ? 'tap to list' : 'tap to zoom'}
      </Tooltip>
      {listed && (
        <Popup>
          <div className="min-w-52">
            <div className="text-sm font-bold text-ink">{count} stores here</div>
            <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              {members.map(({ store, number }) => (
                <li key={store.id}>
                  <Link href={storeHref(store.id)} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-ink! hover:bg-canvas">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${store.is_open ? 'bg-brand' : 'bg-zinc-400'}`}
                    >
                      {number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{store.name}</span>
                    <span className="text-[11px] text-ink-faint tabular-nums">{formatDistance(store.distance_m)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Popup>
      )}
    </Marker>
  )
}
