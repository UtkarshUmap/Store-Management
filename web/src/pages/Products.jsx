import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
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

  const load = () => {
    api.get(`/stores/${storeId}/products`).then((r) => setProducts(r.data.products));
    api.get(`/stores/${storeId}/categories`).then((r) => setCategories(r.data.categories));
  };
  useEffect(() => {
    load();
  }, [storeId]);

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

  const edit = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      price: p.price,
      stockQuantity: p.stockQuantity,
      minimumStock: p.minimumStock,
      categoryId: p.categoryId || '',
      imageUrl: p.imageUrl || '',
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

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const rootRef = usePageEntrance([products.length]);

  return (
    <div className="grid" ref={rootRef} style={{ gap: 20 }}>
      <h1 data-anim="fade-up">Products</h1>

      <div className="card grid" data-anim="fade-up" style={{ gap: 12 }}>
        <strong>{editing ? 'Edit product' : 'Add product'}</strong>
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <input placeholder="Name" value={form.name} onChange={upd('name')} />
          <input placeholder="Price" type="number" value={form.price} onChange={upd('price')} />
          <input placeholder="Stock" type="number" value={form.stockQuantity} onChange={upd('stockQuantity')} />
          <input placeholder="Min stock" type="number" value={form.minimumStock} onChange={upd('minimumStock')} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <select value={form.categoryId} onChange={upd('categoryId')}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input placeholder="Image URL (optional)" value={form.imageUrl} onChange={upd('imageUrl')} />
        </div>
        {err && <div className="error">{err}</div>}
        <div className="row">
          <button onClick={save}>{editing ? 'Update' : 'Add'}</button>
          {editing && (
            <button className="ghost" onClick={() => { setEditing(null); setForm(empty); }}>
              Cancel
            </button>
          )}
          <button className="secondary" onClick={addCategory}>+ Category</button>
        </div>
      </div>

      <div className="card" data-anim="fade-up">
        <table>
          <thead>
            <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                <td>{p.name}</td>
                <td className="muted">{p.category?.name || '—'}</td>
                <td>{inr(p.price)}</td>
                <td>
                  <span className={`badge ${p.stockQuantity === 0 ? 'out' : p.stockQuantity <= p.minimumStock ? 'low' : 'ok'}`}>
                    {p.stockQuantity}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    {restockId === p.id ? (
                      <>
                        <input style={{ width: 70 }} type="number" placeholder="Qty" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} />
                        <button onClick={() => doRestock(p.id)}>Add</button>
                        <button className="ghost" onClick={() => setRestockId(null)}>×</button>
                      </>
                    ) : (
                      <>
                        <button className="secondary" onClick={() => setRestockId(p.id)}>Restock</button>
                        <button className="ghost" onClick={() => edit(p)}>Edit</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
