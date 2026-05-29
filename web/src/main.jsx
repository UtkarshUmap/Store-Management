import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'lenis/dist/lenis.css';
import './styles.css';
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
import Orders from './pages/Orders';
import Storefront from './pages/Storefront';
import Receipt from './pages/Receipt';
import Shop from './pages/Shop';
import MyOrders from './pages/MyOrders';
import ShopLayout from './components/ShopLayout';

function RequireRole({ children, roles }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && user && !roles.includes(user.role)) {
    // Logged in but wrong role: send them to their natural home.
    const home = user.role === 'CUSTOMER' ? '/shop' : '/admin';
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

function App() {
  const { token, setUser, logout } = useAuth();

  useEffect(() => {
    startLenis();
    return () => stopLenis();
  }, []);

  useEffect(() => {
    if (token) {
      api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => logout());
    }
  }, [token]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Customer-facing public catalog + per-store storefront */}
        <Route element={<ShopLayout />}>
          <Route path="/shop" element={<Shop />} />
          <Route path="/store/:slug" element={<Storefront />} />
        </Route>

        {/* Logged-in customer's order history */}
        <Route
          path="/my/orders"
          element={
            <RequireRole roles={['CUSTOMER', 'STORE_OWNER', 'SUPER_ADMIN', 'STAFF']}>
              <ShopLayout />
            </RequireRole>
          }
        >
          <Route index element={<MyOrders />} />
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
