import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { usePageEntrance } from '../lib/motion';
import { formatINR, getProductImage } from '../lib/productPresentation';
import BarcodeScanner from '../components/BarcodeScanner';
import ProductLibrary from '../components/ProductLibrary';
import PublishQueue from '../components/PublishQueue';

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
  const [fieldErrors, setFieldErrors] = useState({});
  // Products picked from the central catalog, waiting for a price before they
  // go on sale. productId -> { product, price, stock, minStock }
  const [queue, setQueue] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [inlineId, setInlineId] = useState(null);
  const [inlineForm, setInlineForm] = useState({ price: '', stockQuantity: 0, minimumStock: 5, categoryId: '' });
  const [savingInline, setSavingInline] = useState(false);

  const rootRef = usePageEntrance([products.length]);

  const load = () => {
    api.get(`/stores/${storeId}/products`).then((r) => setProducts(r.data.products));
    api.get(`/stores/${storeId}/categories`).then((r) => setCategories(r.data.categories));
  };

  useEffect(() => {
    load();
  }, [storeId]);

  // Group the owner's products under their category headings — a flat, randomly
  // ordered list is unusable once a store has more than a handful of products.
  const grouped = useMemo(() => {
    const byCat = new Map();
    for (const p of products) {
      const key = p.category?.name || 'Uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    }
    return [...byCat.entries()]
      .sort(([a], [b]) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
      .map(([name, items]) => ({
        name,
        items: items.slice().sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [products]);

  const summary = useMemo(() => {
    const active = products.filter((product) => product.isActive !== false);
    const low = active.filter((product) => product.stockQuantity <= product.minimumStock).length;
    const value = active.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stockQuantity || 0), 0);
    return { active: active.length, low, value };
  }, [products]);

  const queuedIds = useMemo(() => new Set(queue.map((i) => i.product.id)), [queue]);

  const queueProduct = (product) => {
    setQueue((q) =>
      q.some((i) => i.product.id === product.id)
        ? q
        : [
            ...q,
            {
              product,
              // Seed with the catalog's reference price if we have one; the owner
              // still has to confirm it before anything goes on sale.
              price: product.referencePrice != null ? String(product.referencePrice) : '',
              // Sensible default so the owner only has to type a price; he can
              // still adjust the count before adding it to inventory.
              stock: 10,
              minStock: 5,
            },
          ]
    );
  };

  const updateQueued = (id, patch) =>
    setQueue((q) => q.map((i) => (i.product.id === id ? { ...i, ...patch } : i)));

  const save = async () => {
    setErr('');
    setFieldErrors({});

    // Catch the obvious problems before a round-trip so the owner gets an
    // instant, specific message instead of a generic server rejection.
    const local = {};
    if (!form.name.trim()) local.name = 'Product name is required.';
    if (form.price === '' || form.price === null) local.price = 'Price is required.';
    else if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) local.price = 'Price must be a number.';
    if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl)) local.imageUrl = 'Image URL must start with http:// or https://';
    if (Object.keys(local).length) {
      setFieldErrors(local);
      setErr(Object.values(local)[0]);
      return;
    }

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
      const data = e.response?.data;
      setErr(data?.error || 'Could not save this product. Please try again.');
      // Highlight every field the server complained about.
      if (Array.isArray(data?.details)) {
        const map = {};
        for (const d of data.details) if (d.field) map[d.field] = d.message;
        setFieldErrors(map);
      }
    }
  };

  // Editing happens inline in the products table — never by sending the owner
  // back up to the "add product" form.
  const startInlineEdit = (product) => {
    setRestockId(null);
    setInlineId(product.id);
    setInlineForm({
      price: product.price ?? '',
      stockQuantity: product.stockQuantity ?? 0,
      minimumStock: product.minimumStock ?? 5,
      categoryId: product.categoryId || '',
    });
  };

  const saveInlineEdit = async (id) => {
    setErr('');
    setSavingInline(true);
    try {
      await api.put(`/stores/${storeId}/products/${id}`, {
        price: Number(inlineForm.price || 0),
        stockQuantity: Number(inlineForm.stockQuantity || 0),
        minimumStock: Number(inlineForm.minimumStock || 0),
        categoryId: inlineForm.categoryId || null,
      });
      setInlineId(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Update failed');
    } finally {
      setSavingInline(false);
    }
  };

  const updInline = (key) => (e) => setInlineForm({ ...inlineForm, [key]: e.target.value });

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

      {/* Catalog gets the full width — a narrow side panel couldn't fit the
          price/stock fields legibly. Picks collect in a sticky bar, and the
          owner reviews and prices them in a full-width sheet. */}
      <ProductLibrary
        storeId={storeId}
        storeProducts={products}
        queuedIds={queuedIds}
        onQueue={queueProduct}
      />

      {queue.length > 0 && !reviewOpen && (
        <button className="pq-bar" onClick={() => setReviewOpen(true)}>
          <span className="pq-bar-count">{queue.length}</span>
          <span className="pq-bar-text">
            {queue.length} product{queue.length > 1 ? 's' : ''} selected
          </span>
          <span className="pq-bar-cta">Set price &amp; add to inventory →</span>
        </button>
      )}

      {reviewOpen && queue.length > 0 && (
        <PublishQueue
          storeId={storeId}
          items={queue}
          onChange={updateQueued}
          onRemove={(id) => setQueue((q) => q.filter((i) => i.product.id !== id))}
          onClear={() => setQueue([])}
          onClose={() => setReviewOpen(false)}
          onPublished={load}
        />
      )}

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
          <label className={fieldErrors.name ? 'has-error' : ''}>
            <span>Product name <em className="req">required</em></span>
            <input placeholder="Ex: Lays Classic 52g" value={form.name} onChange={upd('name')} />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>
          <label>
            <span>Brand <em className="opt">optional</em></span>
            <input placeholder="Ex: Lay's" value={form.brand} onChange={upd('brand')} />
          </label>
          <label className={fieldErrors.price ? 'has-error' : ''}>
            <span>Price <em className="req">required</em></span>
            <input placeholder="20" type="number" value={form.price} onChange={upd('price')} />
            {fieldErrors.price && <small className="field-error">{fieldErrors.price}</small>}
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
          <label className={`wide ${fieldErrors.imageUrl ? 'has-error' : ''}`}>
            <span>Image URL <em className="opt">optional</em></span>
            <input placeholder="https://… (leave blank to use a default image)" value={form.imageUrl} onChange={upd('imageUrl')} />
            {fieldErrors.imageUrl && <small className="field-error">{fieldErrors.imageUrl}</small>}
          </label>
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

      <section className="admin-panel inv-cta" data-anim="fade-up">
        <div className="admin-panel-head">
          <div>
            <span>Your shelf</span>
            <h2>{products.length} product{products.length === 1 ? '' : 's'} in your shop</h2>
            <p className="muted">Manage prices, stock and restocks on the Inventory page.</p>
          </div>
          <Link className="btn-v2 primary" to={`/admin/${storeId}/inventory`}>Go to Inventory →</Link>
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
