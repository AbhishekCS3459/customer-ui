'use client'

import type { ReactNode } from 'react'
import { Check, Hourglass, KeyRound } from 'lucide-react'

import { formatCountdown, useCountdown } from '@/hooks/use-countdown'
import { formatDateTime } from '@/lib/marketplace'
import { type Order, type OrderEvent, type OrderItem, type OrderStatus, STATUS_INFO, type Tone, formatPaise } from '@/lib/orders'
import { cn } from '@/lib/utils'

const toneClass: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-strong ring-brand/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200/80',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  red: 'bg-red-50 text-red-700 ring-red-200/80',
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const info = STATUS_INFO[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        toneClass[info.tone],
        className,
      )}
    >
      {info.label}
    </span>
  )
}

/** What the current deadline means to the customer, per status. */
const deadlineCopy: Partial<Record<OrderStatus, { title: string; detail: string; urgentBelowMs: number }>> = {
  PENDING_PAYMENT: {
    title: 'Pay within',
    detail: 'Your items are held for you until then. After that they go back on the shelf.',
    urgentBelowMs: 2 * 60_000,
  },
  PLACED: {
    title: 'The store has',
    detail: "to accept your order. If it doesn't, the order is cancelled and any payment is refunded.",
    urgentBelowMs: 3 * 60_000,
  },
  READY: {
    title: 'Collect within',
    detail: 'Show your pickup code at the counter. Uncollected orders are cancelled.',
    urgentBelowMs: 15 * 60_000,
  },
}

/** A live countdown to the order's current deadline, or nothing when it has none. */
export function DeadlineBanner({ order, onElapsed }: { order: Order; onElapsed: () => void }) {
  const left = useCountdown(order.expires_at, onElapsed)
  const copy = deadlineCopy[order.status]
  if (left === null || !copy) return null
  const urgent = left <= copy.urgentBelowMs
  const done = left === 0
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${copy.title} ${formatCountdown(left)}`}
      className={cn(
        'flex items-center gap-4 rounded-3xl p-4 ring-1 ring-inset sm:p-5',
        urgent ? 'bg-amber-50 ring-amber-200' : 'bg-brand-soft ring-brand/15',
      )}
    >
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl',
          urgent ? 'bg-amber-100 text-amber-700' : 'bg-surface text-brand',
        )}
      >
        <Hourglass className={cn('size-6', !done && 'motion-safe:animate-pulse')} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', urgent ? 'text-amber-800' : 'text-brand-strong')}>
          {done ? 'Time is up — checking with the store…' : copy.title}
        </p>
        {!done && (
          <p className={cn('text-3xl font-black tracking-tight tabular-nums sm:text-4xl', urgent ? 'text-amber-900' : 'text-ink')}>
            {formatCountdown(left)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-ink-soft">{copy.detail}</p>
      </div>
    </div>
  )
}

/** Small inline countdown, e.g. in a list. */
export function InlineCountdown({ deadline, onElapsed }: { deadline: string | null; onElapsed?: () => void }) {
  const left = useCountdown(deadline, onElapsed)
  if (left === null) return null
  return <span className="font-semibold tabular-nums">{left === 0 ? 'now' : formatCountdown(left)}</span>
}

export function PickupCode({ code, status }: { code: string; status: OrderStatus }) {
  return (
    <div className="rounded-3xl border border-dashed border-brand/40 bg-surface p-5 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
        <KeyRound className="size-3.5" aria-hidden /> Pickup code
      </p>
      <p className="mt-2 font-mono text-4xl font-black tracking-[0.3em] text-ink tabular-nums sm:text-5xl" aria-label={`Pickup code ${code.split('').join(' ')}`}>
        {code}
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        {status === 'READY' ? 'Tell this code at the counter to collect your order.' : "You'll need this at the counter. Don't share it with anyone else."}
      </p>
    </div>
  )
}

export function OrderItems({ items, total }: { items: OrderItem[]; total: number }) {
  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-ink-faint">
                {[item.unit, `${item.quantity} × ${formatPaise(item.unit_price_paise)}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{formatPaise(item.line_total_paise)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-3 text-base font-black">
        <span>Total</span>
        <span className="tabular-nums">{formatPaise(total)}</span>
      </div>
    </div>
  )
}

/** The steps a pickup order goes through, with the current one highlighted. */
const steps: { status: OrderStatus; label: string }[] = [
  { status: 'PLACED', label: 'Placed' },
  { status: 'ACCEPTED', label: 'Accepted' },
  { status: 'READY', label: 'Ready' },
  { status: 'COMPLETED', label: 'Collected' },
]

export function Progress({ status }: { status: OrderStatus }) {
  const reached = status === 'PENDING_PAYMENT' ? -1 : steps.findIndex((s) => s.status === status)
  if (reached === -1 && status !== 'PENDING_PAYMENT') return null
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {steps.map((step, i) => {
        const done = i <= reached
        return (
          <li key={step.status} className="flex flex-col gap-2" aria-current={i === reached ? 'step' : undefined}>
            <span className={cn('h-1.5 rounded-full', done ? 'bg-brand' : 'bg-line')} />
            <span className={cn('flex items-center gap-1 text-xs font-semibold', done ? 'text-ink' : 'text-ink-faint')}>
              {done && <Check className="size-3.5 text-brand" aria-hidden />}
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const actorLabel: Record<string, string> = { CUSTOMER: 'You', RETAILER: 'Store', SYSTEM: 'Automatic', PAYMENT: 'Payment' }

export function Timeline({ events }: { events: OrderEvent[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand ring-4 ring-surface" aria-hidden />
          <p className="text-sm font-semibold">{STATUS_INFO[e.to].label}</p>
          <p className="text-xs text-ink-faint">
            {actorLabel[e.actor] ?? e.actor} · {formatDateTime(e.at)}
          </p>
          {e.reason && <p className="mt-0.5 text-xs text-ink-soft">{e.reason}</p>}
        </li>
      ))}
    </ol>
  )
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-6', className)}>
      {title && <h2 className="mb-3 text-base font-bold">{title}</h2>}
      {children}
    </section>
  )
}
