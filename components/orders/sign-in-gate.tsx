'use client'

import { type ReactNode, useState } from 'react'
import { Package } from 'lucide-react'

import { AuthDialog } from '@/components/marketplace/auth-dialog'
import { Notice, Spinner } from '@/components/marketplace/shared'
import { useSession } from '@/hooks/use-session'
import type { Session } from '@/lib/auth'

/** Renders children with the signed-in session, or asks the customer to sign in. */
export function SignInGate({ children }: { children: (session: Session) => ReactNode }) {
  const session = useSession()
  const [open, setOpen] = useState(false)
  if (session === undefined) return <Spinner />
  if (session) return children(session)
  return (
    <>
      <Notice title="Sign in to see your orders" icon={<Package className="size-6" aria-hidden />}>
        <p>Your orders and pickup codes are kept with your account.</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-full bg-ink px-4 py-2 font-semibold text-white">
          Sign in
        </button>
      </Notice>
      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
