import { create } from 'zustand';

// Try to hydrate user from localStorage on first load so we know the role
// without waiting for /auth/me — needed for role-aware route guards.
let bootUser = null;
try {
  const raw = localStorage.getItem('user');
  if (raw) bootUser = JSON.parse(raw);
} catch {
  /* ignore */
}

export const useAuth = create((set) => ({
  user: bootUser,
  token: localStorage.getItem('token') || null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  setUser: (user) => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));

// Cart lives client-side; only hits the server at checkout. It's persisted to
// localStorage because checkout sends the shopper through /login — an in-memory
// cart would be wiped by that round-trip and they'd lose their basket.
const CART_KEY = 'cart';
let bootCart = {};
try {
  const raw = localStorage.getItem(CART_KEY);
  if (raw) bootCart = JSON.parse(raw) || {};
} catch {
  /* ignore corrupt cart */
}
const persist = (items) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode — cart still works in memory */
  }
  return { items };
};

export const useCart = create((set, get) => ({
  items: bootCart, // productId -> { product, quantity }
  add: (product) =>
    set((s) => {
      const cur = s.items[product.id]?.quantity || 0;
      const max = product.stockQuantity ?? Infinity;
      const quantity = Math.min(cur + 1, max);
      return persist({ ...s.items, [product.id]: { product, quantity } });
    }),
  dec: (productId) =>
    set((s) => {
      const cur = s.items[productId];
      if (!cur) return s;
      const quantity = cur.quantity - 1;
      const items = { ...s.items };
      if (quantity <= 0) delete items[productId];
      else items[productId] = { ...cur, quantity };
      return persist(items);
    }),
  remove: (productId) =>
    set((s) => {
      const items = { ...s.items };
      delete items[productId];
      return persist(items);
    }),
  clear: () => set(persist({})),
  total: () =>
    Object.values(get().items).reduce(
      (sum, { product, quantity }) => sum + Number(product.price) * quantity,
      0
    ),
  count: () => Object.values(get().items).reduce((n, i) => n + i.quantity, 0),
}));
