import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../store';

export default function AdminLayout() {
  const { storeId } = useParams();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const topbarRef = useRef(null);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  // Entrance: topbar drops in, sidebar slides from left, main fades up.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(topbarRef.current, {
        y: -24,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      });
      if (sidebarRef.current) {
        gsap.from(sidebarRef.current.querySelectorAll('a'), {
          x: -16,
          opacity: 0,
          duration: 0.5,
          stagger: 0.06,
          ease: 'power3.out',
          delay: 0.15,
        });
      }
    });
    return () => ctx.revert();
  }, []);

  // Fade main on route change inside the admin layout.
  useEffect(() => {
    if (!mainRef.current) return;
    const tween = gsap.fromTo(
      mainRef.current,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform' }
    );
    return () => tween.kill();
  }, [loc.pathname]);

  return (
    <div>
      <div className="topbar" ref={topbarRef}>
        <strong>🛒 StoreApp Admin</strong>
        <div className="row">
          <span className="muted">{user?.email}</span>
          <button
            className="ghost"
            onClick={() => {
              logout();
              nav('/login');
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <div
        className="container"
        style={{
          display: 'grid',
          gridTemplateColumns: storeId ? '220px 1fr' : '1fr',
          gap: 28,
        }}
      >
        {storeId && (
          <nav className="sidebar" ref={sidebarRef}>
            <NavLink to={`/admin/${storeId}/dashboard`} className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </NavLink>
            <NavLink to={`/admin/${storeId}/products`} className={({ isActive }) => (isActive ? 'active' : '')}>
              Products
            </NavLink>
            <NavLink to={`/admin/${storeId}/orders`} className={({ isActive }) => (isActive ? 'active' : '')}>
              Orders
            </NavLink>
            <NavLink to="/admin" end>
              ← All stores
            </NavLink>
          </nav>
        )}
        <main ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
