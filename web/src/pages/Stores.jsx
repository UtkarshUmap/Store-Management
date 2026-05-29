import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { usePageEntrance, attachTilt } from '../lib/motion';
import { formatINR } from '../lib/productPresentation';

export default function Stores() {
  const nav = useNavigate();
  const [stores, setStores] = useState([]);
  const [name, setName] = useState('');
  const [qr, setQr] = useState(null);
  const [creating, setCreating] = useState(false);

  const rootRef = usePageEntrance([stores.length]);
  const gridRef = useRef(null);

  const load = () => api.get('/stores').then((r) => setStores(r.data.stores));
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.admin-store-card');
    const detachers = [...cards].map((el) => attachTilt(el, { max: 2.8, scale: 1.006 }));
    return () => detachers.forEach((fn) => fn());
  }, [stores.length]);

  const portfolio = useMemo(() => stores.reduce(
    (acc, store) => {
      const stats = store.stats || {};
      acc.revenue += Number(stats.todayRevenue || 0);
      acc.orders += Number(stats.todayOrders || 0);
      acc.products += Number(stats.products || 0);
      acc.lowStock += Number(stats.lowStock || 0);
      return acc;
    },
    { revenue: 0, orders: 0, products: 0, lowStock: 0 }
  ), [stores]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/stores', { storeName: name });
      setName('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const showQr = async (store) => {
    const { data } = await api.get(`/stores/${store.id}/qr`);
    setQr({ ...data, name: store.storeName });
  };

  return (
    <div className="admin-page" ref={rootRef}>
      <header className="admin-page-hero" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">Store portfolio</span>
          <h1>Your retail network</h1>
          <p>Create storefronts, monitor daily performance, and open each store workspace from one polished command center.</p>
        </div>
        <div className="admin-create-panel">
          <label htmlFor="store-name">New store</label>
          <div>
            <input
              id="store-name"
              placeholder="Ex: Fresh Basket Bandra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <button className="btn-v2 primary" onClick={create} disabled={creating}>
              {creating ? 'Creating' : 'Create'}
            </button>
          </div>
        </div>
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Today revenue" value={formatINR(portfolio.revenue)} />
        <Metric label="Today orders" value={portfolio.orders.toLocaleString('en-IN')} />
        <Metric label="Products listed" value={portfolio.products.toLocaleString('en-IN')} />
        <Metric label="Low stock alerts" value={portfolio.lowStock.toLocaleString('en-IN')} tone={portfolio.lowStock ? 'warn' : 'ok'} />
      </section>

      <section ref={gridRef} className="admin-store-grid">
        {stores.map((store) => {
          const stats = store.stats || {};
          const hasLowStock = Number(stats.lowStock || 0) > 0;
          return (
            <article key={store.id} className="admin-store-card" data-anim="stagger-child">
              <div className="store-card-head">
                <div>
                  <span>/{store.storeSlug}</span>
                  <h2>{store.storeName}</h2>
                </div>
                <span className={`admin-status ${hasLowStock ? 'warn' : 'ok'}`}>
                  {hasLowStock ? `${stats.lowStock} low` : 'Healthy'}
                </span>
              </div>

              <div className="store-card-stats">
                <div>
                  <span>Revenue</span>
                  <strong>{formatINR(stats.todayRevenue)}</strong>
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{stats.todayOrders || 0}</strong>
                </div>
                <div>
                  <span>Products</span>
                  <strong>{stats.products || 0}</strong>
                </div>
              </div>

              <div className="store-card-actions">
                <button className="btn-v2 dark" onClick={() => nav(`/admin/${store.id}/dashboard`)}>
                  Open workspace
                </button>
                <button className="btn-v2 subtle" onClick={() => showQr(store)}>
                  QR code
                </button>
              </div>
            </article>
          );
        })}

        {!stores.length && (
          <div className="empty premium-empty" data-anim="fade-up">
            <div className="empty-icon">S</div>
            <h3>No stores yet</h3>
            <p>Create your first store and Storeapp will generate a QR storefront automatically.</p>
          </div>
        )}
      </section>

      {qr && <QrModal qr={qr} onClose={() => setQr(null)} />}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`admin-metric ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QrModal({ qr, onClose }) {
  const backdrop = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo(panel.current, { y: 24, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.45 }, '-=0.08');
    return () => tl.kill();
  }, []);

  const dismiss = () => {
    gsap
      .timeline({ onComplete: onClose })
      .to(panel.current, { y: 18, opacity: 0, scale: 0.98, duration: 0.2, ease: 'power3.in' })
      .to(backdrop.current, { opacity: 0, duration: 0.16 }, '-=0.12');
  };

  return (
    <div className="modal-backdrop" ref={backdrop} onClick={dismiss}>
      <div ref={panel} className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <span className="section-eyebrow">QR storefront</span>
        <h3>{qr.name}</h3>
        <img src={qr.qrCodeUrl} alt={`QR code for ${qr.name}`} />
        <a href={qr.storefrontUrl} target="_blank" rel="noreferrer">{qr.storefrontUrl}</a>
        <p>Print this code for the counter, shelves, receipts, or in-store posters.</p>
        <button className="btn-v2 subtle" onClick={dismiss}>Close</button>
      </div>
    </div>
  );
}
