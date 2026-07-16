const { ApiError } = require('../lib/utils');

// Turn a field path into something a shopkeeper recognises: stockQuantity -> "Stock".
const LABELS = {
  name: 'Product name',
  price: 'Price',
  stockQuantity: 'Stock',
  minimumStock: 'Minimum stock',
  categoryId: 'Category',
  imageUrl: 'Image URL',
  costPrice: 'Cost price',
  fullName: 'Full name',
  email: 'Email',
  password: 'Password',
  phone: 'Phone',
  storeName: 'Store name',
  quantity: 'Quantity',
};
const labelFor = (path) => {
  const key = path[path.length - 1];
  if (LABELS[key]) return LABELS[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
};

// Zod's raw codes ("Required", "Expected number, received nan") mean nothing to
// a shop owner. Turn each issue into a sentence naming the field and the fix.
function humanizeIssue(issue) {
  const field = labelFor(issue.path || []);
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') return `${field} is required.`;
      if (issue.expected === 'number') return `${field} must be a number.`;
      return `${field} is invalid.`;
    case 'too_small':
      if (issue.type === 'string')
        return issue.minimum <= 1
          ? `${field} is required.`
          : `${field} must be at least ${issue.minimum} characters.`;
      return `${field} must be at least ${issue.minimum}.`;
    case 'too_big':
      return `${field} must be at most ${issue.maximum}.`;
    case 'invalid_string':
      if (issue.validation === 'email') return 'Enter a valid email address.';
      if (issue.validation === 'url') return `${field} must be a valid URL.`;
      if (issue.validation === 'uuid') return `${field} is invalid.`;
      return `${field} is invalid.`;
    case 'invalid_enum_value':
      return `${field} must be one of: ${(issue.options || []).join(', ')}.`;
    default:
      return issue.message ? `${field}: ${issue.message}` : `${field} is invalid.`;
  }
}

// Validate req against a zod schema { body?, params?, query? }.
const validate = (schema) => (req, _res, next) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.params) req.params = schema.params.parse(req.params);
    if (schema.query) req.query = schema.query.parse(req.query);
    next();
  } catch (e) {
    const issues = e.errors || [];
    const messages = issues.map(humanizeIssue);
    // Lead with the first problem so a toast/inline error reads like a sentence,
    // and send the rest so the form can highlight every offending field.
    const message = messages[0] || 'Please check the highlighted fields.';
    next(
      new ApiError(
        400,
        message,
        issues.map((i, idx) => ({ field: (i.path || []).join('.'), message: messages[idx] }))
      )
    );
  }
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Prisma unique-constraint
  if (err.code === 'P2002') {
    return res.status(409).json({ error: `Duplicate value for ${err.meta?.target}` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  // Foreign-key violation: we referenced a row that doesn't exist. Surfacing it
  // as a 500 hides a client-fixable problem (e.g. a token issued before a
  // database restore, pointing at a user that's since gone).
  if (err.code === 'P2003') {
    return res.status(400).json({
      error: 'A referenced record no longer exists. Please refresh and try again.',
      details: [{ field: String(err.meta?.field_name || ''), message: 'Related record not found' }],
    });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { validate, errorHandler };
