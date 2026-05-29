import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { formatINR } from '../lib/productPresentation';

const fmt = (date) => new Date(date).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
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
      gsap.from('[data-anim="fade-up"]', { y: 18, opacity: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out' });
      gsap.from('.customer-order-card', { y: 18, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', delay: 0.12 });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  return (
    <div className="customer-page" ref={rootRef}>
      <section className="customer-hero" data-anim="fade-up">
        <span className="section-eyebrow">Account orders</span>
        <h1>Your order history</h1>
        <p>Track every order, payment state, and receipt from the stores you shop with.</p>
      </section>

      {loading ? (
        <div className="customer-order-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="customer-order-card">
              <div className="skel skel-text" style={{ width: '60%' }} />
              <div className="skel skel-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty premium-empty" data-anim="fade-up">
          <div className="empty-icon">0</div>
          <h3>No orders yet</h3>
          <p>Start shopping and your orders will appear here.</p>
          <Link to="/shop"><button className="btn-v2 primary">Browse catalog</button></Link>
        </div>
      ) : (
        <div className="customer-order-list">
          {orders.map((order) => (
            <article key={order.id} className="customer-order-card">
              <div className="customer-order-main">
                <div>
                  <span>{order.store?.storeName || 'Store'}</span>
                  <h2>{order.orderNumber}</h2>
                  <p>{fmt(order.createdAt)}</p>
                </div>
                <strong>{formatINR(order.totalAmount)}</strong>
              </div>
              <div className="customer-order-items">
                {order.items.slice(0, 3).map((item) => `${item.productName} x ${item.quantity}`).join(' · ')}
                {order.items.length > 3 ? ` · +${order.items.length - 3} more` : ''}
              </div>
              <div className="customer-order-footer">
                <span className={`badge ${order.paymentStatus === 'SUCCESS' ? 'ok' : order.paymentStatus === 'FAILED' ? 'out' : 'low'}`}>
                  {order.paymentMethod} · {order.paymentStatus}
                </span>
                <Link to={`/receipt/${order.orderNumber}`}>
                  <button className="btn-v2 subtle">Receipt</button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
