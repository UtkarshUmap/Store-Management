// ============================================================================
// NEW FILE: web/src/components/OnlinePricesPanel.jsx
//
// Shows live competitor prices (Blinkit/Zepto/Instamart) for one product.
// The admin can view them separately and optionally IMPORT a price into the
// product form via the onImportPrice callback.
//
// Props:
//   storeId       - current store id
//   productName   - what to search for (usually the product's name)
//   onImportPrice - (price:number) => void   called when admin imports a price
// ============================================================================
import { useState } from 'react';
import api from '../lib/api';

const PLATFORM_LABELS = { blinkit: 'Blinkit', zepto: 'Zepto', instamart: 'Instamart' };

export default function OnlinePricesPanel({ storeId, productName, onImportPrice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!productName?.trim()) {
      setError('Enter or select a product name first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.get(`/stores/${storeId}/market-prices`, {
        params: { query: productName.trim() },
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load online prices.');
    } finally {
      setLoading(false);
    }
  };

  // Force a live scrape (slow: 30-90s). Use sparingly.
  const refreshLive = async () => {
    setError('');
    setRefreshing(true);
    try {
      await api.post(`/stores/${storeId}/market-prices/refresh`, null, {
        params: { query: productName.trim() },
        timeout: 100000,
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Live refresh failed or timed out.');
    } finally {
      setRefreshing(false);
    }
  };

  const rows = [];
  if (data?.data) {
    for (const [platform, info] of Object.entries(data.data)) {
      const item = info?.results?.[0];
      rows.push({
        platform,
        label: PLATFORM_LABELS[platform] || platform,
        name: item?.name || null,
        price: item?.price ?? null,
        quantity: item?.quantity || '',
        stale: info?.stale,
        ageHours: info?.age_seconds != null ? (info.age_seconds / 3600).toFixed(1) : null,
      });
    }
  }

  return (
    <section className="online-prices admin-panel" data-anim="fade-up">
      <div className="online-prices-head">
        <h3>Online prices (quick-commerce)</h3>
        <div className="online-prices-actions">
          <button type="button" className="btn-v2" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'View online prices'}
          </button>
          <button type="button" className="btn-v2" onClick={refreshLive} disabled={refreshing}>
            {refreshing ? 'Refreshing (up to 90s)…' : 'Refresh live'}
          </button>
        </div>
      </div>

      {error && <div className="online-prices-error">{error}</div>}

      {rows.length > 0 && (
        <table className="online-prices-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Matched product</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.platform}>
                <td>
                  {r.label}
                  {r.stale && r.ageHours && (
                    <span className="stale-tag" title="cached price"> · {r.ageHours}h old</span>
                  )}
                </td>
                <td>{r.name ? `${r.name}${r.quantity ? ` (${r.quantity})` : ''}` : <em>no match</em>}</td>
                <td>{r.price != null ? `₹${r.price}` : '—'}</td>
                <td>
                  {r.price != null && (
                    <button
                      type="button"
                      className="btn-v2 primary btn-small"
                      onClick={() => onImportPrice?.(r.price)}
                    >
                      Import
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && rows.every((r) => r.price == null) && (
        <p className="online-prices-hint">
          No matches yet. Try “Refresh live”, or adjust the product name to match how these apps list it.
        </p>
      )}
    </section>
  );
}
