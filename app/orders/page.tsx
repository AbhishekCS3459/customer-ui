import type { Metadata } from 'next'

import { OrdersPage } from '@/components/orders/orders-page'

export const metadata: Metadata = { title: 'My orders — TodayZ', robots: { index: false } }

export default function Page() {
  return <OrdersPage />
}
