'use client'

import { type FormEvent, type ReactNode, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Tabs } from '@base-ui/react/tabs'
import { Toast } from '@base-ui/react/toast'
import { ArrowRight, Eye, EyeOff, Loader2, X } from 'lucide-react'

import { saveSession } from '@/hooks/use-session'
import { MIN_PASSWORD_LENGTH, type Session, displayName, mobileDigits, signIn, signUp, validMobile } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[3px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed bottom-0 left-1/2 z-50 max-h-[92dvh] w-full max-w-md -translate-x-1/2 overflow-y-auto rounded-t-[2rem] bg-surface shadow-lift transition duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-[2rem] sm:data-[ending-style]:translate-y-[-48%] sm:data-[starting-style]:translate-y-[-48%]">
          {/* Mounted only while open, so every visit starts on a clean form. */}
          <AuthForms onDone={() => onOpenChange(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const tabClass =
  'relative z-10 h-10 rounded-xl text-sm font-bold text-ink-soft transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand data-active:text-ink'

function AuthForms({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const toasts = Toast.useToastManager()

  function finish(session: Session, created: boolean) {
    saveSession(session)
    toasts.add({
      type: 'success',
      title: created ? `Welcome to TodayZ, ${displayName(session.user)}!` : `Welcome back, ${displayName(session.user)}`,
      description: created ? 'Your account is ready.' : "You're signed in.",
    })
    onDone()
  }

  return (
    <>
      <div className="relative overflow-hidden bg-linear-to-br from-brand-soft via-[#eef6f0] to-surface px-6 pt-6 pb-5 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-brand)_1px,transparent_1px)] [background-size:12px_12px] opacity-[0.12]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <span className="text-xl font-black tracking-tight text-ink">
              Today<span className="text-brand">Z</span>
            </span>
            <Dialog.Title className="mt-3 text-2xl font-black tracking-tight">
              {mode === 'signin' ? 'Welcome back' : 'Join TodayZ'}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">
              {mode === 'signin' ? 'Sign in to keep shopping nearby.' : 'Find what you need in stores around you.'}
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface/80 text-ink-soft ring-1 ring-line backdrop-blur-sm ring-inset hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
      </div>

      <Tabs.Root value={mode} onValueChange={(value) => setMode(value as Mode)} className="px-6 pt-5 pb-6 sm:px-8 sm:pb-8">
        <Tabs.List className="relative grid grid-cols-2 rounded-2xl bg-canvas p-1 ring-1 ring-line ring-inset">
          <Tabs.Tab value="signin" className={tabClass}>
            Sign In
          </Tabs.Tab>
          <Tabs.Tab value="signup" className={tabClass}>
            Create Account
          </Tabs.Tab>
          <Tabs.Indicator className="absolute top-1/2 left-0 z-0 h-10 w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-1/2 rounded-xl bg-surface shadow-card transition-[translate,width] duration-200 ease-out" />
        </Tabs.List>
        <Tabs.Panel value="signin" className="pt-5 outline-none">
          <SignInForm onSignedIn={(s) => finish(s, false)} />
        </Tabs.Panel>
        <Tabs.Panel value="signup" className="pt-5 outline-none">
          <SignUpForm onSignedUp={(s) => finish(s, true)} />
        </Tabs.Panel>
        <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-faint">
          By continuing you agree to TodayZ&apos;s Terms of Service and Privacy Policy.
        </p>
      </Tabs.Root>
    </>
  )
}

const inputClass =
  'h-12 w-full min-w-0 rounded-2xl bg-canvas px-4 text-sm font-medium text-ink ring-1 ring-line outline-none ring-inset transition placeholder:font-normal placeholder:text-ink-faint focus:bg-surface focus:ring-2 focus:ring-brand'

function Field({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-soft">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function MobileInput({ value, onChange, autoFocus }: { value: string; onChange: (digits: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex h-12 items-center overflow-hidden rounded-2xl bg-canvas ring-1 ring-line ring-inset transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand">
      <span className="flex h-full items-center border-r border-line pr-3 pl-4 text-sm font-bold text-ink" aria-hidden>
        +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        aria-label="Mobile number"
        placeholder="98765 43210"
        value={value}
        onChange={(e) => onChange(mobileDigits(e.target.value))}
        autoFocus={autoFocus}
        required
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold tracking-wide text-ink outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-faint"
      />
    </div>
  )
}

function PasswordInput({ name, autoComplete, placeholder }: { name: string; autoComplete: string; placeholder: string }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : undefined}
        required
        className={cn(inputClass, 'pr-12')}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint hover:text-ink"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgb(23_117_74/0.7)] transition hover:bg-brand-strong disabled:opacity-60"
    >
      {children}
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      )}
    </button>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset">
      {message}
    </p>
  )
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

function SignInForm({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [useEmail, setUseEmail] = useState(false)
  const [mobile, setMobile] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    if (!useEmail && !validMobile(mobile)) {
      setError('Enter your 10-digit mobile number.')
      return
    }
    setPending(true)
    setError(null)
    try {
      onSignedIn(await signIn(useEmail ? { email: String(form.get('email') ?? '') } : { mobile }, password))
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  const switchMethod = (
    <button
      type="button"
      onClick={() => {
        setUseEmail((u) => !u)
        setError(null)
      }}
      className="text-xs font-bold text-brand hover:underline"
    >
      {useEmail ? 'Use mobile instead' : 'Use email instead'}
    </button>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {useEmail ? (
        <Field label="Email" action={switchMethod}>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required autoFocus className={inputClass} />
        </Field>
      ) : (
        <Field label="Mobile number" action={switchMethod}>
          <MobileInput value={mobile} onChange={setMobile} autoFocus />
        </Field>
      )}
      <Field label="Password">
        <PasswordInput name="password" autoComplete="current-password" placeholder="Your password" />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  )
}

function SignUpForm({ onSignedUp }: { onSignedUp: (session: Session) => void }) {
  const [mobile, setMobile] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!validMobile(mobile)) {
      setError('Enter a 10-digit Indian mobile number.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const fullName = [form.get('first_name'), form.get('last_name')].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ')
      onSignedUp(
        await signUp({ fullName, mobile, email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') }),
      )
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <input name="first_name" autoComplete="given-name" placeholder="Aarav" required autoFocus className={inputClass} />
        </Field>
        <Field label="Last name">
          <input name="last_name" autoComplete="family-name" placeholder="Sharma" className={inputClass} />
        </Field>
      </div>
      <Field label="Mobile number">
        <MobileInput value={mobile} onChange={setMobile} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required className={inputClass} />
      </Field>
      <Field label="Password">
        <PasswordInput name="password" autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  )
}
