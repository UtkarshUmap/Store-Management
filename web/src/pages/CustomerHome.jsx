// CUSTOMER HOME — the shopper's dashboard. Welcome + scan a shop's QR to start
// shopping + a record of every shop they've visited and what they spent.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../store';
import { formatINR } from '../lib/productPresentation';
import BarcodeScanner from '../components/BarcodeScanner';

const ago = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
};

// The QR encodes the storefront URL — pull the slug out of whatever we scanned.
function slugFromScan(text) {
  const t = (text || '').trim();
  const m = t.match(/\/store\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // A bare slug also works, so a printed code without the full URL still scans.
  if (/^[A-Za-z0-9_-]+$/.test(t)) return t;
  return null;
}

export default function CustomerHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    api
      .get('/me/orders')
      .then((r) => setOrders(r.data.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // The phone tab bar links to /my?scan=1 — honour it, then drop the param so a
  // back-navigation doesn't reopen the camera.
  useEffect(() => {
    if (params.get('scan') !== '1') return;
    setScanErr('');
    setScanning(true);
    params.delete('scan');
    setParams(params, { replace: true });
  }, [params, setParams]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.paymentStatus === 'SUCCESS');
    const spent = paid.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const items = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);

    // "Most loved" = the product bought most often across every shop.
    const byProduct = new Map();
    for (const o of orders) {
      for (const i of o.items) {
        const cur = byProduct.get(i.productName) || { name: i.productName, qty: 0, spent: 0 };
        cur.qty += i.quantity;
        cur.spent += Number(i.totalPrice || 0);
        byProduct.set(i.productName, cur);
      }
    }
    const favourites = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // How they actually pay, so the dashboard reflects real habits.
    const pay = { CASH: 0, RAZORPAY: 0 };
    for (const o of orders) if (pay[o.paymentMethod] !== undefined) pay[o.paymentMethod] += 1;

    const pending = orders.filter((o) => o.paymentStatus === 'PENDING');
    const avg = paid.length ? spent / paid.length : 0;

    return { orders: orders.length, spent, items, favourites, pay, pending, avg };
  }, [orders]);

  // Every shop they've bought from, most recent first.
  const shops = useMemo(() => {
    const bySlug = new Map();
    for (const o of orders) {
      const s = o.store;
      if (!s?.storeSlug) continue;
      const cur = bySlug.get(s.storeSlug) || {
        ...s, visits: 0, spent: 0, last: o.createdAt,
      };
      cur.visits += 1;
      cur.spent += Number(o.totalAmount || 0);
      if (new Date(o.createdAt) > new Date(cur.last)) cur.last = o.createdAt;
      bySlug.set(s.storeSlug, cur);
    }
    return [...bySlug.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
  }, [orders]);

  const onScan = (text) => {
    const slug = slugFromScan(text);
    setScanning(false);
    if (!slug) {
      setScanErr("That doesn't look like a shop QR code. Try again.");
      return;
    }
    setScanErr('');
    nav(`/store/${slug}`);
  };

  const firstName = (user?.fullName || '').split(' ')[0] || 'there';

  return (
    <div className="cust-home" ref={rootRef}>
      <header className="cust-welcome" data-anim="fade-up">
        <span className="section-eyebrow">Welcome back</span>
        <h1>Hi, {firstName}.</h1>
        <p>Scan a shop's QR code to see what's on their shelves and start filling your cart.</p>
      </header>

      {/* The primary action — everything starts with a scan. */}
      <section className="scan-card" data-anim="fade-up">
        <div className="scan-card-art" aria-hidden="true">
          <div className="scan-frame">
            <span /><span /><span /><span />
            <div className="scan-line" />
          </div>
        </div>
        <div className="scan-card-copy">
          <h2>Scan a shop QR</h2>
          <p>Point your camera at the QR code at the counter. You'll see that shop's products by category.</p>
          {scanErr && <div className="error">{scanErr}</div>}
          <button className="btn-v2 primary scan-btn" onClick={() => { setScanErr(''); setScanning(true); }}>
            <span aria-hidden>⧉</span> Open scanner
          </button>
        </div>
      </section>

      {scanning && <BarcodeScanner onDetected={onScan} onClose={() => setScanning(false)} />}

      {!loading && orders.length > 0 && (
        <section className="cust-stats" data-anim="fade-up">
          <div><span>Orders</span><strong>{stats.orders}</strong></div>
          <div><span>Items bought</span><strong>{stats.items}</strong></div>
          <div><span>Total spent</span><strong>{formatINR(stats.spent)}</strong></div>
          <div><span>Shops visited</span><strong>{shops.length}</strong></div>
        </section>
      )}

      {shops.length > 0 && (
        <section className="cust-section" data-anim="fade-up">
          <div className="cust-section-head">
            <h2>Shops you've visited</h2>
            <span className="cust-sub">{shops.length} shop{shops.length > 1 ? 's' : ''}</span>
          </div>
          <div className="shop-cards">
            {shops.map((s) => (
              <Link className="shop-card" to={`/store/${s.storeSlug}`} key={s.storeSlug}>
                <span className="shop-card-badge">{s.storeName.slice(0, 1).toUpperCase()}</span>
                <div className="shop-card-body">
                  <strong>{s.storeName}</strong>
                  <span>{s.city || 'Local shop'} · last visit {ago(s.last)}</span>
                  <span className="shop-card-meta">
                    {s.visits} order{s.visits > 1 ? 's' : ''} · {formatINR(s.spent)} spent
                  </span>
                </div>
                <span className="shop-card-go">Shop again →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stats.favourites.length > 0 && (
        <section className="cust-section" data-anim="fade-up">
          <div className="cust-section-head">
            <h2>What you buy most</h2>
            <span className="cust-sub">Across every shop</span>
          </div>
          <div className="fav-list">
            {stats.favourites.map((f, i) => (
              <div className="fav-row" key={f.name}>
                <span className="fav-rank">{i + 1}</span>
                <div className="fav-info">
                  <strong>{f.name}</strong>
                  <span>{f.qty} bought · {formatINR(f.spent)} spent</span>
                </div>
                <div className="fav-bar">
                  <i style={{ width: `${Math.round((f.qty / stats.favourites[0].qty) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="cust-section" data-anim="fade-up">
          <div className="cust-section-head">
            <h2>Payments</h2>
            <span className="cust-sub">How you pay</span>
          </div>
          <div className="pay-cards">
            <div className="pay-card">
              <span className="pay-ico">💵</span>
              <div><strong>{stats.pay.CASH}</strong><span>Cash on pickup</span></div>
            </div>
            <div className="pay-card">
              <span className="pay-ico">💳</span>
              <div><strong>{stats.pay.RAZORPAY}</strong><span>Paid online</span></div>
            </div>
            <div className="pay-card">
              <span className="pay-ico">📊</span>
              <div><strong>{formatINR(stats.avg)}</strong><span>Average order</span></div>
            </div>
            <div className={`pay-card ${stats.pending.length ? 'warn' : ''}`}>
              <span className="pay-ico">{stats.pending.length ? '⏳' : '✅'}</span>
              <div>
                <strong>{stats.pending.length}</strong>
                <span>{stats.pending.length ? 'Payment pending' : 'All settled'}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="cust-section" data-anim="fade-up">
        <div className="cust-section-head">
          <h2>Recent orders</h2>
          {orders.length > 0 && <Link to="/my/orders" className="cust-seeall">See all →</Link>}
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="empty premium-empty">
            <div className="empty-icon">✦</div>
            <h3>No orders yet</h3>
            <p>Scan a shop's QR code to start your first order. Everything you buy will be tracked here.</p>
          </div>
        ) : (
          <ul className="order-feed">
            {orders.slice(0, 5).map((o) => {
              const units = o.items.reduce((n, i) => n + i.quantity, 0);
              const tone = o.paymentStatus === 'SUCCESS' ? 'success' : o.paymentStatus === 'FAILED' ? 'failed' : 'pending';
              return (
                <li key={o.id}>
                  <span className={`order-dot ${tone}`} />
                  <div className="order-feed-main">
                    <span className="order-num">{o.store?.storeName || 'Shop'} · {o.orderNumber}</span>
                    <span className="order-time">{ago(o.createdAt)} · {units} item{units > 1 ? 's' : ''}</span>
                  </div>
                  <strong className="order-amt">{formatINR(o.totalAmount)}</strong>
                  <Link className="btn-v2 subtle" to={`/receipt/${o.orderNumber}`}>Receipt</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
