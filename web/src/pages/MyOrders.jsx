// CUSTOMER DASHBOARD — every past shopping trip: which store, what was bought,
// full billing breakdown, payment state, and the receipt.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { formatINR } from '../lib/productPresentation';

const fmt = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
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
      gsap.from('[data-anim="fade-up"]', { y: 16, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out' });
      gsap.from('.customer-order-card', { y: 16, opacity: 0, duration: 0.42, stagger: 0.05, ease: 'power3.out', delay: 0.1 });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  // Lifetime totals across every store the customer has shopped at.
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.paymentStatus === 'SUCCESS');
    const spent = paid.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const items = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);
    const stores = new Set(orders.map((o) => o.store?.storeName).filter(Boolean));
    return { count: orders.length, spent, items, stores: stores.size };
  }, [orders]);

  return (
    <div className="customer-page" ref={rootRef}>
      <section className="customer-hero" data-anim="fade-up">
        <span className="section-eyebrow">Your account</span>
        <h1>Your orders</h1>
        <p>Every shop you've visited, what you bought, and the full bill.</p>
      </section>

      {!loading && orders.length > 0 && (
        <section className="cust-stats" data-anim="fade-up">
          <div><span>Orders</span><strong>{stats.count}</strong></div>
          <div><span>Items bought</span><strong>{stats.items}</strong></div>
          <div><span>Total spent</span><strong>{formatINR(stats.spent)}</strong></div>
          <div><span>Stores</span><strong>{stats.stores}</strong></div>
        </section>
      )}

      {loading ? (
        <div className="customer-order-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="customer-order-card">
              <div className="skel skel-text" style={{ width: '60%' }} />
              <div className="skel skel-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty premium-empty" data-anim="fade-up">
          <div className="empty-icon">0</div>
          <h3>No orders yet</h3>
          <p>Scan a shop's QR code to start shopping. Your orders will appear here.</p>
        </div>
      ) : (
        <div className="customer-order-list">
          {orders.map((order) => {
            const open = openId === order.id;
            const units = order.items.reduce((n, i) => n + i.quantity, 0);
            const tone =
              order.paymentStatus === 'SUCCESS' ? 'success' : order.paymentStatus === 'FAILED' ? 'failed' : 'pending';

            return (
              <article key={order.id} className={`customer-order-card ${open ? 'open' : ''}`}>
                <button className="cust-order-head" onClick={() => setOpenId(open ? null : order.id)}>
                  <div className="cust-order-store">
                    <span className="cust-store-badge">
                      {(order.store?.storeName || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{order.store?.storeName || 'Store'}</strong>
                      <span className="cust-order-num">{order.orderNumber}</span>
                      <span className="cust-order-date">
                        {fmt(order.createdAt)} · {units} item{units > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="cust-order-right">
                    <strong>{formatINR(order.totalAmount)}</strong>
                    <span className={`badge ${tone}`}>{order.paymentStatus}</span>
                    <span className="cust-chevron">{open ? '▲' : '▼'}</span>
                  </div>
                </button>

                {open && (
                  <div className="cust-order-detail">
                    <table className="cust-bill">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Price</th>
                          <th>Qty</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((it) => (
                          <tr key={it.id}>
                            <td>{it.productName}</td>
                            <td>{formatINR(it.unitPrice)}</td>
                            <td>{it.quantity}</td>
                            <td>{formatINR(it.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="cust-bill-summary">
                      <div><span>Subtotal</span><span>{formatINR(order.subtotal ?? order.totalAmount)}</span></div>
                      {Number(order.taxAmount) > 0 && (
                        <div><span>Tax</span><span>{formatINR(order.taxAmount)}</span></div>
                      )}
                      {Number(order.discountAmount) > 0 && (
                        <div><span>Discount</span><span>− {formatINR(order.discountAmount)}</span></div>
                      )}
                      <div className="cust-bill-total">
                        <span>Total paid</span>
                        <strong>{formatINR(order.totalAmount)}</strong>
                      </div>
                      <div className="cust-bill-meta">
                        <span>Payment</span>
                        <span>{order.paymentMethod} · {order.paymentStatus}</span>
                      </div>
                    </div>

                    <Link to={`/receipt/${order.orderNumber}`} className="btn-v2 subtle cust-receipt-btn">
                      View receipt
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
