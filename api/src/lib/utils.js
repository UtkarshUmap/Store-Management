// Small shared utilities used across controllers.

const crypto = require('crypto');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wrap async route handlers so thrown errors hit the error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Human-friendly, unique-enough order number: ORD-20260528-AB12CD34
function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ORD-${ymd}-${rand}`;
}

// Round a number to 2 dp and return a string suitable for Prisma Decimal.
const money = (n) => Number(n).toFixed(2);

module.exports = { ApiError, asyncHandler, generateOrderNumber, money };
