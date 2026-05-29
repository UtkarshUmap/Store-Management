import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmt = (d) => new Date(d).toLocaleString('en-IN');

export default function Orders() {
  const { storeId } = useParams();
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get(`/stores/${storeId}/orders`).then((r) => setOrders(r.data.orders));
  }, [storeId]);

  const rootRef = usePageEntrance([orders.length]);

  return (
    <div className="grid" ref={rootRef} style={{ gap: 20 }}>
      <h1 data-anim="fade-up">Orders</h1>
      <div className="card" data-anim="fade-up">
        <table>
          <thead>
            <tr><th>Order #</th><th>Time</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === o.id ? null : o.id)}>
                <td>{o.orderNumber}</td>
                <td className="muted">{fmt(o.createdAt)}</td>
                <td>{o.items.length}</td>
                <td>{inr(o.totalAmount)}</td>
                <td>{o.paymentMethod}</td>
                <td>
                  <span className={`badge ${o.paymentStatus === 'SUCCESS' ? 'ok' : o.paymentStatus === 'FAILED' ? 'out' : 'low'}`}>
                    {o.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={6} className="muted">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (() => {
        const o = orders.find((x) => x.id === open);
        return (
          <div className="card" data-anim="fade-up">
            <h3>{o.orderNumber}</h3>
            <table>
              <thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Total</th></tr></thead>
              <tbody>
                {o.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.productName}</td>
                    <td>{inr(it.unitPrice)}</td>
                    <td>{it.quantity}</td>
                    <td>{inr(it.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
