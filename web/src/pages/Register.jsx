import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { useAuth } from '../store';

const ROLE_HOME = { CUSTOMER: '/my', STORE_OWNER: '/admin' };

export default function Register() {
  const nav = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [role, setRole] = useState('CUSTOMER');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.headline-stack .line > *', { y: '110%', opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 });
      gsap.from('.stack-row, .split-stage .eyebrow, .split-stage .marquee', { y: 14, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06, delay: 0.25 });
      gsap.fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.15 });
    });
    return () => ctx.revert();
  }, []);

  const submit = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { ...form, role });
      setAuth(data.token, data.user);
      nav(ROLE_HOME[data.user.role] || '/', { replace: true });
    } catch (e) {
      setErr(e.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isOwner = role === 'STORE_OWNER';

  return (
    <div className="split">
      <aside className="split-stage">
        <div>
          <Link to="/" className="stage-brand">✦ Storeapp</Link>
          <div style={{ height: 32 }} />
          <span className="eyebrow">{isOwner ? 'For shopkeepers' : 'For customers'}</span>
          <div style={{ height: 22 }} />
          <div className="headline-stack">
            {isOwner ? (
              <>
                <span className="line"><span className="display-xl">Open shop</span></span>
                <span className="line"><span className="display-xl"><em>in minutes.</em></span></span>
              </>
            ) : (
              <>
                <span className="line"><span className="display-xl">Shop the</span></span>
                <span className="line"><span className="display-xl"><em>neighbourhood.</em></span></span>
              </>
            )}
          </div>
          <p className="muted" style={{ marginTop: 22, maxWidth: 460, lineHeight: 1.55 }}>
            {isOwner
              ? "List products, print one QR. Walk-in customers scan and shop. Stock is atomic, every movement logged."
              : "Browse what local stores have in stock right now. Order online or scan the QR at the counter."}
          </p>

          <div className="stack" aria-hidden="true">
            <div className="stack-row"><div><strong>Lays Classic 52g</strong><div className="meta">SNACKS · #LAY-CLS-52</div></div><span className="price">₹20</span></div>
            <div className="stack-row"><div><strong>Coca-Cola 750ml</strong><div className="meta">DRINKS · #CC-750</div></div><span className="price">₹40</span></div>
            <div className="stack-row"><div><strong>Dairy Milk 50g</strong><div className="meta">SNACKS · #DM-050</div></div><span className="price">₹45</span></div>
          </div>
        </div>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {['Storeapp', 'Atomic stock', 'Razorpay + Cash', 'Local shops', 'Storeapp', 'Atomic stock', 'Razorpay + Cash', 'Local shops'].map((w, i) => <span key={i}>{w}</span>)}
          </div>
        </div>
      </aside>

      <section className="split-form">
        <div ref={cardRef} className="card" style={{ display: 'grid', gap: 14 }}>
          <span className="section-num"><span>01</span>Create your account</span>
          <h2 className="display-serif" style={{ fontSize: 40, margin: 0 }}>
            {isOwner ? 'Start your store.' : 'Join Storeapp.'}
          </h2>

          <div className="role-tabs">
            <button className={role === 'CUSTOMER' ? 'role-tab active' : 'role-tab'} onClick={() => setRole('CUSTOMER')} type="button">Customer</button>
            <button className={role === 'STORE_OWNER' ? 'role-tab active' : 'role-tab'} onClick={() => setRole('STORE_OWNER')} type="button">Shop owner</button>
          </div>

          <div className="grid" style={{ gap: 12 }}>
            <input placeholder="Full name" value={form.fullName} onChange={upd('fullName')} autoComplete="name" />
            <input placeholder="Email" type="email" value={form.email} onChange={upd('email')} autoComplete="email" />
            <input placeholder="Phone (optional)" inputMode="tel" value={form.phone} onChange={upd('phone')} autoComplete="tel" />
            <input type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={upd('password')} autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {err && <div className="error">{err}</div>}
            <button onClick={submit} disabled={loading}>{loading ? 'Creating…' : `Create ${isOwner ? 'shop-owner' : 'customer'} account →`}</button>
            <div className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
              Already have one? <Link to="/login">Log in</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
