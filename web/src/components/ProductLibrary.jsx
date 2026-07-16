// Central product library: the shop owner browses the master catalog
// category-wise, searches, and taps "+" to add a product into this store.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { categoryArt } from '../lib/categoryArt';

export default function ProductLibrary({ storeId, storeProducts = [], queuedIds, onQueue }) {
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null); // null = category picker
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [justAdded, setJustAdded] = useState(new Set());
  const [err, setErr] = useState('');
  const debounce = useRef();

  useEffect(() => {
    api.get('/catalog/categories').then((r) => setCategories(r.data.categories)).catch(() => {});
  }, []);

  // Names already in this store — so we can show them as already added.
  const ownedNames = useMemo(
    () => new Set(storeProducts.map((p) => (p.name || '').trim().toLowerCase())),
    [storeProducts]
  );

  const searching = q.trim().length > 0;
  const showGrid = activeCat || searching;

  const fetchProducts = async ({ cursor = null, append = false } = {}) => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get('/catalog/products', {
        params: {
          category: searching ? undefined : activeCat || undefined,
          q: q.trim() || undefined,
          cursor: cursor || undefined,
          limit: 40,
        },
      });
      setProducts((prev) => (append ? [...prev, ...r.data.products] : r.data.products));
      setNextCursor(r.data.nextCursor);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showGrid) {
      setProducts([]);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchProducts(), 250);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, q]);

  // "+" stages the product — it isn't published to the shop until the owner has
  // set a price. Publishing straight from here would put ₹0 products on sale.
  const add = (p) => onQueue && onQueue(p);

  const total = useMemo(
    () => categories.reduce((n, c) => n + (c.productCount || 0), 0),
    [categories]
  );
  const activeCatName = categories.find((c) => c.id === activeCat)?.name;

  return (
    <section className="product-library admin-panel" data-anim="fade-up">
      <div className="admin-panel-head">
        <div>
          <span>Product library</span>
          <h2>Add from the central catalog</h2>
          <p className="muted">
            {total.toLocaleString()} products across {categories.length} categories. Pick a
            category or search, then tap <strong>+</strong> to add it to your store.
          </p>
        </div>
      </div>

      <div className="library-searchbar">
        <span className="library-search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search all products — Amul, Parle-G, atta, Lizol…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" className="library-clear" onClick={() => setQ('')} title="Clear">
            ×
          </button>
        )}
      </div>

      {/* Breadcrumb when inside a category or searching */}
      {showGrid && (
        <div className="library-crumb">
          <button type="button" className="crumb-back" onClick={() => { setActiveCat(null); setQ(''); }}>
            ← All categories
          </button>
          <span className="crumb-here">
            {searching ? `Search: “${q.trim()}”` : activeCatName}
          </span>
        </div>
      )}

      {err && <div className="online-prices-error">{err}</div>}

      {/* CATEGORY PICKER */}
      {!showGrid && (
        <div className="library-cat-grid">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="library-cat-tile"
              onClick={() => setActiveCat(c.id)}
              disabled={!c.productCount}
            >
              <span
                className="lct-art"
                style={{ background: categoryArt(c.name).bg, color: categoryArt(c.name).fg }}
              >
                <em>{categoryArt(c.name).icon}</em>
              </span>
              <span className="cat-tile-name">{c.name}</span>
              <span className="cat-tile-count">{c.productCount} items</span>
            </button>
          ))}
          {!categories.length && <p className="muted">Loading categories…</p>}
        </div>
      )}

      {/* PRODUCT GRID */}
      {showGrid && (
        <>
          <div className="library-grid">
            {products.map((p) => {
              const inShop = ownedNames.has((p.name || '').trim().toLowerCase());
              const queued = queuedIds?.has(p.id);
              const owned = inShop || queued;
              return (
                <div className={`library-card ${owned ? 'is-owned' : ''}`} key={p.id}>
                  <div className="library-thumb">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="library-thumb-fallback">{(p.name || '?').slice(0, 1)}</div>
                    )}
                  </div>
                  <div className="library-info">
                    <div className="library-name" title={p.name}>{p.name}</div>
                    <div className="library-meta">
                      {p.brand && <span>{p.brand}</span>}
                      {p.unit && <span className="dot">{p.unit}</span>}
                    </div>
                    {!searching && <div className="library-cat-tag">{p.categoryName}</div>}
                    {searching && <div className="library-cat-tag">{p.categoryName}</div>}
                  </div>
                  <button
                    type="button"
                    className={`library-add ${owned ? 'added' : ''}`}
                    onClick={() => add(p)}
                    disabled={owned}
                    title={
                      inShop
                        ? 'Already in your shop'
                        : queued
                        ? 'Staged below — set a price and publish'
                        : 'Pick this product'
                    }
                  >
                    {owned ? '✓' : '+'}
                  </button>
                </div>
              );
            })}

            {loading &&
              products.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => (
                <div className="library-card skeleton" key={`sk-${i}`}>
                  <div className="library-thumb" />
                  <div className="sk-line" />
                  <div className="sk-line short" />
                </div>
              ))}
          </div>

          {!loading && products.length === 0 && (
            <p className="muted library-empty">
              No products found{searching ? ` for “${q.trim()}”` : ''}. Try another search or category.
            </p>
          )}

          {nextCursor && (
            <div className="library-more">
              <button
                type="button"
                className="btn-v2"
                disabled={loading}
                onClick={() => fetchProducts({ cursor: nextCursor, append: true })}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
