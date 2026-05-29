import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import api from '../lib/api';
import { usePageEntrance, useCountUp } from '../lib/motion';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN');

export default function Dashboard() {
  const { storeId } = useParams();
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const rootRef = usePageEntrance([!!data]);

  const revRef = useRef(null);
  const ordRef = useRef(null);
  const prodRef = useRef(null);
  const lowRef = useRef(null);

  useEffect(() => {
    api.get(`/stores/${storeId}/dashboard`).then((r) => setData(r.data));
    api.get(`/stores/${storeId}/analytics/daily?days=14`).then((r) => setSeries(r.data.series));
  }, [storeId]);

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
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Today's revenue" refProp={revRef} fallback={inr(0)} />
        <Metric label="Today's orders" refProp={ordRef} fallback="0" />
        <Metric label="Active products" refProp={prodRef} fallback="0" />
        <Metric label="Low / out of stock" refProp={lowRef} fallback="0" tone={data.lowStock.length ? 'warn' : 'ok'} />
      </section>

      <section className="admin-analytics-layout">
        <div className="admin-panel chart-panel" data-anim="fade-up">
          <div className="admin-panel-head">
            <div>
              <span>Revenue trend</span>
              <h2>Last 14 days</h2>
            </div>
            <strong>{inr(series.reduce((sum, day) => sum + Number(day.revenue || 0), 0))}</strong>
          </div>
          <div className="admin-chart-wrap">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f7a55" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#0f7a55" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,31,25,0.09)" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} stroke="#60706a" />
                <YAxis fontSize={12} stroke="#60706a" />
                <Tooltip formatter={(v) => inr(v)} contentStyle={{ border: '1px solid rgba(10,31,25,0.12)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="#0f7a55" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
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

      <section className="admin-two-column">
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
      </section>
    </div>
  );
}

function Metric({ label, refProp, fallback, tone }) {
  return (
    <div className={`admin-metric ${tone || ''}`} data-anim="stagger-child">
      <span>{label}</span>
      <strong ref={refProp}>{fallback}</strong>
    </div>
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
