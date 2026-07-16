import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useParams, Link } from 'react-router-dom';

import api from '../lib/api';
import { usePageEntrance, useCountUp } from '../lib/motion';

// ~374 KB of charting. Loading it lazily lets the Dashboard paint immediately,
// and a shop with no sales never downloads it at all.
const RevenueChart = lazy(() => import('../components/RevenueChart'));

// Ranges the shop owner can plot. The API widens the bucket (day -> week ->
// month) as the window grows, so a year doesn't render 365 spiky points.
const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 15, label: 'Last 15 days' },
  { days: 20, label: 'Last 20 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 60, label: 'Last 2 months' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last 1 year' },
];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN');

// "2h ago" / "3d ago" — order lists read better relative than absolute.
const ago = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function Dashboard() {
  const { storeId } = useParams();
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [days, setDays] = useState(14);
  const [chartLoading, setChartLoading] = useState(false);
  const [bucket, setBucket] = useState('day');
  const rootRef = usePageEntrance([!!data]);

  const revRef = useRef(null);
  const ordRef = useRef(null);
  const prodRef = useRef(null);
  const lowRef = useRef(null);

  useEffect(() => {
    api.get(`/stores/${storeId}/dashboard`).then((r) => setData(r.data));
  }, [storeId]);

  useEffect(() => {
    setChartLoading(true);
    api
      .get(`/stores/${storeId}/analytics/daily?days=${days}`)
      .then((r) => { setSeries(r.data.series); setBucket(r.data.bucket || 'day'); })
      .finally(() => setChartLoading(false));
  }, [storeId, days]);

  useCountUp(revRef, data?.today.revenue, { format: (v) => inr(v) });
  useCountUp(ordRef, data?.today.orders, { format: (v) => num(v) });
  useCountUp(prodRef, data?.totalProducts, { format: (v) => num(v) });
  useCountUp(lowRef, data?.lowStock?.length ?? 0, { format: (v) => num(v) });

  if (!data) {
    return (
      <div className="admin-page">
        <div className="admin-loading-card">
          <div className="skel skel-text" style={{ width: '48%' }} />
          <div className="skel skel-text" style={{ width: '76%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page" ref={rootRef}>
      <header className="admin-page-hero compact" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">Live analytics</span>
          <h1>Dashboard</h1>
          <p>Track revenue, order velocity, inventory pressure, and the products driving the last 30 days.</p>
        </div>
        <div className="hero-actions">
          <Link className="btn-v2 primary" to={`/admin/${storeId}/products`}>+ Add products</Link>
          <Link className="btn-v2" to={`/admin/${storeId}/orders`}>View orders</Link>
        </div>
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Today's revenue" refProp={revRef} fallback={inr(0)} to={`/admin/${storeId}/orders`} cta="See orders" />
        <Metric label="Today's orders" refProp={ordRef} fallback="0" to={`/admin/${storeId}/orders`} cta="See orders" />
        <Metric label="Active products" refProp={prodRef} fallback="0" to={`/admin/${storeId}/inventory`} cta="Inventory" />
        <Metric
          label="Low / out of stock"
          refProp={lowRef}
          fallback="0"
          tone={data.lowStock.length ? 'warn' : 'ok'}
          to={`/admin/${storeId}/inventory`}
          cta="Restock"
        />
      </section>

      <section className="admin-analytics-layout">
        <div className="admin-panel chart-panel" data-anim="fade-up">
          <div className="admin-panel-head chart-head">
            <div>
              <span>Revenue trend</span>
              <h2>{RANGES.find((r) => r.days === days)?.label || `Last ${days} days`}</h2>
            </div>
            <div className="chart-head-right">
              <strong>{inr(series.reduce((sum, day) => sum + Number(day.revenue || 0), 0))}</strong>
              <select
                className="chart-range"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                aria-label="Revenue trend range"
              >
                {RANGES.map((r) => (
                  <option key={r.days} value={r.days}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-chart-wrap">
            {chartLoading ? (
              <div className="chart-loading">Loading…</div>
            ) : series.some((d) => Number(d.revenue) > 0) ? (
              <Suspense fallback={<div className="chart-loading">Loading chart…</div>}>
                <RevenueChart series={series} bucket={bucket} />
              </Suspense>
            ) : (
              <div className="chart-empty">
                <strong>No sales in this period</strong>
                <span>Try a longer range, or your revenue trend will appear here after your first order.</span>
              </div>
            )}
          </div>
        </div>

        <div className="admin-panel insight-panel" data-anim="fade-up">
          <span>Operational focus</span>
          <h2>{data.lowStock.length ? 'Restock before peak hours' : 'Inventory looks healthy'}</h2>
          <p>
            {data.lowStock.length
              ? `${data.lowStock.length} products are below minimum stock. Prioritize top sellers first.`
              : 'No products are below their minimum stock threshold right now.'}
          </p>
        </div>
      </section>

      <section className="admin-panel recent-orders-panel" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>Activity</span>
            <h2>Recent orders</h2>
          </div>
          <Link className="btn-v2" to={`/admin/${storeId}/orders`}>All orders</Link>
        </div>
        {data.recentOrders?.length ? (
          <ul className="order-feed">
            {data.recentOrders.map((o) => (
              <li key={o.orderNumber}>
                <span className={`order-dot ${o.paymentStatus.toLowerCase()}`} />
                <div className="order-feed-main">
                  <span className="order-num">{o.orderNumber}</span>
                  <span className="order-time">{ago(o.createdAt)}</span>
                </div>
                <span className={`badge ${o.paymentStatus.toLowerCase()}`}>{o.paymentStatus}</span>
                <strong className="order-amt">{inr(o.totalAmount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No orders yet. Share your store's QR code to get the first one.</p>
        )}
      </section>

      <section className="admin-two-column">
        <DataPanel title="Top sellers (30 days)" empty="No sales yet." dataAnim="fade-up">
          {data.topProducts.length ? (
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Units</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {data.topProducts.map((product, index) => (
                  <tr key={`${product.name}-${index}`}>
                    <td>{product.name}</td>
                    <td>{product.unitsSold}</td>
                    <td>{inr(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataPanel>
        <DataPanel title="Low stock alerts" empty="All stocked up." dataAnim="fade-up">
          {data.lowStock.length ? (
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Stock</th><th>Min</th></tr>
              </thead>
              <tbody>
                {data.lowStock.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td><span className={`badge ${product.stockQuantity === 0 ? 'out' : 'low'}`}>{product.stockQuantity}</span></td>
                    <td>{product.minimumStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataPanel>

      </section>
    </div>
  );
}

function Metric({ label, refProp, fallback, tone, to, cta }) {
  const body = (
    <>
      <span>{label}</span>
      <strong ref={refProp}>{fallback}</strong>
      {cta && <em className="metric-cta">{cta} →</em>}
    </>
  );
  if (!to) {
    return (
      <div className={`admin-metric ${tone || ''}`} data-anim="stagger-child">{body}</div>
    );
  }
  return (
    <Link className={`admin-metric is-clickable ${tone || ''}`} data-anim="stagger-child" to={to}>
      {body}
    </Link>
  );
}

function DataPanel({ title, empty, children, dataAnim }) {
  const hasChildren = Boolean(children);
  return (
    <div className="admin-panel" data-anim={dataAnim}>
      <div className="admin-panel-head">
        <div>
          <span>Table</span>
          <h2>{title}</h2>
        </div>
      </div>
      {hasChildren ? children : <p className="muted">{empty}</p>}
    </div>
  );
}
