// CUSTOMER PANEL — what a shopper sees after scanning a store's QR code.
// Scoped to ONE store: its categories, its products, its cart. No cross-store
// browsing. Flow: browse by category / search -> +/- into cart -> cart drawer
// (with recommendations) -> log in -> confirm -> order number.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { useCart, useAuth } from '../store';
import { formatINR, getProductImage, getStockStatus } from '../lib/productPresentation';
import { categoryArt } from '../lib/categoryArt';

const inr = (n) => formatINR(n);

// Shown once, right after the QR scan: greets the shopper by name, confirms
// which shop they've walked into, then hands off to the product list.
function StoreWelcome({ store, itemCount, onDone }) {
  const { user } = useAuth();
  // A QR walk-in usually isn't signed in yet — greet them warmly either way.
  const first = (user?.fullName || '').split(' ')[0];
  const ref = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.sw-badge', { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' })
        .from('.sw-hi', { y: 16, opacity: 0, duration: 0.45 }, '-=0.2')
        .from('.sw-store', { y: 18, opacity: 0, duration: 0.5 }, '-=0.25')
        .from('.sw-chip', { y: 12, opacity: 0, duration: 0.4, stagger: 0.07 }, '-=0.25')
        .from('.sw-go', { y: 14, opacity: 0, duration: 0.4 }, '-=0.2');
    }, ref);
    // Auto-advance so a walk-in isn't stuck on a splash screen.
    const t = setTimeout(onDone, 2600);
    return () => { ctx.revert(); clearTimeout(t); };
  }, [onDone]);

  return (
    <div className="store-welcome" ref={ref}>
      <div className="sw-inner">
        <span className="sw-badge">{store.storeName.slice(0, 1).toUpperCase()}</span>
        <p className="sw-hi">{first ? `Hi ${first}, welcome to` : 'Welcome to'}</p>
        <h1 className="sw-store">{store.storeName}</h1>
        <div className="sw-chips">
          {store.city && <span className="sw-chip">📍 {store.city}</span>}
          <span className="sw-chip">🛒 {itemCount} items in stock</span>
        </div>
        <button className="sw-go" onClick={onDone}>Start shopping →</button>
      </div>
    </div>
  );
}

