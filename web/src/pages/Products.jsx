import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';
import { formatINR, getProductImage } from '../lib/productPresentation';
import BarcodeScanner from '../components/BarcodeScanner';
import OnlinePricesPanel from '../components/OnlinePricesPanel';

const empty = {
  name: '',
  barcode: '',
  brand: '',
  price: '',
  stockQuantity: 0,
  minimumStock: 5,
  categoryId: '',
  imageUrl: '',
};

export default function Products() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [restockId, setRestockId] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [scanRestockQty, setScanRestockQty] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [lookupSource, setLookupSource] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
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
    const payload = { ...form, categoryId: form.categoryId || null, imageUrl: form.imageUrl || null, description: form.brand || null };
    delete payload.brand;
    try {
      if (editing) await api.put(`/stores/${storeId}/products/${editing}`, payload);
      else await api.post(`/stores/${storeId}/products`, payload);
      setForm(empty);
      setEditing(null);
      setScannedProduct(null);
      setLookupMessage('');
      setLookupSource('');
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed');
    }
  };

  const edit = (product) => {
    setEditing(product.id);
    setForm({
      name: product.name,
      barcode: product.barcode || '',
      brand: product.description || '',
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

  const doBarcodeLookup = async (codeOverride) => {
    const scanCode = (typeof codeOverride === 'string' ? codeOverride : form.barcode)?.trim();
    setErr('');
    setLookupMessage('');
    setLookupSource('');
    setScannedProduct(null);
    if (!scanCode) {
      setErr('Enter a barcode number to scan.');
      return;
    }

    setLookupLoading(true);
    try {
      const response = await api.get(`/stores/${storeId}/products/lookup`, {
        params: { barcode: scanCode },
      });
      const { source, product } = response.data;
      if (!product) {
        setLookupMessage('No product details found. You can still fill the form manually.');
        setEditing(null);
        setScannedProduct(null);
        return;
      }

      const categoryName = product.category?.name || product.category || product.categoryName || '';
      const categoryId = product.categoryId || categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase())?.id || '';
      const mapped = {
        name: product.name || '',
        barcode: product.barcode || scanCode,
        brand: product.description || '',
        price: product.price ?? '',
        stockQuantity: product.stockQuantity ?? 0,
        minimumStock: product.minimumStock ?? 5,
        categoryId,
        imageUrl: product.imageUrl || '',
      };
      setForm(mapped);
      if (source === 'db') {
        setScannedProduct(product);
        setLookupSource('db');
        setLookupMessage('Product exists in your store. Enter restock quantity or edit details.');
        setEditing(product.id);
      } else {
        setLookupSource(source);
        setLookupMessage('Product info was found and filled in. Review details, enter stock, and save.');
        setEditing(null);
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setLookupMessage('No matching barcode found. You can still create the product manually.');
      } else {
        setErr(e.response?.data?.error || 'Barcode lookup failed');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const restockScannedProduct = async () => {
    setErr('');
    if (!scannedProduct) return;
    const quantity = Number(scanRestockQty);
    if (!quantity || quantity <= 0) {
      setErr('Enter a valid quantity to restock.');
      return;
    }
    try {
      await api.post(`/stores/${storeId}/products/${scannedProduct.id}/restock`, { quantity });
      setScanRestockQty('');
      setLookupMessage(`Restocked ${quantity} ${scannedProduct.name}.`);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Restock failed');
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

      <section className="barcode-quick-add admin-panel" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>Quick add</span>
            <h2>Scan barcode to add a product</h2>
          </div>
        </div>
        <div className="barcode-quick-add-grid">
          <label className="wide">
            <span>Barcode / UPC</span>
            <input
              placeholder="Scan or paste the barcode"
              value={form.barcode}
              onChange={upd('barcode')}
            />
          </label>
          <button className="btn-v2 primary" type="button" onClick={doBarcodeLookup} disabled={lookupLoading}>
            {lookupLoading ? 'Looking up…' : 'Lookup product'}
          </button>
          <button className="btn-v2" type="button" onClick={() => setScannerOpen(true)}>
            Scan with camera
          </button>
        </div>
        {lookupMessage && <div className="barcode-lookup-hint">{lookupMessage}</div>}
        {scannerOpen && (
          <BarcodeScanner
            onClose={() => setScannerOpen(false)}
            onDetected={(code) => {
              setScannerOpen(false);
              setForm((f) => ({ ...f, barcode: code }));
              doBarcodeLookup(code);
            }}
          />
        )}
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
            <span>Brand</span>
            <input placeholder="Ex: Lay's" value={form.brand} onChange={upd('brand')} />
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
          {lookupMessage && <div className="barcode-lookup-hint">{lookupMessage}</div>}
          {lookupSource === 'db' && scannedProduct && (
            <div className="barcode-restock-row">
              <label>
                <span>Restock quantity</span>
                <input
                  type="number"
                  placeholder="Qty"
                  value={scanRestockQty}
                  onChange={(e) => setScanRestockQty(e.target.value)}
                />
              </label>
              <button className="btn-v2 primary" type="button" onClick={restockScannedProduct}>
                Restock scanned product
              </button>
            </div>
          )}
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

      <OnlinePricesPanel
        storeId={storeId}
        productName={form.name}
        onImportPrice={(price) => setForm((f) => ({ ...f, price }))}
      />

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
