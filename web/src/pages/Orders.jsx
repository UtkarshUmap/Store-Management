import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';
import { formatINR } from '../lib/productPresentation';

const fmt = (date) => new Date(date).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function Orders() {
  const { storeId } = useParams();
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get(`/stores/${storeId}/orders`).then((r) => setOrders(r.data.orders));
  }, [storeId]);

  const rootRef = usePageEntrance([orders.length, filter]);

  const visibleOrders = useMemo(() => (
    filter === 'ALL' ? orders : orders.filter((order) => order.paymentStatus === filter)
  ), [orders, filter]);

  const summary = useMemo(() => ({
    revenue: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    success: orders.filter((order) => order.paymentStatus === 'SUCCESS').length,
    pending: orders.filter((order) => order.paymentStatus === 'PENDING').length,
    failed: orders.filter((order) => order.paymentStatus === 'FAILED').length,
  }), [orders]);

  const selected = orders.find((order) => order.id === open);

  return (
    <div className="admin-page" ref={rootRef}>
      <header className="admin-page-hero compact" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">Order operations</span>
          <h1>Orders</h1>
          <p>Review payments, item counts, order totals, and line items from one focused operations queue.</p>
        </div>
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Total revenue" value={formatINR(summary.revenue)} />
        <Metric label="Successful" value={summary.success} tone="ok" />
        <Metric label="Pending" value={summary.pending} tone={summary.pending ? 'warn' : ''} />
        <Metric label="Failed" value={summary.failed} tone={summary.failed ? 'danger' : ''} />
      </section>

      <section className="admin-panel" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>Queue</span>
            <h2>{visibleOrders.length} orders</h2>
          </div>
          <div className="segmented-control" aria-label="Filter orders">
            {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table order-table">
            <thead>
              <tr><th>Order</th><th>Time</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className={open === order.id ? 'selected' : ''}
                  onClick={() => setOpen(open === order.id ? null : order.id)}
                >
                  <td><strong>{order.orderNumber}</strong></td>
                  <td className="muted">{fmt(order.createdAt)}</td>
                  <td>{order.items.length}</td>
                  <td>{formatINR(order.totalAmount)}</td>
                  <td>{order.paymentMethod}</td>
                  <td>
                    <span className={`badge ${order.paymentStatus === 'SUCCESS' ? 'ok' : order.paymentStatus === 'FAILED' ? 'out' : 'low'}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {!visibleOrders.length && (
                <tr><td colSpan={6} className="muted">No orders match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="admin-panel order-detail-panel" data-anim="fade-up">
          <div className="admin-panel-head">
            <div>
              <span>Order detail</span>
              <h2>{selected.orderNumber}</h2>
            </div>
            <strong>{formatINR(selected.totalAmount)}</strong>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Total</th></tr></thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{formatINR(item.unitPrice)}</td>
                    <td>{item.quantity}</td>
                    <td>{formatINR(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`admin-metric ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
