'use client'

import { useEffect, useEffectEvent, useState } from 'react'

import { serverNow } from '@/lib/orders'

/**
 * Milliseconds left until deadline (never negative) by the server's clock,
 * updated every second; null without a deadline. onElapsed runs once when it
 * reaches zero, e.g. to fetch what the server did at the deadline.
 */
export function useCountdown(deadline: string | null | undefined, onElapsed?: () => void): number | null {
  const target = deadline ? Date.parse(deadline) : NaN
  const [now, setNow] = useState(serverNow)
  const elapsed = useEffectEvent(() => onElapsed?.())

  useEffect(() => {
    if (!Number.isFinite(target)) return
    let fired = false
    const tick = () => {
      const t = serverNow()
      setNow(t)
      if (!fired && t >= target) {
        fired = true
        elapsed()
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [target])

  return Number.isFinite(target) ? Math.max(0, target - now) : null
}

/** "9:05" or "1:59:30". */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