export default function Storefront() {
  const { slug } = useParams();
  const nav = useNavigate();
  const cart = useCart();
  const rootRef = useRef(null);
  const [welcomed, setWelcomed] = useState(false);

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/public/storefront/${slug}`)
      .then((r) => {
        setStore(r.data.store);
        setProducts(r.data.products);
        setCategories(r.data.categories || []);
      })
      .catch(() => setErr('Store not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (loading || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="fade-up"]', { y: 14, opacity: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  const searching = q.trim().length > 0;
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (!searching && activeCat !== 'all' && p.categoryId !== activeCat) return false;
        if (needle && !p.name.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [products, activeCat, needle, searching]
  );

  // Browse mode: group products under their category headings (Instamart style).
  const sections = useMemo(() => {
    if (searching || activeCat !== 'all') return null;
    const byCat = new Map();
    for (const p of products) {
      const key = p.categoryId || 'uncat';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    }
    const out = categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, items: byCat.get(c.id) }));
    if (byCat.has('uncat')) out.push({ id: 'uncat', name: 'Other', items: byCat.get('uncat') });
    return out;
  }, [products, categories, activeCat, searching]);

  const cartCount = cart.count();

  if (err) {
    return (
      <div className="center storefront-page">
        <div className="empty premium-empty" style={{ maxWidth: 360 }}>
          <div className="empty-icon">S</div>
          <h3>Store not found</h3>
          <p>The link or QR code may be out of date.</p>
        </div>
      </div>
    );
  }

  if (loading || !store) {
    return (
      <div className="storefront-page shop-v3">
        <div className="storefront-hero-skel skel" />
        <div className="shop-grid">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="sp-card">
              <div className="skel skel-img" style={{ height: 120 }} />
              <div className="skel skel-text" style={{ width: '80%' }} />
              <div className="skel skel-text" style={{ width: '45%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Greet the shopper once, then hand off to the products list.
  if (!welcomed) {
    return (
      <StoreWelcome
        store={store}
        itemCount={products.filter((p) => p.inStock).length}
        onDone={() => setWelcomed(true)}
      />
    );
  }

  return (
    <div className="storefront-page shop-v3" ref={rootRef}>
      {/* Sticky top bar: store identity + search (quick-commerce style) */}
      <header className="shop-topbar" data-anim="fade-up">
        <div className="shop-topbar-store">
          <span className="shop-store-badge">{store.storeName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{store.storeName}</strong>
            <span>
              {store.city ? `${store.city} · ` : ''}
              {products.filter((p) => p.inStock).length} items in stock
            </span>
          </div>
        </div>
        <div className="shop-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            inputMode="search"
            placeholder={`Search in ${store.storeName}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="shop-search-clear" onClick={() => setQ('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
        {/* The scalloped canopy hangs off the sticky bar — the shelf below
            scrolls under it, exactly like walking under a stall's awning. */}
        <span className="cx-awning shop-canopy" aria-hidden />
      </header>

      {/* Blinkit-style category tiles — the fastest way into a category, and it
          gives the page a visual anchor before the product wall. */}
      {categories.length > 0 && !searching && activeCat === 'all' && (
        <section className="cat-tiles" data-anim="fade-up">
          <h2 className="cat-tiles-title">Shop by category</h2>
          <div className="cat-tiles-row">
            {categories.map((c) => {
              const items = products.filter((p) => p.categoryId === c.id);
              if (!items.length) return null;
              const art = categoryArt(c.name);
              return (
                <button className="cat-tile" key={c.id} onClick={() => setActiveCat(c.id)}>
                  <span className="cat-tile-art" style={{ background: art.bg, color: art.fg }}>
                    <em>{art.icon}</em>
                  </span>
                  <span className="cat-tile-name">{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Instamart/Blinkit layout: vertical category sidebar + product area */}
      <div className="shop-body">
        {categories.length > 0 && !searching && (
          <aside className="shop-sidebar" data-anim="fade-up">
            <button
              className={`shop-cat-item ${activeCat === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCat('all')}
            >
              <span className="shop-cat-ico">🛒</span>
              <span className="shop-cat-label">All</span>
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  className={`shop-cat-item ${activeCat === c.id ? 'active' : ''}`}
                  onClick={() => setActiveCat(c.id)}
                >
                  <span className="shop-cat-ico">{c.name.slice(0, 1).toUpperCase()}</span>
                  <span className="shop-cat-label">{c.name}</span>
                  <span className="shop-cat-n">{count}</span>
                </button>
              );
            })}
          </aside>
        )}

        <main className="shop-main">
          {sections ? (
            sections.map((sec) => (
              <section className="shop-section" key={sec.id}>
                <div className="shop-section-head">
                  <h2>{sec.name}</h2>
                  <span>{sec.items.length} items</span>
                </div>
                <div className="shop-grid">
                  {sec.items.map((p) => (
                    <ShopProduct key={p.id} product={p} cart={cart} />
                  ))}
                </div>
              </section>
            ))
          ) : filtered.length === 0 ? (
            <div className="empty premium-empty" style={{ marginTop: 24 }}>
              <div className="empty-icon">0</div>
              <h3>No products match</h3>
              <p>Try a different search or category.</p>
            </div>
          ) : (
            <section className="shop-section">
              <div className="shop-section-head">
                <h2>{searching ? `Results for “${q.trim()}”` : categories.find((c) => c.id === activeCat)?.name}</h2>
                <span>{filtered.length} items</span>
              </div>
              <div className="shop-grid">
                {filtered.map((p) => (
                  <ShopProduct key={p.id} product={p} cart={cart} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {cartCount > 0 && !cartOpen && !checkout && (
        <button className="shop-cartbar" onClick={() => setCartOpen(true)}>
          <span className="shop-cartbar-count">{cartCount}</span>
          <span>
            {cartCount} item{cartCount > 1 ? 's' : ''} · {inr(cart.total())}
          </span>
          <span className="shop-cartbar-cta">View cart →</span>
        </button>
      )}

      {cartOpen && (
        <CartDrawer
          products={products}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckout(true);
          }}
        />
      )}

      {checkout && (
        <CheckoutModal
          store={store}
          onClose={() => setCheckout(false)}
          onDone={(orderNumber) => nav(`/receipt/${orderNumber}`)}
        />
      )}
    </div>
  );
}

/* ---------------- Product tile with a +/- stepper ---------------- */
function ShopProduct({ product, cart }) {
  const qty = cart.items[product.id]?.quantity || 0;
  const stock = getStockStatus(product);
  const canBuy = product.inStock && Number(product.stockQuantity || 0) > 0;

  return (
    <article className="sp-card">
      <div className="sp-media">
        {/* Scarcity is the strongest nudge a shelf has — surface it on the photo. */}
        {canBuy && Number(product.stockQuantity) <= 8 && (
          <span className="sp-flag">Only {product.stockQuantity} left</span>
        )}
        <img src={getProductImage(product)} alt={product.name} loading="lazy" draggable="false" />
        {!canBuy && <span className="sp-soldout">Sold out</span>}
      </div>
      <div className="sp-body">
        <h3 title={product.name}>{product.name}</h3>
        <span className="sp-sub">{stock.helper}</span>
        <div className="sp-foot">
          <strong>{inr(product.price)}</strong>
          {qty > 0 ? (
            <div className="sp-stepper">
              <button onClick={() => cart.dec(product.id)} aria-label="Remove one">−</button>
              <span>{qty}</span>
              <button
                onClick={() => cart.add(product)}
                disabled={qty >= Number(product.stockQuantity || 0)}
                aria-label="Add one"
              >
                +
              </button>
            </div>
          ) : (
            <button className="sp-add" onClick={() => cart.add(product)} disabled={!canBuy}>
              ADD
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------------- Cart drawer: +/-, remove, recommendations ---------------- */
function CartDrawer({ products, onClose, onCheckout }) {
  const cart = useCart();
  const panelRef = useRef(null);
  const backdropRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      .fromTo(panelRef.current, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.38 }, '-=0.08');
    return () => tl.kill();
  }, []);

  const lines = Object.values(cart.items);

  // Suggest in-stock items not already in the cart, preferring the categories
  // the shopper is already buying from.
  const recos = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.product.id));
    const cats = new Set(lines.map((l) => l.product.categoryId).filter(Boolean));
    const pool = products.filter((p) => p.inStock && !inCart.has(p.id));
    return [
      ...pool.filter((p) => cats.has(p.categoryId)),
      ...pool.filter((p) => !cats.has(p.categoryId)),
    ].slice(0, 6);
  }, [products, lines]);

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onClose}>
      <aside className="cart-drawer" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <span className="cx-awning drawer-awning" aria-hidden />
        <div className="cart-drawer-head">
          <h2>
            Your cart
            {lines.length > 0 && <span className="cx-count">{cart.count()} items</span>}
          </h2>
          <button className="cart-drawer-close" onClick={onClose} aria-label="Close cart">
            ×
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="cart-empty">
            <div className="cx-empty-art" aria-hidden>🛒</div>
            <p className="muted">Your cart is empty.</p>
            <button className="btn-v2" onClick={onClose}>Browse products</button>
          </div>
        ) : (
          <>
            {/* Pickup promise. A cart with no reassurance is a cart people leave. */}
            <div className="cart-promise">
              <em aria-hidden>⚡</em>
              <div>
                Ready for pickup in minutes
                <small>Collect at the counter — pay when you get there.</small>
              </div>
            </div>

            <div className="cart-lines">
              {lines.map(({ product, quantity }) => (
                <div className="cart-line" key={product.id}>
                  <img src={getProductImage(product)} alt="" loading="lazy" />
                  <div className="cart-line-info">
                    <strong>{product.name}</strong>
                    <span>{inr(product.price)} each</span>
                    <button className="cart-remove" onClick={() => cart.remove(product.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="cart-line-right">
                    <div className="sp-stepper">
                      <button onClick={() => cart.dec(product.id)} aria-label="Remove one">−</button>
                      <span>{quantity}</span>
                      <button
                        onClick={() => cart.add(product)}
                        disabled={quantity >= Number(product.stockQuantity || 0)}
                        aria-label="Add one"
                      >
                        +
                      </button>
                    </div>
                    <strong>{inr(Number(product.price) * quantity)}</strong>
                  </div>
                </div>
              ))}
            </div>

            {recos.length > 0 && (
              <div className="cart-recos">
                <h3>You might also like</h3>
                <div className="cart-reco-row">
                  {recos.map((p) => (
                    <div className="cart-reco" key={p.id}>
                      <img src={getProductImage(p)} alt="" loading="lazy" />
                      <span className="cart-reco-name" title={p.name}>{p.name}</span>
                      <span className="cart-reco-price">{inr(p.price)}</span>
                      <button className="cart-reco-add" onClick={() => cart.add(p)}>
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nothing is added on top — say so explicitly rather than letting
                the shopper wonder what a "handling fee" line might appear at
                the last step. */}
            <div className="cx-bill">
              <h4>Bill details</h4>
              <div className="cx-bill-row">
                <span>Item total ({cart.count()} item{cart.count() > 1 ? 's' : ''})</span>
                <span>{inr(cart.total())}</span>
              </div>
              <div className="cx-bill-row free">
                <span>Handling charge</span>
                <span><s>₹15</s> FREE</span>
              </div>
              <div className="cx-bill-row free">
                <span>Store pickup</span>
                <span>FREE</span>
              </div>
              <div className="cx-bill-total">
                <span>To pay at counter</span>
                <strong>{inr(cart.total())}</strong>
              </div>
            </div>

            <div className="cart-foot">
              <div className="cart-total-row">
                <span>{cart.count()} item{cart.count() > 1 ? 's' : ''} · Total</span>
                <strong>{inr(cart.total())}</strong>
              </div>
              <button className="btn-v2 primary cart-checkout" onClick={onCheckout}>
                Proceed to checkout <span aria-hidden>→</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ---------------- Checkout — customer must be signed in ---------------- */
function CheckoutModal({ store, onClose, onDone }) {
  const cart = useCart();
  const { token, user } = useAuth();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22 })
      .fromTo(panelRef.current, { y: 22, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.4 }, '-=0.1');
    return () => tl.kill();
  }, [token]);

  // The order is tied to the customer's account so both they and the shop owner
  // can look it up by order number afterwards.
  if (!token) {
    return (
      <div className="modal-backdrop" ref={backdropRef} onClick={onClose}>
        <div className="checkout-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
          <div className="admin-panel-head">
            <div>
              <span>One last step</span>
              <h2>Log in to place your order</h2>
            </div>
            <strong>{inr(cart.total())}</strong>
          </div>

          <div className="cx-sheet-body">
            <p className="cx-gate-copy">
              Just your email and password — so this order is saved to your account and
              you can track it later. <strong>Your cart is safe.</strong>
            </p>
          </div>

          <div className="cx-sheet-foot">
            <Link className="btn-v2 primary" to="/login" state={{ from: loc }}>Log in</Link>
            <Link className="btn-v2" to="/register" state={{ from: loc }}>Create an account</Link>
            <button className="btn-v2 subtle" onClick={onClose}>Back to cart</button>
          </div>
        </div>
      </div>
    );
  }

  const items = Object.values(cart.items).map(({ product, quantity }) => ({
    productId: product.id,
    quantity,
  }));

  const placeOrder = async () => {
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/public/checkout', {
        storeSlug: store.storeSlug,
        paymentMethod: 'CASH',
        customer: {
          fullName: user?.fullName || undefined,
          email: user?.email || undefined,
          phone: user?.phone || undefined,
        },
        items,
      });

      // Cash on pickup is the only method right now. The Razorpay branch used to
      // live here; it's gone with the script, and the backend still rejects
      // RAZORPAY with a clean 503 when it isn't configured.
      cart.clear();
      return onDone(data.order.orderNumber);
    } catch (e) {
      setErr(e.response?.data?.error || 'Checkout failed');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="checkout-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-head">
          <div>
            <span>Secure checkout</span>
            <h2>Review order</h2>
          </div>
          <strong>{inr(cart.total())}</strong>
        </div>

        <div className="cx-sheet-body">
        <div className="checkout-lines">
          {Object.values(cart.items).map(({ product, quantity }) => (
            <div key={product.id} className="row between">
              <span>{product.name} × {quantity}</span>
              <span>{inr(Number(product.price) * quantity)}</span>
            </div>
          ))}
          <hr />
          <div className="row between">
            <strong>Total</strong>
            <strong>{inr(cart.total())}</strong>
          </div>
        </div>

        <p className="muted checkout-as">
          Ordering as <strong>{user?.fullName || user?.email}</strong>
        </p>

        {/* Online payment is off for now (Razorpay's script isn't loaded), so
            don't offer an option that can't complete. */}
        <div className="pay-method-note">
          <span className="pay-ico">💵</span>
          <div>
            <strong>Cash on pickup</strong>
            <span>Pay at the counter when you collect your order.</span>
          </div>
        </div>

        {err && <div className="error">{err}</div>}
        </div>

        <div className="cx-sheet-foot">
          <button className="btn-v2 primary" onClick={placeOrder} disabled={busy}>
            {busy ? 'Placing your order…' : `Confirm order · ${inr(cart.total())}`}
          </button>
          <button className="btn-v2 subtle" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <span className="cx-trust"><span aria-hidden>🔒</span> Your order is saved to your account</span>
        </div>
      </div>
    </div>
  );
}
