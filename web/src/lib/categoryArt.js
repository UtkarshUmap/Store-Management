// Deliberate artwork for the 12 master categories.
//
// Category tiles previously showed the first product photo we happened to find,
// which is crowdsourced and unpredictable (a hand, a shelf, a barcode) — and
// blank for curated categories whose items have no photo at all. A fixed icon +
// tint per category is consistent, instant, never broken, and reads as designed.
const ART = {
  'Grocery':             { icon: '🌾', bg: '#fff4e0', fg: '#a8620a' },
  'Dairy':               { icon: '🥛', bg: '#eaf3ff', fg: '#1f5fa8' },
  'Snacks':              { icon: '🍿', bg: '#fff0e8', fg: '#b8430f' },
  'Beverages':           { icon: '🥤', bg: '#e9f7f6', fg: '#0d7a72' },
  'Personal Care':       { icon: '🧴', bg: '#fdeef6', fg: '#a8317a' },
  'Home Care':           { icon: '🧽', bg: '#eef0ff', fg: '#4340a8' },
  'Baby Care':           { icon: '🍼', bg: '#fff1f4', fg: '#b03050' },
  'Frozen Foods':        { icon: '🧊', bg: '#e8f4fd', fg: '#1a6ba8' },
  'Bakery':              { icon: '🍞', bg: '#fdf3e3', fg: '#9a6414' },
  'Stationery':          { icon: '✏️', bg: '#f1f0fb', fg: '#5a4ba8' },
  'Pet Food':            { icon: '🐾', bg: '#f3f0e8', fg: '#7a5a24' },
  'Fruits & Vegetables': { icon: '🥬', bg: '#eafbec', fg: '#0c831f' },
};

const FALLBACK = { icon: '🛒', bg: '#f2f2f2', fg: '#666666' };

export const categoryArt = (name) => ART[name] || FALLBACK;
