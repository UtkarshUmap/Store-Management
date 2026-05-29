import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { usePageEntrance, attachTilt } from '../lib/motion';

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

  // Tilt on each store card.
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.card');
    const detachers = [...cards].map((el) => attachTilt(el, { max: 5, scale: 1.012 }));
    return () => detachers.forEach((fn) => fn());
  }, [stores.length]);

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
    <div className="grid" ref={rootRef} style={{ gap: 26 }}>
      <div className="row between" data-anim="fade-up">
        <h1>Your Stores</h1>
      </div>

      <div className="card row" data-anim="fade-up" style={{ gap: 12 }}>
        <input
          placeholder="New store name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button onClick={create} disabled={creating}>
          {creating ? 'Creating…' : 'Create store'}
        </button>
      </div>

      <div
        ref={gridRef}
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
      >
        {stores.map((s) => {
          const st = s.stats || {};
          return (
            <div
              key={s.id}
              className="card hover-lift grid"
              data-anim="stagger-child"
              style={{ gap: 12 }}
            >
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: 17, fontFamily: 'var(--font-display)' }}>
                    {s.storeName}
                  </strong>
                  <div className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2 }}>
                    /{s.storeSlug}
                  </div>
                </div>
                {st.lowStock > 0 && (
                  <span className="stat-pill warn">⚠ {st.lowStock} low</span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  padding: '12px 0',
                  borderTop: '1px dashed var(--line)',
                  borderBottom: '1px dashed var(--line)',
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Today's revenue
                  </div>
                  <div className="stat" style={{ fontSize: 22 }}>
                    ₹{Number(st.todayRevenue || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Today's orders
                  </div>
                  <div className="stat" style={{ fontSize: 22 }}>{st.todayOrders || 0}</div>
                </div>
              </div>

              <div className="row" style={{ gap: 8, marginTop: 2 }}>
                <span className="stat-pill muted">{st.products || 0} products</span>
              </div>

              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <button onClick={() => nav(`/admin/${s.id}/dashboard`)}>Open →</button>
                <button className="secondary" onClick={() => showQr(s)}>
                  QR code
                </button>
              </div>
            </div>
          );
        })}
        {!stores.length && (
          <div className="empty" data-anim="fade-up">
            <div className="empty-icon">🏬</div>
            <h3>No stores yet</h3>
            <p>Create your first store above. We'll generate a printable QR.</p>
          </div>
        )}
      </div>

      {qr && <QrModal qr={qr} onClose={() => setQr(null)} />}
    </div>
  );
}

function QrModal({ qr, onClose }) {
  const backdrop = useRef(null);
  const panel = useRef(null);
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo(
        panel.current,
        { y: 30, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5 },
        '-=0.1'
      );
    return () => tl.kill();
  }, []);

  const dismiss = () => {
    gsap
      .timeline({ onComplete: onClose })
      .to(panel.current, { y: 18, opacity: 0, scale: 0.96, duration: 0.22, ease: 'power3.in' })
      .to(backdrop.current, { opacity: 0, duration: 0.18 }, '-=0.15');
  };

  return (
    <div className="modal-backdrop" ref={backdrop} onClick={dismiss}>
      <div
        ref={panel}
        className="card grid"
        style={{ width: 380, textAlign: 'center', gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{qr.name}</h3>
        <img
          src={qr.qrCodeUrl}
          alt="QR"
          style={{ width: '100%', borderRadius: 14, background: '#fff', padding: 12 }}
        />
        <a href={qr.storefrontUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {qr.storefrontUrl}
        </a>
        <p className="muted" style={{ fontSize: 13 }}>
          Print this and stick it on the counter. Customers scan to shop.
        </p>
        <button className="ghost" onClick={dismiss}>
          Close
        </button>
      </div>
    </div>
  );
}
