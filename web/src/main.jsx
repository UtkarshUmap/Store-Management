import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'lenis/dist/lenis.css';
import './styles.css';

import './customer.css';
import api from './lib/api';
import { useAuth } from './store';
import { startLenis, stopLenis, scrollTo } from './lib/motion';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLayout from './components/AdminLayout';
import Stores from './pages/Stores';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Storefront from './pages/Storefront';
import Receipt from './pages/Receipt';
import MyOrders from './pages/MyOrders';
import CustomerHome from './pages/CustomerHome';
import ShopLayout from './components/ShopLayout';

const SHOPPER_ROLES = ['CUSTOMER', 'STORE_OWNER', 'SUPER_ADMIN', 'STAFF'];

function RequireRole({ children, roles }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && user && !roles.includes(user.role)) {
    // Logged in but wrong role: send them to their natural home.
    const home = user.role === 'CUSTOMER' ? '/my' : '/admin';
    return <Navigate to={home} replace />;
  }
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    scrollTo(0, { immediate: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function AppLoader() {
  return (
    <div className="app-boot">
      <div className="app-boot-mark">✦</div>
      <span className="app-boot-name">Storeapp</span>
      <div className="app-boot-bar"><i /></div>
    </div>
  );
}

function App() {
  const { token, setUser, logout } = useAuth();
  // Hold the first paint until we know who the user is — otherwise a role-guarded
  // route can flash the wrong screen (or bounce to /login) before /auth/me lands.
  const [booting, setBooting] = useState(!!token);

  useEffect(() => {
    startLenis();
    return () => stopLenis();
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    setBooting(true);
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => logout())
      .finally(() => setBooting(false));
  }, [token]);

  if (booting) return <AppLoader />;

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Scanning a shop's QR is deliberately OPEN — a walk-in browses and
            fills a cart with no account. The login is asked for once, at
            checkout, so the order can be tied to them (see CheckoutModal). The
            cart survives that round trip because it's persisted. */}
        <Route path="/store/:slug" element={<ShopLayout />}>
          <Route index element={<Storefront />} />
        </Route>

        {/* Customer dashboard: scan a shop, past shops, orders */}
        <Route
          path="/my"
          element={
            <RequireRole roles={SHOPPER_ROLES}>
              <ShopLayout />
            </RequireRole>
          }
        >
          <Route index element={<CustomerHome />} />
          <Route path="orders" element={<MyOrders />} />
        </Route>

        {/* Receipt is public so a fresh QR walk-in can see it without logging in. */}
        <Route path="/receipt/:orderNumber" element={<Receipt />} />

        {/* Admin (shop-owner) */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={['STORE_OWNER', 'SUPER_ADMIN', 'STAFF']}>
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<Stores />} />
          <Route path=":storeId/dashboard" element={<Dashboard />} />
          <Route path=":storeId/products" element={<Products />} />
          <Route path=":storeId/inventory" element={<Inventory />} />
          <Route path=":storeId/orders" element={<Orders />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
