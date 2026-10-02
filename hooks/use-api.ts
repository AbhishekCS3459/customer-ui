'use client'

import { useEffect, useState } from 'react'

import { ApiError, apiGet } from '@/lib/marketplace'

type Response<T> = { key: string; path: string; data?: T; error?: ApiError }

export type ApiState<T> = {
  data?: T
  error?: ApiError
  loading: boolean
  /** Loading the same path again because only the nonce changed, e.g. a refresh. */
  refreshing: boolean
  /** While loading, the previous request's data, e.g. to keep old results on screen. */
  previous?: T
}

/**
 * Fetches path from the marketplace API whenever path (or nonce) changes and
 * aborts the previous request. A null path fetches nothing. Loading is derived
 * from whether the latest response belongs to the current request, so a slow
 * earlier response can never overwrite a newer one. A failed refresh keeps the
 * data it was refreshing, alongside the error, unless the resource is gone.
 */
export function useApi<T>(path: string | null, nonce = 0): ApiState<T> {
  const key = path === null ? null : `${nonce}:${path}`
  const [response, setResponse] = useState<Response<T> | null>(null)

  useEffect(() => {
    if (key === null || path === null) return
    const controller = new AbortController()
    apiGet<T>(path, controller.signal).then(
      (data) => setResponse({ key, path, data }),
      (err: unknown) => {
        if (controller.signal.aborted) return
        const error = err instanceof ApiError ? err : new ApiError(0, 'Something went wrong; try again.')
        setResponse((prev) => ({ key, path, error, data: prev?.path === path && error.status !== 404 ? prev.data : undefined }))
      },
    )
    return () => controller.abort()
  }, [key, path])

  if (key === null) return { loading: false, refreshing: false }
  if (response?.key !== key) return { loading: true, refreshing: response?.path === path, previous: response?.data }
  return { data: response.data, error: response.error, loading: false, refreshing: false }
}
