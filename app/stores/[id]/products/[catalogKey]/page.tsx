import type { Metadata } from 'next'

import { StoreProductPage } from '@/components/marketplace/store-product-page'
import { decodeParam } from '@/lib/marketplace'

export const metadata: Metadata = { title: 'Product at store — TodayZ' }

export default async function Page({ params }: { params: Promise<{ id: string; catalogKey: string }> }) {
  const { id, catalogKey } = await params
  return <StoreProductPage storeId={id} catalogKey={decodeParam(catalogKey)} />
}
