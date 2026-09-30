import type { Metadata } from 'next'

import { StorePage } from '@/components/marketplace/store-page'

export const metadata: Metadata = { title: 'Store — TodayZ' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StorePage storeId={id} />
}
