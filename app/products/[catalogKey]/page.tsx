import type { Metadata } from 'next'

import { ProductPage } from '@/components/marketplace/product-page'
import { decodeParam } from '@/lib/marketplace'

export const metadata: Metadata = { title: 'Compare stores — TodayZ' }

export default async function Page({ params }: { params: Promise<{ catalogKey: string }> }) {
  const { catalogKey } = await params
  return <ProductPage catalogKey={decodeParam(catalogKey)} />
}
