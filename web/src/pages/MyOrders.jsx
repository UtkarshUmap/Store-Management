// CUSTOMER DASHBOARD — every past shopping trip: which store, what was bought,
// full billing breakdown, payment state, and the receipt.
//
// v2 design notes:
// * Orders are grouped by MONTH on a timeline rail — history should read like
//   a story, not a flat list.
// * Every class is `mo-*` (my-orders). The legacy `.customer-*` rules in
//   styles.css fought the redesign (the global `button` rule even painted the
//   store name white-on-white), so this page opts out of them entirely.
// * The expanded bill is drawn as a thermal receipt — perforated edges, mono
//   digits — because that's the physical object a bill maps to in your head.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { formatINR } from '../lib/productPresentation';

const fmtDay = (date) =>
  new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short' });

const fmtTime = (date) =>
  new Date(date).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });

const monthKey = (date) =>
  new Date(date).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

const STATUS = {
  SUCCESS: { label: 'Paid', tone: 'ok' },
  PENDING: { label: 'Pay at counter', tone: 'wait' },
  FAILED: { label: 'Failed', tone: 'bad' },
};

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'SUCCESS', label: 'Paid' },
  { id: 'PENDING', label: 'Pending' },
];

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api
      .get('/me/orders')
      .then((r) => setOrders(r.data.orders))
      .finally(() => setLoading(false));
  }, []);

  // Lifetime totals across every store the customer has shopped at.
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.paymentStatus === 'SUCCESS');
    const spent = paid.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const items = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);
    const stores = new Set(orders.map((o) => o.store?.storeName).filter(Boolean));
    return { count: orders.length, spent, items, stores: stores.size };
  }, [orders]);

  const counts = useMemo(
    () => ({
      ALL: orders.length,
      SUCCESS: orders.filter((o) => o.paymentStatus === 'SUCCESS').length,
      PENDING: orders.filter((o) => o.paymentStatus === 'PENDING').length,
    }),
    [orders]
  );

  // Filter, then bucket into months (orders arrive newest-first from the API,
  // but sort defensively so the timeline can't jumble).
  const months = useMemo(() => {
    const list = orders
      .filter((o) => filter === 'ALL' || o.paymentStatus === filter)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const buckets = new Map();
    for (const o of list) {
      const key = monthKey(o.createdAt);
      if (!buckets.has(key)) buckets.set(key, { key, orders: [], spent: 0 });
      const b = buckets.get(key);
      b.orders.push(o);
      b.spent += Number(o.totalAmount || 0);
    }
    return [...buckets.values()];
  }, [orders, filter]);

  return (
    <div className="mo-page">
      <header className="mo-head" data-anim="fade-up">
        <div>
          <span className="mo-eyebrow">Your account</span>
          <h1>Order history</h1>
          <p>Every shop you've visited, what you bought, and the full bill.</p>
        </div>
        <Link to="/my" className="mo-scan-cta">
          <span aria-hidden>⧉</span> Scan &amp; shop
        </Link>
      </header>

      {/* One ledger strip instead of four floating boxes — reads like a
          statement summary. */}
      {!loading && orders.length > 0 && (
        <section className="mo-ledger" data-anim="fade-up">
          <div>
            <span>Orders</span>
            <strong>{stats.count}</strong>
          </div>
          <div>
            <span>Items bought</span>
            <strong>{stats.items}</strong>
          </div>
          <div>
            <span>Total spent</span>
            <strong>{formatINR(stats.spent)}</strong>
          </div>
          <div>
            <span>Shops</span>
            <strong>{stats.stores}</strong>
          </div>
        </section>
      )}

      {!loading && orders.length > 0 && (
        <div className="mo-filters" data-anim="fade-up" role="tablist" aria-label="Filter orders">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`mo-filter ${filter === f.id ? 'active' : ''}`}
              onClick={() => { setFilter(f.id); setOpenId(null); }}
            >
              {f.label}
              <em>{counts[f.id]}</em>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mo-month-body">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mo-card mo-skel">
              <div className="skel skel-text" style={{ width: '55%' }} />
              <div className="skel skel-text" style={{ width: '35%' }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty premium-empty" data-anim="fade-up">
          <div className="empty-icon">✦</div>
          <h3>No orders yet</h3>
          <p>Scan a shop's QR code to start shopping. Your orders will appear here.</p>
        </div>
      ) : months.length === 0 ? (
        <div className="empty premium-empty" data-anim="fade-up">
          <div className="empty-icon">0</div>
          <h3>Nothing here</h3>
          <p>No {filter === 'PENDING' ? 'pending' : 'paid'} orders right now.</p>
        </div>
      ) : (
        months.map((m) => (
          <section className="mo-month" key={m.key}>
            <div className="mo-month-label">
              <h2>{m.key}</h2>
              <span>
                {m.orders.length} order{m.orders.length > 1 ? 's' : ''} · {formatINR(m.spent)}
              </span>
            </div>

            <div className="mo-month-body">
              {m.orders.map((order) => {
                const open = openId === order.id;
                const units = order.items.reduce((n, i) => n + i.quantity, 0);
                const status = STATUS[order.paymentStatus] || STATUS.PENDING;
                const preview = order.items
                  .slice(0, 3)
                  .map((i) => i.productName)
                  .join(', ');
                const more = order.items.length - 3;

                return (
                  <article key={order.id} className={`mo-card ${open ? 'open' : ''}`}>
                    <span className="mo-dot" aria-hidden />

                    <button
                      className="mo-card-head"
                      onClick={() => setOpenId(open ? null : order.id)}
                      aria-expanded={open}
                    >
                      <span className="mo-badge">
                        {(order.store?.storeName || '?').slice(0, 1).toUpperCase()}
                      </span>

                      <span className="mo-id">
                        <strong>{order.store?.storeName || 'Store'}</strong>
                        <span className="mo-items" title={preview}>
                          {preview}
                          {more > 0 ? ` +${more} more` : ''}
                        </span>
                        <span className="mo-meta">
                          <code>{order.orderNumber}</code>
                          <i aria-hidden>·</i>
                          {fmtDay(order.createdAt)}, {fmtTime(order.createdAt)}
                          <i aria-hidden>·</i>
                          {units} item{units > 1 ? 's' : ''}
                        </span>
                      </span>

                      <span className="mo-right">
                        <strong className="mo-amt">{formatINR(order.totalAmount)}</strong>
                        <span className={`mo-pill ${status.tone}`}>{status.label}</span>
                      </span>

                      <span className="mo-chev" aria-hidden>▾</span>
                    </button>

                    {open && (
                      <div className="mo-detail">
                        <div className="mo-receipt">
                          <div className="mo-receipt-rows">
                            {order.items.map((it) => (
                              <div className="mo-receipt-row" key={it.id}>
                                <span className="mo-r-name">
                                  {it.productName}
                                  <small>{formatINR(it.unitPrice)} × {it.quantity}</small>
                                </span>
                                <span className="mo-r-amt">{formatINR(it.totalPrice)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mo-receipt-sum">
                            <div>
                              <span>Subtotal</span>
                              <span>{formatINR(order.subtotal ?? order.totalAmount)}</span>
                            </div>
                            {Number(order.taxAmount) > 0 && (
                              <div>
                                <span>Tax</span>
                                <span>{formatINR(order.taxAmount)}</span>
                              </div>
                            )}
                            {Number(order.discountAmount) > 0 && (
                              <div className="mo-r-save">
                                <span>Discount</span>
                                <span>− {formatINR(order.discountAmount)}</span>
                              </div>
                            )}
                            <div className="mo-r-total">
                              <span>Total {order.paymentStatus === 'SUCCESS' ? 'paid' : 'to pay'}</span>
                              <strong>{formatINR(order.totalAmount)}</strong>
                            </div>
                            <div className="mo-r-pay">
                              <span>
                                {order.paymentMethod === 'CASH' ? '💵 Cash on pickup' : '💳 Paid online'}
                              </span>
                              <span className={`mo-pill ${status.tone}`}>{status.label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mo-actions">
                          <Link to={`/receipt/${order.orderNumber}`} className="mo-btn">
                            View receipt
                          </Link>
                          {order.store?.storeSlug && (
                            <Link to={`/store/${order.store.storeSlug}`} className="mo-btn ghost">
                              Shop again →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}