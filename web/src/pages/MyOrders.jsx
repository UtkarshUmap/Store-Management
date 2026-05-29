import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmt = (d) => new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef(null);

  useEffect(() => {
    api
      .get('/me/orders')
      .then((r) => setOrders(r.data.orders))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="fade-up"]', { y: 14, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' });
      gsap.from('.order-row', { y: 16, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', delay: 0.15 });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  return (
    <div className="container" ref={rootRef}>
      <section className="shop-hero" data-anim="fade-up">
        <span className="eyebrow">Account · Orders</span>
        <h1 className="display-serif" style={{ fontSize: 'clamp(36px, 5vw, 60px)', marginTop: 12 }}>
          Your orders.
        </h1>
        <p className="muted" style={{ marginTop: 12, maxWidth: 520 }}>
          Everything you've ordered, freshest first. Tap a receipt to print or
          show at the counter.
        </p>
      </section>

      {loading ? (
        <div className="grid" style={{ gap: 12, marginTop: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card"><div className="skel skel-text" style={{ width: '60%' }} /><div className="skel skel-text" style={{ width: '40%' }} /></div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty" data-anim="fade-up" style={{ marginTop: 28 }}>
          <div className="empty-icon">🛍</div>
          <h3>No orders yet</h3>
          <p>Start shopping and your orders will appear here.</p>
          <div style={{ marginTop: 14 }}>
            <Link to="/shop"><button>Browse the catalogue →</button></Link>
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12, marginTop: 24 }}>
          {orders.map((o) => (
            <article key={o.id} className="card order-row">
              <div className="row between" style={{ alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200 }}>
                  <span className="eyebrow">{o.store?.storeName || '—'}</span>
                  <h3 style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                    {o.orderNumber}
                  </h3>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{fmt(o.createdAt)}</p>
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <p className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Items</p>
                  <p style={{ marginTop: 4 }}>
                    {o.items.slice(0, 3).map((it) => `${it.productName} × ${it.quantity}`).join(' · ')}
                    {o.items.length > 3 ? ` · +${o.items.length - 3} more` : ''}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
                  <div className="stat" style={{ fontSize: 22 }}>{inr(o.totalAmount)}</div>
                  <span className={`badge ${o.paymentStatus === 'SUCCESS' ? 'ok' : o.paymentStatus === 'FAILED' ? 'out' : 'low'}`} style={{ marginTop: 6 }}>
                    {o.paymentMethod} · {o.paymentStatus}
                  </span>
                  <div style={{ marginTop: 10 }}>
                    <Link to={`/receipt/${o.orderNumber}`}>
                      <button className="ghost">Receipt →</button>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
