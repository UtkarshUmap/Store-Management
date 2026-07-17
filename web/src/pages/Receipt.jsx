import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import api from '../lib/api';
import { formatINR } from '../lib/productPresentation';

const fmt = (date) => new Date(date).toLocaleString('en-IN');

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
    tl.fromTo(cardRef.current, { y: 30, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.55 });
    if (checkRef.current) {
      tl.fromTo(checkRef.current, { scale: 0, rotate: -35 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2)' }, '-=0.25');
    }
    return () => tl.kill();
  }, [order]);

  if (err) {
    return (
      <div className="receipt-page">
        <div className="empty premium-empty">
          <div className="empty-icon">R</div>
          <h3>Receipt not found</h3>
          <p>That order number does not exist.</p>
          <Link to="/"><button className="btn-v2 subtle">Back home</button></Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="receipt-page">
        <div className="receipt-card"><p className="muted">Loading receipt...</p></div>
      </div>
    );
  }

  const itemsCount = order.items.reduce((count, item) => count + item.quantity, 0);
  const success = order.paymentStatus === 'SUCCESS';

  return (
    <div className="receipt-page">
      <div ref={cardRef} className="receipt-card printable">
        {/* Inked at an angle, like the shopkeeper actually stamped it.
        <div className={`rc-stamp ${success ? '' : 'pending'}`} aria-hidden>
          {success ? 'Paid' : 'Pay at till'}
        </div> */}
        <div className="receipt-status">
          <div ref={checkRef} className={success ? 'success' : 'pending'}>
            {success ? '✓' : '!'}
          </div>
          <span className="section-eyebrow">Digital receipt</span>
          <h1>{success ? 'Order confirmed' : 'Payment pending'}</h1>
          <p>{order.store?.storeName}</p>
        </div>

        {/* Where the order actually is. "Confirmed" alone leaves the shopper
            guessing what happens next; three states answer it. */}
        <div className="cx-steps">
          <div className="cx-step done">
            <i aria-hidden>✓</i>
            <span>Placed</span>
          </div>
          <div className={`cx-step ${success ? 'done' : ''}`}>
            <i aria-hidden>{success ? '✓' : '2'}</i>
            <span>{success ? 'Confirmed' : 'Awaiting payment'}</span>
          </div>
          <div className="cx-step">
            <i aria-hidden>3</i>
            <span>Collect at counter</span>
          </div>
        </div>

        <div className="receipt-summary">
          <Line label="Order" value={order.orderNumber} mono />
          <Line label="Placed" value={fmt(order.createdAt)} />
          <Line label="Items" value={itemsCount} />
          <div className="receipt-summary-row">
            <span>Payment</span>
            <strong><span className={`badge ${success ? 'ok' : 'low'}`}>{order.paymentMethod} · {order.paymentStatus}</span></strong>
          </div>
        </div>

        <div className="receipt-items">
          {order.items.map((item) => (
            <div key={item.id}>
              <span>{item.productName} x {item.quantity}</span>
              <strong>{formatINR(item.totalPrice)}</strong>
            </div>
          ))}
        </div>

        <div className="receipt-total">
          <span>Total</span>
          <strong>{formatINR(order.totalAmount)}</strong>
        </div>

        <p className="receipt-note">
          {order.paymentMethod === 'CASH'
            ? 'Please pay cash at the counter.'
            : 'Show this screen at the counter.'}
        </p>

        {/* Decorative barcode — the chit the counter recognises. */}
        <div className="rc-barcode" aria-hidden />
        <span className="rc-code">{order.orderNumber}</span>

        <div className="receipt-actions">
          <button className="btn-v2 primary" onClick={() => window.print()}>Print receipt</button>
          <Link to="/my"><button className="btn-v2 subtle">Done</button></Link>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, mono }) {
  return (
    <div className="receipt-summary-row">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  );
}
