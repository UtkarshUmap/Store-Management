import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth, useCart } from '../store';

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
    if (!mainRef.current) return;
    const tween = gsap.fromTo(
      mainRef.current,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }
    );
    return () => tween.kill();
  }, [loc.pathname]);

  const onLogout = () => {
    logout();
    nav('/');
  };

  const cartCount = cart.count();

  return (
    <div>
      <header className="shop-top" ref={topRef}>
        <Link to="/" className="shop-brand">
          <span className="brand-mark" aria-hidden>✦</span>
          <span>Storeapp</span>
        </Link>

        <nav className="shop-nav">
          <NavLink to="/shop" className={({ isActive }) => (isActive ? 'active' : '')}>
            Shop
          </NavLink>
          {token && (
            <NavLink to="/my/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
              My orders
            </NavLink>
          )}
        </nav>

        <div className="shop-actions">
          {cartCount > 0 && (
            <span className="cart-pill" aria-label={`${cartCount} items in cart`}>
              🛒 {cartCount}
            </span>
          )}
          {token ? (
            <>
              <span className="muted shop-user">{user?.fullName || user?.email}</span>
              <button className="ghost" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login"><button className="ghost">Log in</button></Link>
              <Link to="/register"><button>Sign up</button></Link>
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
    </div>
  );
}
