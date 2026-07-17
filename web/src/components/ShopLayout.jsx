// CUSTOMER SHELL — the chrome wrapped around every shopper screen.
// Desktop: a sticky white header with pill nav. Phone: the same header plus a
// thumb-reachable bottom tab bar, so the flow reads like a native app instead
// of a website. Both share one cart indicator.
import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth, useCart } from '../store';

const initials = (name = '', email = '') => {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

export default function ShopLayout() {
  const { user, logout, token } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const cart = useCart();

  const topRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(topRef.current, { y: -16, opacity: 0, duration: 0.5, ease: 'power3.out' });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
    return () => {
      // Killing the tween mid-flight leaves the inline opacity:0 it had just
      // set, which blanks the whole page. Always restore visibility on cleanup.
      tween.kill();
      gsap.set(el, { clearProps: 'transform,opacity' });
    };
  }, [loc.pathname]);

  const onLogout = () => {
    logout();
    nav('/');
  };

  const cartCount = cart.count();
  const onHome = loc.pathname === '/my';
  const onOrders = loc.pathname.startsWith('/my/orders');

  return (
    <div className="cx-shell">
      {/* The canopy edge of the whole app — green/marigold awning stripe. */}
      <div className="cx-topline" aria-hidden />
      <header className="shop-top" ref={topRef}>
        <Link to={token ? '/my' : '/'} className="shop-brand">
          <span className="brand-mark" aria-hidden>✦</span>
          <span>Storeapp</span>
        </Link>

        <nav className="shop-nav">
          {token && (
            <>
              <NavLink to="/my" end className={({ isActive }) => (isActive ? 'active' : '')}>
                Home
              </NavLink>
              <NavLink to="/my/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
                My orders
              </NavLink>
            </>
          )}
        </nav>

        <div className="shop-actions">
          {cartCount > 0 && (
            <span className="cart-pill" aria-label={`${cartCount} items in cart`}>
              <span aria-hidden>🛒</span> {cartCount}
            </span>
          )}
          {token ? (
            <>
              <span className="cx-user">
                <span className="cx-user-name">{user?.fullName || user?.email}</span>
                <span className="cx-avatar" aria-hidden>
                  {initials(user?.fullName, user?.email)}
                </span>
              </span>
              <button className="cx-logout" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login"><button className="cx-logout">Log in</button></Link>
              <Link to="/register"><button className="sp-add">SIGN UP</button></Link>
            </>
          )}
        </div>
      </header>

      <main ref={mainRef}>
        <Outlet />
      </main>

      <footer className="shop-foot">
        <span>Storeapp · {new Date().getFullYear()}</span>
        <span>
          <Link to="/admin">For shopkeepers →</Link>
        </span>
      </footer>

      {/* Phone-only bottom nav. Scan is the middle tab because it's the single
          action that starts every shopping trip. */}
      {token && (
        <nav className="cx-tabbar" aria-label="Primary">
          <Link to="/my" className={`cx-tab ${onHome ? 'active' : ''}`}>
            <em aria-hidden>⌂</em>
            <span>Home</span>
          </Link>
          <Link to="/my?scan=1" className="cx-tab">
            <em aria-hidden>⧉</em>
            <span>Scan</span>
          </Link>
          <Link to="/my/orders" className={`cx-tab ${onOrders ? 'active' : ''}`}>
            <em aria-hidden>≡</em>
            <span>Orders</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
