import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { useAuth, useCart } from '../store';
import { attachTilt } from '../lib/motion';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

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

  const cart = useCart();
  const auth = useAuth();
  const nav = useNavigate();
  const rootRef = useRef(null);
  const gridRef = useRef(null);

  // Load filters once
  useEffect(() => {
    api.get('/public/stores').then((r) => setStores(r.data.stores));
    api.get('/public/categories').then((r) => setCats(r.data.categories));
  }, []);

  // Load catalog whenever filters change
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

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  // Page-entrance + tilt + stagger on the grid
  useEffect(() => {
    if (loading || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="fade-up"]', {
        y: 18,
        opacity: 0,
        duration: 0.6,
        stagger: 0.05,
        ease: 'power3.out',
      });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.shop-card');
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { y: 16, opacity: 0, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', stagger: { amount: 0.4 }, clearProps: 'transform' }
    );
    const detachers = [...cards].map((el) => attachTilt(el, { max: 3, scale: 1.012 }));
    return () => detachers.forEach((fn) => fn());
  }, [products.length, q, cat, storeSlug]);

  const grouped = useMemo(() => {
    const out = new Map();
    for (const p of products) {
      const k = p.store?.storeSlug || 'misc';
      if (!out.has(k)) out.set(k, { store: p.store, items: [] });
      out.get(k).items.push(p);
    }
    return [...out.values()];
  }, [products]);

  const orderNow = async (product) => {
    // Customers need to be logged in. Walk-in QR scanners can still go
    // to /store/:slug and pay anonymously.
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

  return (
    <div className="container shop-page" ref={rootRef}>
      {/* Editorial header */}
      <section className="shop-hero" data-anim="fade-up">
        <span className="eyebrow">Catalogue · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
        <h1 className="display-serif" style={{ fontSize: 'clamp(40px, 6vw, 76px)', marginTop: 14 }}>
          Shop the city's<br />
          <em>small stores.</em>
        </h1>
        <p className="muted" style={{ maxWidth: 540, marginTop: 14, fontSize: 16, lineHeight: 1.55 }}>
          Browse what local shops have in stock right now. Order online — or
          scan the shop's QR at the counter.
        </p>
      </section>

      {/* Filter strip */}
      <div className="filter-strip" data-anim="fade-up">
        <input
          type="search"
          inputMode="search"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <div className="chip-row">
          <button className={`chip ${!cat ? 'active' : ''}`} onClick={() => setParam('category', '')}>All</button>
          {cats.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setParam('category', c)}>
              {c}
            </button>
          ))}
        </div>
        {stores.length > 1 && (
          <div className="chip-row">
            <button className={`chip ${!storeSlug ? 'active' : ''}`} onClick={() => setParam('store', '')}>
              All shops
            </button>
            {stores.map((s) => (
              <button
                key={s.id}
                className={`chip ${storeSlug === s.storeSlug ? 'active' : ''}`}
                onClick={() => setParam('store', s.storeSlug)}
              >
                {s.storeName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div ref={gridRef} className="shop-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shop-card">
              <div className="skel skel-img" />
              <div className="skel skel-text" style={{ width: '80%' }} />
              <div className="skel skel-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty" data-anim="fade-up" style={{ marginTop: 20 }}>
          <div className="empty-icon">🔎</div>
          <h3>Nothing matches</h3>
          <p>Try a different search or pick a different category.</p>
        </div>
      ) : (
        grouped.map(({ store, items }) => (
          <section key={store?.storeSlug || 'misc'} className="shop-section" data-anim="fade-up">
            <header className="shop-section-head">
              <div>
                <span className="eyebrow">/{store?.storeSlug}</span>
                <h2 style={{ marginTop: 8 }}>{store?.storeName}</h2>
                {store?.city && <p className="muted" style={{ marginTop: 2 }}>{store.city}</p>}
              </div>
              <Link to={`/store/${store?.storeSlug}`} className="see-store">
                Visit store →
              </Link>
            </header>

            <div ref={gridRef} className="shop-grid">
              {items.map((p) => {
                const qty = cart.items[p.id]?.quantity || 0;
                return (
                  <article key={p.id} className="shop-card">
                    <div className="shop-card-img">
                      <img
                        src={p.imageUrl || `https://placehold.co/400x300?text=${encodeURIComponent(p.name)}`}
                        alt={p.name}
                        loading="lazy"
                      />
                      {!p.inStock && <span className="img-tag out">Out of stock</span>}
                      {p.categoryName && p.inStock && (
                        <span className="img-tag soft">{p.categoryName}</span>
                      )}
                    </div>
                    <div className="shop-card-body">
                      <h3 style={{ marginBottom: 4 }}>{p.name}</h3>
                      <div className="row between" style={{ alignItems: 'baseline' }}>
                        <strong className="price-tag">{inr(p.price)}</strong>
                        {p.inStock && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {p.stockQuantity} in stock
                          </span>
                        )}
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 12 }}>
                        {p.inStock && qty === 0 && (
                          <button onClick={() => cart.add(p)} style={{ flex: 1 }}>
                            Add to cart
                          </button>
                        )}
                        {p.inStock && qty > 0 && (
                          <div className="qty" style={{ flex: 1 }}>
                            <button className="secondary" onClick={() => cart.dec(p.id)}>−</button>
                            <span>{qty}</span>
                            <button
                              className="secondary"
                              onClick={() => cart.add(p)}
                              disabled={qty >= p.stockQuantity}
                            >+</button>
                          </div>
                        )}
                        {p.inStock && (
                          <button className="secondary" onClick={() => orderNow(p)}>
                            Order
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

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
    <div className="cart-bar" style={{ left: 20, right: 20, bottom: 20 }}>
      <span>🛒 {cart.count()} item{cart.count() > 1 ? 's' : ''} · {inr(cart.total())}</span>
      <button className="secondary" onClick={onCheckout}>Go to checkout →</button>
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
          {order.orderNumber} · {inr(order.totalAmount)}
        </div>
      </div>
      <button className="secondary" onClick={onView}>View →</button>
    </div>
  );
}
