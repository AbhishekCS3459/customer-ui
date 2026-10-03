'use client'

import type { ReactNode } from 'react'
import { Toast } from '@base-ui/react/toast'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Lets any client component call Toast.useToastManager().add({ title, description, type: 'success' | 'error' }). */
export function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 left-1/2 z-[60] w-[calc(100vw-2rem)] -translate-x-1/2 sm:bottom-6 sm:w-[24rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

// Stacking, swipe and enter/exit transitions follow Base UI's stacked toast example.
const toastClassName =
  "[--gap:0.75rem] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] absolute right-0 bottom-0 left-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-2xl bg-ink text-white shadow-lift select-none after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-ending-style:opacity-0 data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-limited:opacity-0 data-starting-style:[transform:translateY(150%)] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)] data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] h-[var(--height)] data-expanded:h-[var(--toast-height)] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s] motion-reduce:[transition:opacity_0.2s]"

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => {
    const failed = toast.type === 'error'
    const Icon = failed ? AlertCircle : CheckCircle2
    return (
      <Toast.Root key={toast.id} toast={toast} swipeDirection={['down', 'right']} className={toastClassName}>
        <Toast.Content className="flex items-center gap-3 overflow-hidden p-3 pr-2 transition-opacity duration-250 data-behind:opacity-0 data-expanded:opacity-100">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', failed ? 'bg-red-500/20 text-red-300' : 'bg-brand/30 text-emerald-300')}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-bold" />
            <Toast.Description className="text-xs text-white/70" />
          </div>
          <Toast.Close className="grid size-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Dismiss">
            <X className="size-4" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    )
  })
}
