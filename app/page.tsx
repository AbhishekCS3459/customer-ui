'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Menu, MapPin, Search, ShoppingCart, SlidersHorizontal, Star, UserRound, X } from 'lucide-react'

type Product = { id: number; name: string; category: string; price: number; oldPrice?: number; rating: number; reviews: number; image: string; badge?: string }

const categories = ['All', 'Electronics', 'Home & Kitchen', 'Fashion', 'Beauty', 'Grocery', 'Toys', 'Sports', 'Books']
const products: Product[] = [
  { id: 1, name: 'Wireless Noise Cancelling Headphones', category: 'Electronics', price: 2499, oldPrice: 4999, rating: 4.6, reviews: 1284, badge: 'Best seller', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85' },
  { id: 2, name: 'Minimal Ceramic Table Lamp', category: 'Home & Kitchen', price: 1299, oldPrice: 2199, rating: 4.4, reviews: 436, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=85' },
  { id: 3, name: 'Everyday Cotton Oversized Shirt', category: 'Fashion', price: 799, oldPrice: 1499, rating: 4.3, reviews: 892, badge: 'Limited deal', image: 'https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=700&q=85' },
  { id: 4, name: 'Smart Fitness Watch with AMOLED Display', category: 'Electronics', price: 1899, oldPrice: 3999, rating: 4.5, reviews: 2108, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85' },
  { id: 5, name: 'Handwoven Storage Basket Set', category: 'Home & Kitchen', price: 999, oldPrice: 1699, rating: 4.7, reviews: 304, image: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=700&q=85' },
  { id: 6, name: 'Running Shoes for Men and Women', category: 'Sports', price: 1599, oldPrice: 2999, rating: 4.2, reviews: 743, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85' },
  { id: 7, name: 'Hydrating Skincare Essentials Kit', category: 'Beauty', price: 649, oldPrice: 999, rating: 4.5, reviews: 522, image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=700&q=85' },
  { id: 8, name: 'Stainless Steel Kitchen Organizer', category: 'Home & Kitchen', price: 549, oldPrice: 899, rating: 4.1, reviews: 188, image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=700&q=85' },
]

const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`

export default function Page() {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState(0)
  const [saved, setSaved] = useState<number[]>([])
  const [showCategories, setShowCategories] = useState(false)

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'All' || product.category === category
    const matchesQuery = `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  }), [category, query])

  return <div className="storefront">
    <header className="today-header">
      <div className="header-main">
        <button className="mobile-menu" aria-label="Open menu" onClick={() => setShowCategories(true)}><Menu size={22} /></button>
        <div className="today-brand"><div className="today-logo" aria-label="TodayZ home">Today<span>Z</span></div><small>shop the everyday</small></div>
        <button className="deliver"><MapPin size={18} /><span><small>Delivering today</small><strong>India</strong></span></button>
        <div className="search-bar"><select aria-label="Search category"><option>All items</option></select><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you looking for?" aria-label="Search products" /><button aria-label="Search"><Search size={22} /></button></div>
        <div className="header-actions"><button className="language">EN <ChevronDown size={12} /></button><button className="account"><small>Welcome back</small><strong>Account</strong></button><button className="orders"><small>Track</small><strong>Orders</strong></button><button className="cart" onClick={() => setCart((count) => count + 1)} aria-label={`Cart with ${cart} items`}><ShoppingCart size={25} /><b>{cart}</b><strong>Bag</strong></button></div>
      </div>
      <nav className="category-nav"><span className="nav-label">Browse today</span>{categories.slice(1, 7).map((item) => <button key={item} onClick={() => setCategory(item)}>{item}</button>)}<button className="nav-feature" onClick={() => { setCategory('All'); window.scrollTo({ top: 500, behavior: 'smooth' }) }}>Fresh finds <ChevronRight size={15} /></button><button onClick={() => setShowCategories(true)}><Menu size={16} /> More</button></nav>
    </header>

    <main>
      <section className="hero-banner"><div><p>WELCOME TO TODAYZ</p><h1>Everything you need.<br /><span>Delivered to your door.</span></h1><button onClick={() => { setCategory('All'); window.scrollTo({ top: 500, behavior: 'smooth' }) }}>Shop now <ChevronRight size={17} /></button></div><img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1300&q=85" alt="Shopping bags and packages ready for delivery" /></section>
      <section className="category-strip"><div className="section-heading"><h2>Shop by category</h2><button>See all <ChevronRight size={16} /></button></div><div className="category-cards">{['Electronics', 'Home & Kitchen', 'Fashion', 'Beauty', 'Grocery', 'Toys'].map((item, index) => <button key={item} onClick={() => setCategory(item)} className={category === item ? 'active' : ''}><div className={`category-icon icon-${index}`}><img src={products[index % products.length].image} alt="" /></div><span>{item}</span></button>)}</div></section>
      <section className="product-section"><div className="section-heading"><div><h2>Top picks for you</h2><p>Popular products, great prices, ready to ship</p></div><div className="section-controls"><button><SlidersHorizontal size={16} /> Filters</button><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"><option>All</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></div></div><div className="product-grid">{visibleProducts.map((product) => <article className="product-card" key={product.id}><div className="product-image"><img src={product.image} alt={product.name} />{product.badge && <span>{product.badge}</span>}<button className={saved.includes(product.id) ? 'saved' : ''} onClick={() => setSaved((items) => items.includes(product.id) ? items.filter((id) => id !== product.id) : [...items, product.id])} aria-label="Save product"><Heart size={18} fill={saved.includes(product.id) ? 'currentColor' : 'none'} /></button></div><div className="product-info"><small>{product.category}</small><h3>{product.name}</h3><div className="rating"><span>{product.rating}</span> <Star size={13} fill="currentColor" /> <em>({product.reviews.toLocaleString('en-IN')})</em></div><div className="price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}<span>{product.oldPrice && `${Math.round((1 - product.price / product.oldPrice) * 100)}% off`}</span></div><p>FREE delivery tomorrow</p><button className="add-button" onClick={() => setCart((count) => count + 1)}>Add to cart</button></div></article>)}</div>{visibleProducts.length === 0 && <div className="no-results"><Search size={26} /><h3>No products found</h3><p>Try another search or category.</p></div>}</section>
    </main>

    <nav className="mobile-store-nav"><button className="active"><Menu size={20} /><span>Home</span></button><button onClick={() => setShowCategories(true)}><SlidersHorizontal size={20} /><span>Categories</span></button><button onClick={() => setSaved([])}><Heart size={20} /><span>Saved</span></button><button onClick={() => setCart((count) => count + 1)}><ShoppingCart size={20} /><span>Cart {cart > 0 && `(${cart})`}</span></button></nav>
    {showCategories && <div className="mobile-category-sheet" onClick={() => setShowCategories(false)}><div onClick={(e) => e.stopPropagation()}><div className="sheet-top"><h2>Shop by category</h2><button onClick={() => setShowCategories(false)}><X size={20} /></button></div>{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => { setCategory(item); setShowCategories(false) }}>{item}<ChevronRight size={17} /></button>)}</div></div>}
  </div>
}
