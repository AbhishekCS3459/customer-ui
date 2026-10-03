import { API_URL, ApiError, apiError, unreachable } from './marketplace'

export type Customer = {
  id: string
  email: string
  phone: string
  full_name: string
  avatar_url: string
}

export type Session = { token: string; user: Customer }

export const SESSION_KEY = 'todayz.session'
/** Treat a token as expired slightly early so no request leaves with one about to lapse. */
const EXPIRY_LEEWAY_MS = 30_000
export const MIN_PASSWORD_LENGTH = 8

async function send<T>(method: 'POST' | 'PATCH', path: string, body: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw unreachable()
  }
  if (!res.ok) throw await apiError(res)
  return (await res.json()) as T
}

/**
 * The ten digits of an Indian mobile number from what a customer typed or
 * pasted, dropping a leading +91 or 0; at most ten digits otherwise.
 */
export function mobileDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

export function validMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits)
}

/** The form the backend matches phone sign-ins against. */
function e164(digits: string): string {
  return `+91${digits}`
}

function toSession(token: string, user: Partial<Customer> & { id: string }): Session {
  return {
    token,
    user: {
      id: user.id,
      email: user.email ?? '',
      phone: user.phone ?? '',
      full_name: user.full_name ?? '',
      avatar_url: user.avatar_url ?? '',
    },
  }
}

export type Credentials = { mobile: string } | { email: string }

export async function signIn(credentials: Credentials, password: string): Promise<Session> {
  const identity = 'mobile' in credentials ? { phone: e164(credentials.mobile) } : { email: credentials.email.trim() }
  try {
    const res = await send<{ token: string; user: Customer }>('POST', '/api/auth/login', { ...identity, password })
    if (!res.token) throw new ApiError(500, 'Sign-in did not return a session. Please try again.')
    return toSession(res.token, res.user)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new ApiError(401, `That ${'mobile' in credentials ? 'mobile number' : 'email'} and password don't match an account.`)
    }
    throw err
  }
}

export type NewAccount = { fullName: string; mobile: string; email: string; password: string }

export async function signUp(account: NewAccount): Promise<Session> {
  try {
    await send('POST', '/api/auth/register', { email: account.email.trim(), phone: e164(account.mobile), password: account.password })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new ApiError(409, 'An account with this email or mobile number already exists. Sign in instead.')
    }
    throw err
  }
  const session = await signIn({ email: account.email }, account.password)
  const fullName = account.fullName.trim()
  if (!fullName) return session
  try {
    await send('PATCH', '/api/users/me', { full_name: fullName }, session.token)
    return { ...session, user: { ...session.user, full_name: fullName } }
  } catch {
    // The account exists and is signed in; the name can be added later.
    return session
  }
}

function expiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/** A stored session, or null when there's none, it's malformed, or its token has expired. */
export function parseSession(raw: string | null): Session | null {
  try {
    const s = JSON.parse(raw ?? 'null') as Partial<Session> | null
    if (!s || typeof s.token !== 'string' || !s.user || typeof s.user.id !== 'string') return null
    const expiry = expiresAt(s.token)
    if (expiry !== null && expiry - EXPIRY_LEEWAY_MS <= Date.now()) return null
    return toSession(s.token, s.user)
  } catch {
    return null
  }
}

/** What to call the customer: their first name, else their email's name, else their number. */
export function displayName(user: Customer): string {
  return user.full_name.trim().split(/\s+/)[0] || user.email.split('@')[0] || user.phone
}

export function initials(user: Customer): string {
  const parts = user.full_name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 0) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  return (user.email[0] ?? '?').toUpperCase()
}
