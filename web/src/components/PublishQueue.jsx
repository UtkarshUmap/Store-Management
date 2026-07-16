// Review drawer: the products the owner picked from the catalog, grouped by
// category, where he sets the FINAL selling price + the stock he actually has,
// then adds them to his inventory. A cramped side panel couldn't fit these
// fields legibly, so this is a full-width sheet.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

export default function PublishQueue({ storeId, items, onChange, onRemove, onClear, onClose, onPublished }) {
  const [publishing, setPublishing] = useState(false);
  const [err, setErr] = useState('');

  // Close on Escape — it's a modal sheet.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !publishing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, publishing]);

  // Group by category so the review reads the same way the inventory will.
  const groups = useMemo(() => {
    const byCat = new Map();
    for (const it of items) {
      const key = it.product.categoryName || 'Uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(it);
    }
    return [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const missingPrice = items.filter((i) => i.price === '' || Number(i.price) <= 0).length;

  const publish = async () => {
    setErr('');
    if (missingPrice > 0) {
      setErr(`Set a price for ${missingPrice} product${missingPrice > 1 ? 's' : ''} first.`);
      return;
    }
    setPublishing(true);
    try {
      // One request for the whole batch — posting per-product meant a network
      // round trip each, so adding 20 items took 20x longer than it needed to.
      await api.post(`/catalog/stores/${storeId}/from-catalog/bulk`, {
        items: items.map((it) => ({
          masterProductId: it.product.id,
          price: Number(it.price),
          stockQuantity: Number(it.stock || 0),
          minimumStock: Number(it.minStock || 5),
        })),
      });
      onPublished && onPublished();
      onClear();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not add these products. Please try again.');
      onPublished && onPublished();
    } finally {
      setPublishing(false);
    }
  };

  const total = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.stock || 0), 0);

  return (
    <div className="pq-sheet-backdrop" onClick={() => !publishing && onClose()}>
      <div className="pq-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="pq-sheet-head">
          <div>
            <span>Review &amp; price</span>
            <h2>{items.length} product{items.length > 1 ? 's' : ''} to add</h2>
          </div>
          <button className="pq-sheet-close" onClick={onClose} disabled={publishing} aria-label="Close">×</button>
        </header>

        {err && <div className="error pq-sheet-msg">{err}</div>}
        {!err && missingPrice > 0 && (
          <div className="pq-hint pq-sheet-msg">
            {missingPrice} product{missingPrice > 1 ? 's' : ''} still need{missingPrice > 1 ? '' : 's'} a selling price.
          </div>
        )}

        <div className="pq-sheet-body">
          {groups.map(([cat, rows]) => (
            <div className="pq-cat" key={cat}>
              <div className="pq-cat-head">
                <h3>{cat}</h3>
                <span>{rows.length}</span>
              </div>

              <table className="pq-table">
                <thead>
                  <tr>
                    <th className="pq-c-prod">Product</th>
                    <th>Selling price</th>
                    <th>Stock you have</th>
                    <th>Low-stock alert</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => {
                    const needsPrice = it.price === '' || Number(it.price) <= 0;
                    return (
                      <tr key={it.product.id} className={needsPrice ? 'needs-price' : ''}>
                        <td className="pq-c-prod">
                          <div className="pq-prod">
                            <img
                              src={it.product.imageUrl || ''}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            />
                            <div>
                              <strong>{it.product.name}</strong>
                              <span>
                                {it.product.brand ? `${it.product.brand}` : ''}
                                {it.product.brand && it.product.unit ? ' · ' : ''}
                                {it.product.unit || ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Selling price">
                          <div className="pq-money">
                            <span>₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={it.price}
                              onChange={(e) => onChange(it.product.id, { price: e.target.value })}
                            />
                          </div>
                        </td>
                        <td data-label="Stock you have">
                          <input
                            className="pq-num"
                            type="number"
                            min="0"
                            value={it.stock}
                            onChange={(e) => onChange(it.product.id, { stock: e.target.value })}
                          />
                        </td>
                        <td data-label="Low-stock alert">
                          <input
                            className="pq-num"
                            type="number"
                            min="0"
                            value={it.minStock}
                            onChange={(e) => onChange(it.product.id, { minStock: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            className="pq-remove"
                            onClick={() => onRemove(it.product.id)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <footer className="pq-sheet-foot">
          <div className="pq-sheet-total">
            <span>Stock value</span>
            <strong>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="pq-sheet-actions">
            <button className="btn-v2 subtle" onClick={onClear} disabled={publishing}>Clear all</button>
            <button className="btn-v2 primary" onClick={publish} disabled={publishing}>
              {publishing ? 'Adding…' : `Add ${items.length} to inventory`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
