import type { Metadata } from 'next'

import { OrderPage } from '@/components/orders/order-page'

export const metadata: Metadata = { title: 'Order — TodayZ', robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderPage orderId={id} />
}
