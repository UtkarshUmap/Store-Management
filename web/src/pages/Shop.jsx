import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';
import { useAuth, useCart } from '../store';
import { attachTilt } from '../lib/motion';
import { formatINR, getProductRating } from '../lib/productPresentation';

gsap.registerPlugin(ScrollTrigger);

const sortLabels = {
  featured: 'Featured',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  stock_desc: 'Most stock',
  rating_desc: 'Top rated',
};

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);

  const q = params.get('q') || '';
  const cat = params.get('category') || '';
  const storeSlug = params.get('store') || '';
  const stock = params.get('stock') || '';
  const sort = params.get('sort') || 'featured';

  const cart = useCart();
  const auth = useAuth();
  const nav = useNavigate();
  const rootRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/public/stores').then((r) => setStores(r.data.stores));
    api.get('/public/categories').then((r) => setCats(r.data.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (cat) search.set('category', cat);
    if (storeSlug) search.set('store', storeSlug);
    api
      .get(`/public/catalog?${search.toString()}`)
      .then((r) => setProducts(r.data.products))
      .finally(() => setLoading(false));
  }, [q, cat, storeSlug]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const resetFilters = () => setParams(new URLSearchParams(), { replace: true });

  const visibleProducts = useMemo(() => {
    const next = products.filter((product) => (stock === 'in' ? product.inStock : true));
    return [...next].sort((a, b) => {
      if (sort === 'price_asc') return Number(a.price) - Number(b.price);
      if (sort === 'price_desc') return Number(b.price) - Number(a.price);
      if (sort === 'stock_desc') return Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0);
      if (sort === 'rating_desc') return Number(getProductRating(b).value) - Number(getProductRating(a).value);
      return Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0);
    });
  }, [products, stock, sort]);

  const summary = useMemo(() => {
    const inStock = products.filter((product) => product.inStock).length;
    const storeCount = new Set(products.map((product) => product.store?.storeSlug).filter(Boolean)).size;
    const priceRange = products.reduce(
      (range, product) => {
        const price = Number(product.price || 0);
        return {
          min: Math.min(range.min, price),
          max: Math.max(range.max, price),
        };
      },
      { min: Infinity, max: 0 }
    );
    return {
      inStock,
      storeCount,
      priceRange: products.length ? `${formatINR(priceRange.min)} - ${formatINR(priceRange.max)}` : 'No prices',
    };
  }, [products]);

  useEffect(() => {
    if (!rootRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set('[data-reveal], .catalog-hero-card', { opacity: 1, y: 0, clearProps: 'transform' });
        return;
      }

      gsap.from('.catalog-hero-copy > *', {
        y: 24,
        opacity: 0,
        duration: 0.72,
        stagger: 0.07,
        ease: 'power3.out',
      });
      gsap.from('.catalog-hero-card', {
        y: 28,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        delay: 0.15,
      });
      gsap.to('.scroll-progress-bar', {
        scaleX: 1,
        transformOrigin: 'left center',
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      });
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%' },
          }
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!gridRef.current || loading) return;
    const cards = gridRef.current.querySelectorAll('[data-product-card]');
    if (!cards.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      gsap.fromTo(
        cards,
        { y: 18, opacity: 0, scale: 0.985 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.48,
          ease: 'power3.out',
          stagger: { amount: 0.38 },
          clearProps: 'transform',
        }
      );
    }
    const detachers = [...cards].map((el) => attachTilt(el, { max: 2.6, scale: 1.008 }));
    return () => detachers.forEach((fn) => fn());
  }, [visibleProducts.length, loading, q, cat, storeSlug, stock, sort]);

  const addProduct = (product) => cart.add(product);

  const orderNow = async (product) => {
    if (!auth.token) {
      nav('/login', { state: { from: { pathname: '/shop' } } });
      return;
    }
    try {
      const { data } = await api.post('/public/checkout', {
        storeSlug: product.store.storeSlug,
        paymentMethod: 'CASH',
        items: [{ productId: product.id, quantity: 1 }],
      });
      setOrder(data.order);
    } catch (e) {
      alert(e.response?.data?.error || 'Could not place order');
    }
  };

  const activeFilterCount = [q, cat, storeSlug, stock, sort !== 'featured' ? sort : ''].filter(Boolean).length;

  return (
    <div className="marketplace-page" ref={rootRef}>
      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" />
      </div>

      <section className="catalog-hero">
        <div className="catalog-hero-copy">
          <span className="section-eyebrow">Marketplace listing experience</span>
          <h1>Product cards that make every shop look established.</h1>
          <p>
            Browse the live demo catalog the way a customer sees it: clear prices, premium imagery,
            stock confidence, ratings, and fast purchase paths.
          </p>
          <div className="catalog-hero-actions">
            <Link to="/register"><button className="btn-v2 primary">Start Selling</button></Link>
            <Link to="/login"><button className="btn-v2 subtle">View Demo</button></Link>
          </div>
        </div>

        <div className="catalog-hero-cards" aria-label="Catalog performance summary">
          <div className="catalog-hero-card">
            <span>Active listings</span>
            <strong>{products.length || '--'}</strong>
            <small>{summary.inStock} ready to sell</small>
          </div>
          <div className="catalog-hero-card accent">
            <span>Store coverage</span>
            <strong>{summary.storeCount || '--'}</strong>
            <small>seller storefronts</small>
          </div>
          <div className="catalog-hero-card">
            <span>Price range</span>
            <strong>{summary.priceRange}</strong>
            <small>customer-friendly catalog</small>
          </div>
        </div>
      </section>

      <section className="catalog-shell" data-reveal>
        <aside className="catalog-sidebar" aria-label="Product filters">
          <div className="filter-panel">
            <div className="filter-panel-head">
              <div>
                <span>Filters</span>
                <strong>{activeFilterCount} active</strong>
              </div>
              <button type="button" className="text-button" onClick={resetFilters}>Reset</button>
            </div>

            <label className="filter-control">
              <span>Search products</span>
              <input
                type="search"
                inputMode="search"
                placeholder="Search snacks, drinks, SKUs..."
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
              />
            </label>

            <label className="filter-control">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <div className="filter-control">
              <span>Availability</span>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={stock === 'in'}
                  onChange={(e) => setParam('stock', e.target.checked ? 'in' : '')}
                />
                <span>Show in-stock listings only</span>
              </label>
            </div>

            <div className="filter-control">
              <span>Category</span>
              <div className="filter-stack">
                <button type="button" className={!cat ? 'filter-option active' : 'filter-option'} onClick={() => setParam('category', '')}>
                  All categories
                </button>
                {cats.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={cat === category ? 'filter-option active' : 'filter-option'}
                    onClick={() => setParam('category', category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {stores.length > 0 && (
              <div className="filter-control">
                <span>Storefront</span>
                <div className="filter-stack">
                  <button type="button" className={!storeSlug ? 'filter-option active' : 'filter-option'} onClick={() => setParam('store', '')}>
                    All stores
                  </button>
                  {stores.map((store) => (
                    <button
                      type="button"
                      key={store.id}
                      className={storeSlug === store.storeSlug ? 'filter-option active' : 'filter-option'}
                      onClick={() => setParam('store', store.storeSlug)}
                    >
                      {store.storeName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="seller-note">
              <strong>For shop owners</strong>
              <p>Every listing includes trust cues customers expect before they add to cart.</p>
              <Link to="/register">Open your store</Link>
            </div>
          </div>
        </aside>

        <div className="catalog-results">
          <div className="results-toolbar">
            <div>
              <span>{loading ? 'Loading catalog' : `${visibleProducts.length} listings`}</span>
              <strong>{cat || storeSlug || q ? 'Filtered marketplace' : 'Featured marketplace'}</strong>
            </div>
            <div className="results-pills">
              <span>{sortLabels[sort]}</span>
              {stock === 'in' && <span>In stock</span>}
            </div>
          </div>

          {loading ? (
            <div className="premium-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="listing-card listing-card-skeleton">
                  <div className="skel skel-img" />
                  <div className="skel skel-text" style={{ width: '78%' }} />
                  <div className="skel skel-text" style={{ width: '48%' }} />
                  <div className="skel skel-text" style={{ width: '100%', height: 40 }} />
                </div>
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty premium-empty">
              <div className="empty-icon">0</div>
              <h3>No listings match</h3>
              <p>Try a wider search, another category, or clear active filters.</p>
              <button type="button" className="btn-v2 subtle" onClick={resetFilters}>Reset filters</button>
            </div>
          ) : (
            <div ref={gridRef} className="premium-grid">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart.items[product.id]?.quantity || 0}
                  onAdd={addProduct}
                  onDec={cart.dec}
                  onOrder={orderNow}
                  showStore
                  storeHref={`/store/${product.store?.storeSlug}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {cart.count() > 0 && (
        <CartDock onCheckout={() => nav('/store/' + (Object.values(cart.items)[0]?.product?.store?.storeSlug || ''))} />
      )}

      {order && <OrderToast order={order} onClose={() => setOrder(null)} onView={() => nav(`/receipt/${order.orderNumber}`)} />}
    </div>
  );
}

function CartDock({ onCheckout }) {
  const cart = useCart();
  return (
    <div className="cart-bar premium-cart-bar">
      <span>{cart.count()} item{cart.count() > 1 ? 's' : ''} · {formatINR(cart.total())}</span>
      <button className="secondary" onClick={onCheckout}>Checkout</button>
    </div>
  );
}

function OrderToast({ order, onClose, onView }) {
  const ref = useRef(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div ref={ref} className="order-toast">
      <div>
        <strong>Order placed</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {order.orderNumber} · {formatINR(order.totalAmount)}
        </div>
      </div>
      <button className="secondary" onClick={onView}>View</button>
    </div>
  );
}
