import type { Metadata } from 'next'

import { CartPage } from '@/components/orders/cart-page'

export const metadata: Metadata = { title: 'Your bag — TodayZ', robots: { index: false } }

export default function Page() {
  return <CartPage />
}
