import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { useAuth } from '../store';

const ROLE_HOME = {
  CUSTOMER: '/my',
  STORE_OWNER: '/admin',
  STAFF: '/admin',
  SUPER_ADMIN: '/admin',
};

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const setAuth = useAuth((s) => s.setAuth);

  const [tab, setTab] = useState('CUSTOMER'); // visual only
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const formCardRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.headline-stack .line > *', {
        y: '110%', opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
      });
      gsap.from('.split-stage .eyebrow, .split-stage .ticker-row, .split-stage .marquee', {
        y: 14, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, delay: 0.25,
      });
      gsap.fromTo(
        formCardRef.current,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.15 }
      );
    });
    return () => ctx.revert();
  }, []);

  // When the tab changes, prefill the demo creds (owner) or clear (customer).
  useEffect(() => {
    if (tab === 'STORE_OWNER') setForm({ email: 'owner@demo.com', password: 'password123' });
    else setForm({ email: '', password: '' });
  }, [tab]);

  const submit = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setAuth(data.token, data.user);
      const back = loc.state?.from?.pathname;
      const home = back || ROLE_HOME[data.user.role] || '/';
      nav(home, { replace: true });
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isOwner = tab === 'STORE_OWNER';

  return (
    <div className="split">
      <aside className="split-stage">
        <div>
          <Link to="/" className="stage-brand">✦ Storeapp</Link>
          <div style={{ height: 32 }} />
          <span className="eyebrow">
            {isOwner ? 'Shop-owner login' : 'Customer login'}
          </span>
          <div style={{ height: 22 }} />
          <div className="headline-stack">
            <span className="line"><span className="display-xl">Welcome</span></span>
            <span className="line"><span className="display-xl"><em>back.</em></span></span>
          </div>
          <p className="muted" style={{ marginTop: 22, maxWidth: 460, lineHeight: 1.55 }}>
            {isOwner
              ? 'Mind the shop — today\'s revenue, low-stock alerts, top sellers of the last 30 days, every sale logged.'
              : 'Pick up where you left off — your basket, your orders, your favourite local shops.'}
          </p>

          <div className="stack" aria-hidden="true" style={{ marginTop: 32 }}>
            {isOwner ? (
              <>
                <StackRow title="Today's revenue" meta="updated · just now" value="₹4,820" />
                <StackRow title="Orders" meta="Cash + Razorpay" value="38" />
                <StackRow title="Low stock" meta="2 items need restock" value="2" warn />
              </>
            ) : (
              <>
                <StackRow title="Kurkure Masala 90g" meta="Snacks · in stock" value="₹20" />
                <StackRow title="Coca-Cola 750ml" meta="Drinks · in stock" value="₹40" />
                <StackRow title="Dairy Milk 50g" meta="Snacks · in stock" value="₹45" />
              </>
            )}
          </div>
        </div>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {(isOwner ? ['Owners dashboard', 'Atomic stock', 'Razorpay live', 'Audit-trail'] : ['Local shops', 'Live stock', 'Order online', 'Pay at counter']).concat(['Storeapp', 'Storeapp']).map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
        </div>
      </aside>

      <section className="split-form">
        <div ref={formCardRef} className="card" style={{ display: 'grid', gap: 14 }}>
          <span className="section-num"><span>00</span>Log in</span>
          <h2 className="display-serif" style={{ fontSize: 40, margin: 0 }}>
            Sign back in.
          </h2>

          <div className="role-tabs">
            <button
              className={tab === 'CUSTOMER' ? 'role-tab active' : 'role-tab'}
              onClick={() => setTab('CUSTOMER')}
              type="button"
            >Customer</button>
            <button
              className={tab === 'STORE_OWNER' ? 'role-tab active' : 'role-tab'}
              onClick={() => setTab('STORE_OWNER')}
              type="button"
            >Shop owner</button>
          </div>

          <div className="grid" style={{ gap: 12 }}>
            <input
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {err && <div className="error">{err}</div>}
            <button onClick={submit} disabled={loading}>
              {loading ? 'Signing in…' : 'Log in →'}
            </button>
            <div className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
              New here? <Link to="/register">Create an account</Link>
            </div>
          </div>

          {isOwner && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0 4px' }} />
              <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                DEMO · owner@demo.com / password123
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function StackRow({ title, meta, value, warn }) {
  return (
    <div className="stack-row ticker-row">
      <div>
        <strong>{title}</strong>
        <div className="meta">{meta}</div>
      </div>
      <span className="price" style={warn ? { color: '#f59e0b' } : undefined}>{value}</span>
    </div>
  );
}
