// INVENTORY — the shopkeeper's view of everything actually in HIS shop.
// Deliberately separate from the "Products" (add) page: adding and managing are
// different jobs, and cramming both into one screen made the list unusable.
// Category-grouped, searchable, with inline price/stock editing and restock.
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';
import { formatINR, getProductImage } from '../lib/productPresentation';

export default function Inventory() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [view, setView] = useState('all'); // all | low | out
  const [err, setErr] = useState('');

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ price: '', stockQuantity: 0, minimumStock: 5, categoryId: '' });
  const [saving, setSaving] = useState(false);
  const [restockId, setRestockId] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  // 'low' | 'out' -> which stock-alert popup is open
  const [alert, setAlert] = useState(null);

  const rootRef = usePageEntrance([products.length]);

  const load = () => {
    Promise.all([
      api.get(`/stores/${storeId}/products`),
      api.get(`/stores/${storeId}/categories`),
    ])
      .then(([p, c]) => {
        setProducts(p.data.products);
        setCategories(c.data.categories);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [storeId]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.isActive !== false);
    const low = active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock).length;
    const out = active.filter((p) => p.stockQuantity === 0).length;
    const value = active.reduce((s, p) => s + Number(p.price || 0) * Number(p.stockQuantity || 0), 0);
    return { count: active.length, low, out, value };
  }, [products]);

  // Filter, then group under category headings.
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (p.isActive === false) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      if (activeCat !== 'all' && (p.categoryId || 'none') !== activeCat) return false;
      if (view === 'low' && !(p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock)) return false;
      if (view === 'out' && p.stockQuantity !== 0) return false;
      return true;
    });

    const byCat = new Map();
    for (const p of rows) {
      const key = p.category?.name || 'Uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    }
    return [...byCat.entries()]
      .sort(([a], [b]) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
      .map(([name, items]) => ({ name, items: items.slice().sort((x, y) => x.name.localeCompare(y.name)) }));
  }, [products, q, activeCat, view]);

  const shown = grouped.reduce((n, g) => n + g.items.length, 0);

  // Alert popups always show the whole shop, not whatever the page is filtered
  // to — otherwise clicking "Low stock: 5" could show fewer than 5 items.
  const alertItems = useMemo(() => {
    const active = products.filter((p) => p.isActive !== false);
    const rows =
      alert === 'low'
        ? active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock)
        : alert === 'out'
        ? active.filter((p) => p.stockQuantity === 0)
        : [];
    return rows.sort((a, b) => a.stockQuantity - b.stockQuantity);
  }, [products, alert]);

  const startEdit = (p) => {
    setRestockId(null);
    setEditId(p.id);
    setEditForm({
      price: p.price ?? '',
      stockQuantity: p.stockQuantity ?? 0,
      minimumStock: p.minimumStock ?? 5,
      categoryId: p.categoryId || '',
    });
  };

  const saveEdit = async (id) => {
    setErr('');
    setSaving(true);
    try {
      await api.put(`/stores/${storeId}/products/${id}`, {
        price: Number(editForm.price || 0),
        stockQuantity: Number(editForm.stockQuantity || 0),
        minimumStock: Number(editForm.minimumStock || 0),
        categoryId: editForm.categoryId || null,
      });
      setEditId(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not update this product.');
    } finally {
      setSaving(false);
    }
  };

  const doRestock = async (id) => {
    const qty = Number(restockQty);
    if (!qty || qty <= 0) return setErr('Enter a quantity greater than zero.');
    setErr('');
    try {
      await api.post(`/stores/${storeId}/products/${id}/restock`, { quantity: qty });
      setRestockId(null);
      setRestockQty('');
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Restock failed.');
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from your shop? Past orders keep their record.`)) return;
    try {
      await api.delete(`/stores/${storeId}/products/${p.id}`);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not remove this product.');
    }
  };

  const upd = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });

  return (
    <div className="admin-page" ref={rootRef}>
      <header className="admin-page-hero compact" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">Your shelf</span>
          <h1>Inventory</h1>
          <p>Everything currently in your shop — prices, stock levels and restocks, grouped by category.</p>
        </div>
        <div className="hero-actions">
          <Link className="btn-v2 primary" to={`/admin/${storeId}/products`}>+ Add products</Link>
        </div>
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Products in shop" value={stats.count} />
        <Metric label="Stock value" value={formatINR(stats.value)} />
        <Metric
          label="Low stock"
          value={stats.low}
          tone={stats.low ? 'warn' : 'ok'}
          onClick={stats.low ? () => setAlert('low') : undefined}
        />
        <Metric
          label="Out of stock"
          value={stats.out}
          tone={stats.out ? 'warn' : 'ok'}
          onClick={stats.out ? () => setAlert('out') : undefined}
        />
      </section>

      <section className="admin-panel" data-anim="fade-up">
        <div className="inv-toolbar">
          <div className="shop-search inv-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search your products…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button className="shop-search-clear" onClick={() => setQ('')}>×</button>}
          </div>
          <div className="inv-views">
            {[
              ['all', 'All'],
              ['low', `Low (${stats.low})`],
              ['out', `Out (${stats.out})`],
            ].map(([k, label]) => (
              <button
                key={k}
                className={`chip ${view === k ? 'active' : ''}`}
                onClick={() => setView(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="inv-cats">
          <button className={`chip ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>
            All categories
          </button>
          {categories.map((c) => {
            const n = products.filter((p) => p.categoryId === c.id && p.isActive !== false).length;
            if (!n) return null;
            return (
              <button
                key={c.id}
                className={`chip ${activeCat === c.id ? 'active' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                {c.name} <span className="cat-count">{n}</span>
              </button>
            );
          })}
        </div>

        {err && <div className="error">{err}</div>}

        {loading ? (
          <p className="muted">Loading your shelf…</p>
        ) : shown === 0 ? (
          <div className="empty premium-empty">
            <div className="empty-icon">0</div>
            <h3>{products.length ? 'Nothing matches' : 'Your shelf is empty'}</h3>
            <p>
              {products.length
                ? 'Try another search, category or filter.'
                : 'Add products from the central catalog to stock your shop.'}
            </p>
            {!products.length && (
              <Link to={`/admin/${storeId}/products`}>
                <button className="btn-v2 primary">Browse the catalog</button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="inv-count muted">{shown} product{shown > 1 ? 's' : ''} shown</p>
            {grouped.map((group) => (
              <div className="inv-group" key={group.name}>
                <div className="inv-group-head">
                  <h3>{group.name}</h3>
                  <span>{group.items.length}</span>
                </div>

                <div className="inv-grid">
                  {group.items.map((p) => {
                    const tone = p.stockQuantity === 0 ? 'out' : p.stockQuantity <= p.minimumStock ? 'low' : 'ok';
                    return (
                      <article className="inv-card" key={p.id}>
                        <div className="inv-card-media">
                          <img
                            src={getProductImage({ ...p, categoryName: p.category?.name })}
                            alt=""
                            loading="lazy"
                          />
                          <span className={`inv-card-stock ${tone}`}>
                            {p.stockQuantity === 0 ? 'Out' : p.stockQuantity}
                          </span>
                        </div>

                        <div className="inv-card-body">
                          <h4 title={p.name}>{p.name}</h4>
                          <span className="inv-card-sub">
                            {[p.description, `min ${p.minimumStock}`].filter(Boolean).join(' · ')}
                          </span>
                          <div className="inv-card-price">{formatINR(p.price)}</div>
                        </div>

                        {restockId === p.id ? (
                          <div className="inv-card-restock">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={restockQty}
                              onChange={(e) => setRestockQty(e.target.value)}
                              autoFocus
                            />
                            <button className="btn-v2 primary" onClick={() => doRestock(p.id)}>Add</button>
                            <button className="btn-v2 subtle" onClick={() => setRestockId(null)}>✕</button>
                          </div>
                        ) : (
                          <div className="inv-card-actions">
                            <button onClick={() => { setRestockQty(''); setRestockId(p.id); }}>Restock</button>
                            <button onClick={() => startEdit(p)}>Edit</button>
                            <button className="danger" onClick={() => removeProduct(p)}>Remove</button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* Stock alerts: click a metric to see exactly which products need action,
          and restock them without leaving the popup. */}
      {alert && (
        <div className="pq-sheet-backdrop" onClick={() => setAlert(null)}>
          <div className="inv-alert-modal" onClick={(e) => e.stopPropagation()}>
            <header className="pq-sheet-head">
              <div>
                <span>{alert === 'low' ? 'Needs restocking' : 'Unavailable to customers'}</span>
                <h2>
                  {alertItems.length} {alert === 'low' ? 'low-stock' : 'out-of-stock'} product
                  {alertItems.length === 1 ? '' : 's'}
                </h2>
              </div>
              <button className="pq-sheet-close" onClick={() => setAlert(null)}>×</button>
            </header>

            <div className="inv-alert-body">
              {alertItems.length === 0 ? (
                <p className="muted">Nothing to show — you're all stocked up.</p>
              ) : (
                alertItems.map((p) => (
                  <div className="inv-alert-row" key={p.id}>
                    <img src={getProductImage({ ...p, categoryName: p.category?.name })} alt="" loading="lazy" />
                    <div className="inv-alert-info">
                      <strong>{p.name}</strong>
                      <span>{p.category?.name || 'Uncategorized'} · {formatINR(p.price)}</span>
                    </div>
                    <div className="inv-alert-stock">
                      <span className={`inv-card-stock ${p.stockQuantity === 0 ? 'out' : 'low'}`}>
                        {p.stockQuantity === 0 ? 'Out' : p.stockQuantity}
                      </span>
                      <small>min {p.minimumStock}</small>
                    </div>
                    {restockId === p.id ? (
                      <div className="inv-card-restock inv-alert-restock">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={restockQty}
                          onChange={(e) => setRestockQty(e.target.value)}
                          autoFocus
                        />
                        <button className="btn-v2 primary" onClick={() => doRestock(p.id)}>Add</button>
                        <button className="btn-v2 subtle" onClick={() => setRestockId(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="btn-v2 primary inv-alert-btn" onClick={() => { setRestockQty(''); setRestockId(p.id); }}>
                        Restock
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {err && <div className="error pq-sheet-msg">{err}</div>}

            <footer className="pq-sheet-foot">
              <button
                className="btn-v2 subtle"
                onClick={() => { setView(alert); setAlert(null); }}
              >
                Show these in the list
              </button>
              <button className="btn-v2 primary" onClick={() => setAlert(null)}>Done</button>
            </footer>
          </div>
        </div>
      )}

      {/* Editing lives in a modal: four labelled fields will never fit legibly
          inside a ~180px product card. */}
      {editId && (() => {
        const p = products.find((x) => x.id === editId);
        if (!p) return null;
        return (
          <div className="pq-sheet-backdrop" onClick={() => !saving && setEditId(null)}>
            <div className="inv-edit-modal" onClick={(e) => e.stopPropagation()}>
              <header className="pq-sheet-head">
                <div>
                  <span>Edit product</span>
                  <h2>{p.name}</h2>
                </div>
                <button className="pq-sheet-close" onClick={() => setEditId(null)} disabled={saving}>×</button>
              </header>

              <div className="inv-edit-body">
                <div className="inv-field">
                  <label>Selling price</label>
                  <div className="pq-money">
                    <span>₹</span>
                    <input type="number" min="0" step="0.01" value={editForm.price} onChange={upd('price')} autoFocus />
                  </div>
                </div>
                <div className="inv-field">
                  <label>Stock you have</label>
                  <input className="pq-num" type="number" min="0" value={editForm.stockQuantity} onChange={upd('stockQuantity')} />
                </div>
                <div className="inv-field">
                  <label>Low-stock alert</label>
                  <input className="pq-num" type="number" min="0" value={editForm.minimumStock} onChange={upd('minimumStock')} />
                </div>
                <div className="inv-field">
                  <label>Category</label>
                  <select className="pq-num" value={editForm.categoryId} onChange={upd('categoryId')}>
                    <option value="">Uncategorized</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <footer className="pq-sheet-foot">
                <button className="btn-v2 subtle" onClick={() => setEditId(null)} disabled={saving}>Cancel</button>
                <button className="btn-v2 primary" onClick={() => saveEdit(p.id)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </footer>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Metric({ label, value, tone, onClick }) {
  // Only becomes interactive when there's something to show, so a "0" card
  // never invites a click that opens an empty list.
  if (!onClick) {
    return (
      <div className={`admin-metric ${tone || ''}`} data-anim="stagger-child">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }
  return (
    <button className={`admin-metric is-clickable ${tone || ''}`} data-anim="stagger-child" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em className="metric-cta">View →</em>
    </button>
  );
}
