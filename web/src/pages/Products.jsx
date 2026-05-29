import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';
import { formatINR, getProductImage } from '../lib/productPresentation';

const empty = { name: '', price: '', stockQuantity: 0, minimumStock: 5, categoryId: '', imageUrl: '' };

export default function Products() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [restockId, setRestockId] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [err, setErr] = useState('');

  const rootRef = usePageEntrance([products.length]);

  const load = () => {
    api.get(`/stores/${storeId}/products`).then((r) => setProducts(r.data.products));
    api.get(`/stores/${storeId}/categories`).then((r) => setCategories(r.data.categories));
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const summary = useMemo(() => {
    const active = products.filter((product) => product.isActive !== false);
    const low = active.filter((product) => product.stockQuantity <= product.minimumStock).length;
    const value = active.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stockQuantity || 0), 0);
    return { active: active.length, low, value };
  }, [products]);

  const save = async () => {
    setErr('');
    const payload = { ...form, categoryId: form.categoryId || null, imageUrl: form.imageUrl || null };
    try {
      if (editing) await api.put(`/stores/${storeId}/products/${editing}`, payload);
      else await api.post(`/stores/${storeId}/products`, payload);
      setForm(empty);
      setEditing(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed');
    }
  };

  const edit = (product) => {
    setEditing(product.id);
    setForm({
      name: product.name,
      price: product.price,
      stockQuantity: product.stockQuantity,
      minimumStock: product.minimumStock,
      categoryId: product.categoryId || '',
      imageUrl: product.imageUrl || '',
    });
  };

  const doRestock = async (id) => {
    if (!restockQty) return;
    await api.post(`/stores/${storeId}/products/${id}/restock`, { quantity: Number(restockQty) });
    setRestockId(null);
    setRestockQty('');
    load();
  };

  const addCategory = async () => {
    const name = prompt('Category name');
    if (name) {
      await api.post(`/stores/${storeId}/categories`, { name });
      load();
    }
  };

  const upd = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="admin-page" ref={rootRef}>
      <header className="admin-page-hero compact" data-anim="fade-up">
        <div>
          <span className="section-eyebrow">Catalog studio</span>
          <h1>Products</h1>
          <p>Create polished listings, manage stock thresholds, and keep every product ready for QR storefront shoppers.</p>
        </div>
      </header>

      <section className="admin-metric-grid" data-anim="fade-up">
        <Metric label="Active products" value={summary.active} />
        <Metric label="Inventory value" value={formatINR(summary.value)} />
        <Metric label="Categories" value={categories.length} />
        <Metric label="Low stock" value={summary.low} tone={summary.low ? 'warn' : 'ok'} />
      </section>

      <section className="product-editor admin-panel" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>{editing ? 'Editing listing' : 'New listing'}</span>
            <h2>{editing ? 'Update product details' : 'Add product to catalog'}</h2>
          </div>
          <button className="btn-v2 subtle" onClick={addCategory}>Add category</button>
        </div>

        <div className="product-form-grid">
          <label>
            <span>Product name</span>
            <input placeholder="Ex: Lays Classic 52g" value={form.name} onChange={upd('name')} />
          </label>
          <label>
            <span>Price</span>
            <input placeholder="20" type="number" value={form.price} onChange={upd('price')} />
          </label>
          <label>
            <span>Stock</span>
            <input placeholder="50" type="number" value={form.stockQuantity} onChange={upd('stockQuantity')} />
          </label>
          <label>
            <span>Min stock</span>
            <input placeholder="5" type="number" value={form.minimumStock} onChange={upd('minimumStock')} />
          </label>
          <label>
            <span>Category</span>
            <select value={form.categoryId} onChange={upd('categoryId')}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            <span>Image URL</span>
            <input placeholder="Optional product image URL" value={form.imageUrl} onChange={upd('imageUrl')} />
          </label>
        </div>

        {err && <div className="error">{err}</div>}

        <div className="admin-action-row">
          <button className="btn-v2 primary" onClick={save}>{editing ? 'Update product' : 'Publish product'}</button>
          {editing && (
            <button className="btn-v2 subtle" onClick={() => { setEditing(null); setForm(empty); }}>
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="admin-panel" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>Catalog table</span>
            <h2>All products</h2>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table product-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={{ opacity: product.isActive ? 1 : 0.5 }}>
                  <td>
                    <div className="product-cell">
                      <img src={getProductImage({ ...product, categoryName: product.category?.name })} alt="" loading="lazy" />
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.imageUrl ? 'Custom image' : 'Fallback image'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{product.category?.name || 'Uncategorized'}</td>
                  <td>{formatINR(product.price)}</td>
                  <td>
                    <span className={`badge ${product.stockQuantity === 0 ? 'out' : product.stockQuantity <= product.minimumStock ? 'low' : 'ok'}`}>
                      {product.stockQuantity}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {restockId === product.id ? (
                        <>
                          <input type="number" placeholder="Qty" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} />
                          <button className="btn-v2 primary" onClick={() => doRestock(product.id)}>Add</button>
                          <button className="btn-v2 subtle" onClick={() => setRestockId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-v2 subtle" onClick={() => setRestockId(product.id)}>Restock</button>
                          <button className="btn-v2 subtle" onClick={() => edit(product)}>Edit</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr><td colSpan={5} className="muted">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
