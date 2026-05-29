import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../store';

export default function Landing() {
  const token = useAuth((s) => s.token);
  const nav = useNavigate();
  const rootRef = useRef(null);

  // Already signed in? Skip the landing.
  useEffect(() => {
    if (token) nav('/admin', { replace: true });
  }, [token, nav]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.lift-in', {
        y: '110%',
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
      });
      gsap.from('.fade-stagger', {
        y: 18,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.25,
      });
      gsap.from('.feature', {
        y: 28,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.4,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>
      {/* ============= Top nav ============= */}
      <nav className="topbar" style={{ position: 'static', borderBottom: '1px solid var(--line)' }}>
        <strong>🛒 StoreApp</strong>
        <div className="row" style={{ gap: 10 }}>
          <Link to="/login"><button className="ghost">Log in</button></Link>
          <Link to="/register"><button>Open a store</button></Link>
        </div>
      </nav>

      {/* ============= Hero ============= */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="blob" style={{ width: 520, height: 520, top: -160, right: -120, background: 'radial-gradient(circle, rgba(99,102,241,0.32), transparent 70%)' }} />
        <div className="blob" style={{ width: 380, height: 380, bottom: -120, left: -120, background: 'radial-gradient(circle, rgba(236,72,153,0.22), transparent 70%)' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: 80, paddingBottom: 80 }}>
          <span className="eyebrow fade-stagger">Storeapp · Built in India · QR-first</span>
          <h1 className="display-xl" style={{ marginTop: 18, maxWidth: 980 }}>
            <span className="line"><span className="lift-in">A shop in your</span></span>{' '}
            <span className="line"><em className="lift-in">pocket.</em></span>{' '}
            <span className="line"><span className="lift-in">Stock that</span></span>{' '}
            <span className="line"><em className="lift-in">can't oversell.</em></span>
          </h1>
          <p className="muted fade-stagger" style={{ marginTop: 22, maxWidth: 620, fontSize: 17, lineHeight: 1.55 }}>
            List your products. Print one QR. A walk-in customer scans, picks,
            and pays — Razorpay or cash. Every movement is logged, stock is
            atomic, and you see today's revenue tick up live.
          </p>
          <div className="row fade-stagger" style={{ gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
            <Link to="/shop"><button>Shop the catalogue →</button></Link>
            <Link to="/register"><button className="ghost">Open a store</button></Link>
            <Link to="/login"><button className="ghost">I already have an account</button></Link>
          </div>

          {/* Big inline stats */}
          <div
            className="fade-stagger"
            style={{
              marginTop: 60,
              display: 'grid',
              gap: 28,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))',
              borderTop: '1px solid var(--line)',
              paddingTop: 28,
            }}
          >
            <Stat n="01" big="Atomic" small="No overselling, ever. Conditional UPDATE on stock with audit log in the same transaction." />
            <Stat n="02" big="Razorpay" small="Live UPI / cards in INR. Cash flow also works end-to-end without keys." />
            <Stat n="03" big="Mobile" small="The whole storefront is built for a customer's phone — QR-scan to receipt." />
            <Stat n="04" big="Yours" small="Self-hostable. Open code. One container deploys API + SPA + Postgres." />
          </div>
        </div>
      </section>

      {/* ============= Marquee strip ============= */}
      <div className="dark-band" style={{ padding: '24px 0' }}>
        <div className="marquee" style={{ borderTop: 'none', borderBottom: 'none' }}>
          <div className="marquee-track">
            <span>Inventory</span>
            <span>QR storefront</span>
            <span>Atomic stock</span>
            <span>Razorpay + Cash</span>
            <span>Owner dashboard</span>
            <span>Low-stock alerts</span>
            <span>Inventory</span>
            <span>QR storefront</span>
            <span>Atomic stock</span>
            <span>Razorpay + Cash</span>
            <span>Owner dashboard</span>
            <span>Low-stock alerts</span>
          </div>
        </div>
      </div>

      {/* ============= Feature grid ============= */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <span className="eyebrow">What you get</span>
            <h2 className="display-serif" style={{ fontSize: 'clamp(34px, 5vw, 52px)', marginTop: 10 }}>
              The kit, end-to-end.
            </h2>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <Feature icon="📦" title="Product catalogue" body="Add products, categories, images, SKUs and barcodes. Soft-delete keeps history clean." />
          <Feature icon="🔁" title="Atomic stock" body="Conditional UPDATE with negative-stock guard. Audit-log row in the same transaction." />
          <Feature icon="📱" title="QR storefront" body="One printable QR. Customers scan, browse by category, search, add to cart, pay." />
          <Feature icon="💳" title="Razorpay + Cash" body="Online payments via Razorpay (INR) with HMAC verification, or cash flow without keys." />
          <Feature icon="📊" title="Live dashboard" body="Today's revenue, top sellers (30 days), low-stock list, 14-day revenue trend." />
          <Feature icon="🧾" title="Receipt + audit" body="Walk-in customers see a clean digital receipt. Every stock change is logged." />
        </div>
      </section>

      {/* ============= How it works ============= */}
      <section className="dark-band">
        <div className="container" style={{ position: 'relative' }}>
          <span className="eyebrow">How it works</span>
          <h2 className="display-serif" style={{ fontSize: 'clamp(34px, 5vw, 52px)', marginTop: 10, color: '#fff' }}>
            Three steps to live.
          </h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginTop: 40 }}>
            <Step n="01" title="Add products" body="Bulk-add or one-by-one, with categories, images and minimum-stock thresholds." />
            <Step n="02" title="Print the QR" body="Each store gets a unique printable QR. Stick it on the counter or shelf." />
            <Step n="03" title="Mind the shop" body="Customers scan and check out. You watch revenue, stock and orders live." />
          </div>
        </div>
      </section>

      {/* ============= Final CTA ============= */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 100, textAlign: 'center' }}>
        <h2 className="display-serif" style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>
          Ready when you are.
        </h2>
        <p className="muted" style={{ marginTop: 14, fontSize: 17 }}>
          The demo login works out of the box. Open a real store in under a minute.
        </p>
        <div className="row" style={{ gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/shop"><button>Browse the catalogue →</button></Link>
          <Link to="/register"><button className="ghost">Open a store</button></Link>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Storeapp · {new Date().getFullYear()} · Built with React, Express, Prisma, GSAP and Lenis.
      </footer>
    </div>
  );
}

function Stat({ n, big, small }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)' }}>
        / {n}
      </div>
      <div className="big-num" style={{ marginTop: 8 }}>{big}</div>
      <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, maxWidth: 260 }}>{small}</p>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="feature">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.16em' }}>
        / {n}
      </div>
      <h3 style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff' }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
