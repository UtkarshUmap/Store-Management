import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';
import { useCart } from '../store';
import { attachTilt } from '../lib/motion';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function Storefront() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');

  const cart = useCart();
  const rootRef = useRef(null);
  const cartBarRef = useRef(null);
  const gridRef = useRef(null);

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
    return () => cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Page entrance once data lands.
  useEffect(() => {
    if (loading || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="fade-up"]', { y: 18, opacity: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  // Filter products by category + search.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== 'all' && p.categoryId !== activeCat) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, activeCat, q]);

  // Tilt + stagger on filtered grid; rerun when filter changes.
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('[data-product-card]');
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { y: 14, opacity: 0, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', stagger: { amount: 0.35 }, clearProps: 'transform' }
    );
    const detachers = [...cards].map((el) => attachTilt(el, { max: 4, scale: 1.015 }));
    return () => detachers.forEach((fn) => fn());
  }, [filtered.length, activeCat, q]);

  // Cart bar slide-in.
  const cartCount = cart.count();
  useEffect(() => {
    if (!cartBarRef.current) return;
    if (cartCount > 0 && !checkout) {
      gsap.fromTo(
        cartBarRef.current,
        { y: 80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
      );
    }
  }, [cartCount, checkout]);

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
      <div className="storefront-page">
        <div className="storefront-hero-skel skel" />
        <div className="premium-grid storefront-product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="listing-card listing-card-skeleton">
              <div className="skel skel-img" />
              <div className="skel skel-text" style={{ width: '80%' }} />
              <div className="skel skel-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalItems = products.length;
  const totalInStock = products.filter((p) => p.inStock).length;

  return (
    <div className="storefront-page" ref={rootRef}>
      <header className="storefront-hero-v2" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">QR storefront</span>
          <h1>{store.storeName}</h1>
          <p>{store.city ? `${store.city} · ` : ''}Browse live shelf inventory, add products, and check out with cash or online payment.</p>
        </div>
        <div className="storefront-hero-stats">
          <div>
            <span>In stock</span>
            <strong>{totalInStock}/{totalItems}</strong>
          </div>
          <div>
            <span>Categories</span>
            <strong>{categories.length || 1}</strong>
          </div>
          {store.phone && (
            <div>
              <span>Phone</span>
              <strong>{store.phone}</strong>
            </div>
          )}
        </div>
      </header>

      <div className="storefront-filter-bar" data-anim="fade-up">
        <input
          type="search"
          inputMode="search"
          placeholder="Search products..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {categories.length > 0 && (
          <div className="chip-row">
            <button
              className={`chip ${activeCat === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCat('all')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip ${activeCat === c.id ? 'active' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty premium-empty" data-anim="fade-up" style={{ marginTop: 24 }}>
          <div className="empty-icon">0</div>
          <h3>No products match</h3>
          <p>Try a different search or category.</p>
        </div>
      ) : (
        <div ref={gridRef} className="premium-grid storefront-product-grid" style={{ marginTop: 20 }}>
          {filtered.map((p) => {
            const qty = cart.items[p.id]?.quantity || 0;
            return (
              <ProductCard
                key={p.id}
                product={p}
                quantity={qty}
                onAdd={cart.add}
                onDec={cart.dec}
                actionLabel="Add"
              />
            );
          })}
        </div>
      )}

      {cartCount > 0 && !checkout && (
        <div className="cart-bar premium-cart-bar" ref={cartBarRef}>
          <span>{cartCount} item{cartCount > 1 ? 's' : ''} · {inr(cart.total())}</span>
          <button className="secondary" onClick={() => setCheckout(true)}>Checkout</button>
        </div>
      )}

      {checkout && (
        <CheckoutModal
          store={store}
          onClose={() => setCheckout(false)}
          onDone={(num) => nav(`/receipt/${num}`)}
        />
      )}
    </div>
  );
}

function CheckoutModal({ store, onClose, onDone }) {
  const cart = useCart();
  const [method, setMethod] = useState('RAZORPAY');
  const [customer, setCustomer] = useState({ fullName: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo(
        panelRef.current,
        { y: 24, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45 },
        '-=0.1'
      );
    return () => tl.kill();
  }, []);

  const dismiss = () => {
    gsap
      .timeline({ onComplete: onClose })
      .to(panelRef.current, { y: 20, opacity: 0, scale: 0.98, duration: 0.22, ease: 'power3.in' })
      .to(backdropRef.current, { opacity: 0, duration: 0.18 }, '-=0.15');
  };

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
        paymentMethod: method,
        customer: customer.phone || customer.fullName ? customer : undefined,
        items,
      });

      if (method === 'CASH') {
        cart.clear();
        return onDone(data.order.orderNumber);
      }

      const rz = data.razorpay;
      const options = {
        key: rz.keyId,
        amount: rz.amount,
        currency: rz.currency,
        order_id: rz.orderId,
        name: store.storeName,
        description: data.order.orderNumber,
        prefill: { name: customer.fullName, contact: customer.phone },
        handler: async (resp) => {
          try {
            await api.post('/public/payment/verify', {
              orderId: data.order.id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            cart.clear();
            onDone(data.order.orderNumber);
          } catch {
            setErr('Payment verification failed. Contact the store.');
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: '#6366f1' },
      };
      // eslint-disable-next-line no-undef
      new window.Razorpay(options).open();
    } catch (e) {
      setErr(e.response?.data?.error || 'Checkout failed');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={dismiss}>
      <div
        ref={panelRef}
        className="checkout-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-panel-head">
          <div>
            <span>Secure checkout</span>
            <h2>Review order</h2>
          </div>
          <strong>{inr(cart.total())}</strong>
        </div>
        <div className="checkout-lines">
          {Object.values(cart.items).map(({ product, quantity }) => (
            <div key={product.id} className="row between">
              <span>{product.name} × {quantity}</span>
              <span>{inr(Number(product.price) * quantity)}</span>
            </div>
          ))}
          <hr />
          <div className="row between"><strong>Total</strong><strong>{inr(cart.total())}</strong></div>
        </div>

        <input
          placeholder="Your name (optional)"
          value={customer.fullName}
          onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
        />
        <input
          placeholder="Phone (optional)"
          inputMode="tel"
          value={customer.phone}
          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
        />

        <div className="payment-toggle">
          <button
            className={method === 'RAZORPAY' ? 'active' : ''}
            onClick={() => setMethod('RAZORPAY')}
          >
            Pay online
          </button>
          <button
            className={method === 'CASH' ? 'active' : ''}
            onClick={() => setMethod('CASH')}
          >
            Cash
          </button>
        </div>

        {err && <div className="error">{err}</div>}
        <button className="btn-v2 primary" onClick={placeOrder} disabled={busy}>
          {busy ? 'Processing…' : method === 'CASH' ? 'Place cash order' : `Pay ${inr(cart.total())}`}
        </button>
        <button className="btn-v2 subtle" onClick={dismiss} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
