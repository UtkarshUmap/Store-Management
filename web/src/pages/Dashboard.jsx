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

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="grid" ref={rootRef} style={{ gap: 22 }}>
      <h1 data-anim="fade-up">Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
        <div className="card hover-lift" data-anim="stagger-child">
          <div className="muted">Today's revenue</div>
          <div className="stat" ref={revRef}>{inr(0)}</div>
        </div>
        <div className="card hover-lift" data-anim="stagger-child">
          <div className="muted">Today's orders</div>
          <div className="stat" ref={ordRef}>0</div>
        </div>
        <div className="card hover-lift" data-anim="stagger-child">
          <div className="muted">Active products</div>
          <div className="stat" ref={prodRef}>0</div>
        </div>
        <div className="card hover-lift" data-anim="stagger-child">
          <div className="muted">Low / out of stock</div>
          <div
            className="stat"
            ref={lowRef}
            style={{
              background: data.lowStock.length
                ? 'linear-gradient(135deg, #b45309, #dc2626)'
                : 'linear-gradient(135deg, var(--ink), #4338ca)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            0
          </div>
        </div>
      </div>

      <div className="card" data-anim="fade-up">
        <h3>Revenue (last 14 days)</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} stroke="#9aa1ad" />
              <YAxis fontSize={12} stroke="#9aa1ad" />
              <Tooltip formatter={(v) => inr(v)} contentStyle={{ border: '1px solid #e6e8ef', borderRadius: 10 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#revGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card" data-anim="fade-up">
          <h3>Low stock alerts</h3>
          {data.lowStock.length ? (
            <table>
              <thead>
                <tr><th>Product</th><th>Stock</th><th>Min</th></tr>
              </thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <span className={`badge ${p.stockQuantity === 0 ? 'out' : 'low'}`}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td>{p.minimumStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">All stocked up 🎉</p>
          )}
        </div>

        <div className="card" data-anim="fade-up">
          <h3>Top sellers (30 days)</h3>
          {data.topProducts.length ? (
            <table>
              <thead>
                <tr><th>Product</th><th>Units</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.unitsSold}</td>
                    <td>{inr(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No sales yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
