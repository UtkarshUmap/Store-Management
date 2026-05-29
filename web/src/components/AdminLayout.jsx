import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../store';

const navItems = [
  { label: 'Dashboard', path: 'dashboard', meta: 'Sales pulse' },
  { label: 'Products', path: 'products', meta: 'Catalog ops' },
  { label: 'Orders', path: 'orders', meta: 'Checkout desk' },
];

export default function AdminLayout() {
  const { storeId } = useParams();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const topbarRef = useRef(null);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(topbarRef.current, { y: -16, opacity: 0, duration: 0.55, ease: 'power3.out' });
      if (sidebarRef.current) {
        gsap.from(sidebarRef.current.querySelectorAll('a, .admin-sidebar-card'), {
          x: -14,
          opacity: 0,
          duration: 0.45,
          stagger: 0.06,
          ease: 'power3.out',
          delay: 0.12,
        });
      }
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
    nav('/login');
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar" ref={topbarRef}>
        <Link to="/admin" className="admin-brand" aria-label="Storeapp admin home">
          <span>S</span>
          <div>
            <strong>Storeapp</strong>
            <small>Retail command center</small>
          </div>
        </Link>

        <div className="admin-top-actions">
          <div className="admin-user-chip">
            <span>{user?.fullName?.slice(0, 1) || user?.email?.slice(0, 1) || 'A'}</span>
            <div>
              <strong>{user?.fullName || 'Admin'}</strong>
              <small>{user?.email}</small>
            </div>
          </div>
          <button className="btn-v2 subtle" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className={storeId ? 'admin-frame with-sidebar' : 'admin-frame'}>
        {storeId && (
          <aside className="admin-sidebar" ref={sidebarRef}>
            <div className="admin-sidebar-card">
              <span>Active workspace</span>
              <strong>Store operations</strong>
              <small>Inventory, orders, revenue</small>
            </div>

            <nav aria-label="Store admin navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/admin/${storeId}/${item.path}`}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <span>{item.label}</span>
                  <small>{item.meta}</small>
                </NavLink>
              ))}
              <NavLink to="/admin" end>
                <span>All stores</span>
                <small>Portfolio view</small>
              </NavLink>
            </nav>
          </aside>
        )}

        <main className="admin-main" ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
