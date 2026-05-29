import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmt = (d) => new Date(d).toLocaleString('en-IN');

export default function Receipt() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const cardRef = useRef(null);
  const checkRef = useRef(null);

  useEffect(() => {
    api
      .get(`/public/order/${orderNumber}`)
      .then((r) => setOrder(r.data.order))
      .catch(() => setErr('Not found'));
  }, [orderNumber]);

  useEffect(() => {
    if (!order || !cardRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      cardRef.current,
      { y: 30, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.55 }
    );
    if (checkRef.current) {
      tl.fromTo(
        checkRef.current,
        { scale: 0, rotate: -45 },
        { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2)' },
        '-=0.25'
      );
    }
    return () => tl.kill();
  }, [order]);

  if (err) {
    return (
      <div className="center">
        <div className="empty" style={{ maxWidth: 360 }}>
          <div className="empty-icon">🧾</div>
          <h3>Receipt not found</h3>
          <p>That order number doesn't exist.</p>
          <div style={{ marginTop: 14 }}>
            <Link to="/"><button className="ghost">Back home</button></Link>
          </div>
        </div>
      </div>
    );
  }
  if (!order) return <div className="center"><p className="muted">Loading…</p></div>;

  const itemsCount = order.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <div className="center" style={{ padding: '40px 16px' }}>
      <div
        ref={cardRef}
        className="card grid printable"
        style={{ width: 420, gap: 16, padding: 28 }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            ref={checkRef}
            style={{
              fontSize: 28,
              display: 'inline-grid',
              placeItems: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: order.paymentStatus === 'SUCCESS' ? 'var(--green-soft)' : 'var(--amber-soft)',
              color: order.paymentStatus === 'SUCCESS' ? 'var(--green)' : 'var(--amber)',
            }}
          >
            {order.paymentStatus === 'SUCCESS' ? '✓' : '⏳'}
          </div>
          <h2 className="display-serif" style={{ margin: '14px 0 4px', fontSize: 32 }}>
            {order.paymentStatus === 'SUCCESS' ? 'Order confirmed' : 'Payment pending'}
          </h2>
          <span className="muted">{order.store?.storeName}</span>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 6,
            background: 'var(--bg)',
            padding: 14,
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          <div className="row between">
            <span className="muted">Order #</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</strong>
          </div>
          <div className="row between">
            <span className="muted">Placed</span>
            <span>{fmt(order.createdAt)}</span>
          </div>
          <div className="row between">
            <span className="muted">Items</span>
            <span>{itemsCount}</span>
          </div>
          <div className="row between">
            <span className="muted">Payment</span>
            <span className={`badge ${order.paymentStatus === 'SUCCESS' ? 'ok' : 'low'}`}>
              {order.paymentMethod} · {order.paymentStatus}
            </span>
          </div>
        </div>

        <div className="grid" style={{ gap: 6, marginTop: 4 }}>
          {order.items.map((it) => (
            <div key={it.id} className="row between" style={{ fontSize: 14 }}>
              <span>{it.productName} × {it.quantity}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{inr(it.totalPrice)}</span>
            </div>
          ))}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />
        <div className="row between" style={{ fontSize: 18 }}>
          <strong>Total</strong>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{inr(order.totalAmount)}</strong>
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
          {order.paymentMethod === 'CASH'
            ? 'Please pay cash at the counter.'
            : 'Show this screen at the counter.'}
        </p>

        <div className="row" style={{ gap: 8 }}>
          <button className="secondary" style={{ flex: 1 }} onClick={() => window.print()}>
            Print receipt
          </button>
          <Link to="/" style={{ flex: 1 }}>
            <button className="ghost" style={{ width: '100%' }}>Done</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
