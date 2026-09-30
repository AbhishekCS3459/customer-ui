import { Suspense } from 'react'

import { PageShell } from '@/components/marketplace/app-shell'
import { HomePage } from '@/components/marketplace/home-page'
import { ProductGridSkeleton } from '@/components/marketplace/shared'

export default function Page() {
  // HomePage reads the URL's search params, so it renders on the client
  // beneath this boundary while the fallback is prerendered.
  return (
    <Suspense
      fallback={
        <PageShell>
          <ProductGridSkeleton />
        </PageShell>
      }
    >
      <HomePage />
    </Suspense>
  )
}
