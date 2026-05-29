export const formatINR = (value) =>
  '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const productImages = {
  snacks:
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=82',
  drinks:
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82',
  chocolate:
    'https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=900&q=82',
  water:
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=82',
  grocery:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=82',
  default:
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=82',
};

function hashString(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getProductImage(product) {
  if (product?.imageUrl) return product.imageUrl;

  const label = `${product?.name || ''} ${product?.categoryName || ''}`.toLowerCase();
  if (/coca|cola|drink|juice|soda/.test(label)) return productImages.drinks;
  if (/water|bisleri/.test(label)) return productImages.water;
  if (/dairy|chocolate|milk/.test(label)) return productImages.chocolate;
  if (/lays|kurkure|snack|chips/.test(label)) return productImages.snacks;
  if (/grocery|fresh|fruit|vegetable/.test(label)) return productImages.grocery;
  return productImages.default;
}

export function getProductRating(product) {
  const hash = hashString(`${product?.id || product?.name || 'product'}-rating`);
  const value = Math.min(4.9, 4.45 + (hash % 45) / 100);
  const reviews = 64 + (hash % 780);
  return { value: value.toFixed(1), reviews };
}

export function getStockStatus(product) {
  const stock = Number(product?.stockQuantity || 0);
  if (!product?.inStock || stock <= 0) {
    return { label: 'Sold out', tone: 'out', helper: 'Restock needed' };
  }
  if (stock <= 8) {
    return { label: 'Low stock', tone: 'low', helper: `${stock} left` };
  }
  return { label: 'In stock', tone: 'ok', helper: `${stock} available` };
}
