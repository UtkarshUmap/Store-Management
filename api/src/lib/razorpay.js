const crypto = require('crypto');

// Reject obviously-placeholder values copied from .env.example so a misconfigured
// install surfaces as a clean 503 instead of leaking stock on a Razorpay auth failure.
function looksReal(v) {
  return !!v && !/x{4,}/i.test(v);
}

let razorpay = null;
try {
  const Razorpay = require('razorpay');
  if (looksReal(process.env.RAZORPAY_KEY_ID) && looksReal(process.env.RAZORPAY_KEY_SECRET)) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
} catch {
  // razorpay package missing — only cash flow will work
}

// Create a Razorpay order. amount is in rupees; Razorpay wants paise.
async function createRazorpayOrder({ amountRupees, receipt }) {
  if (!razorpay) throw new Error('Razorpay not configured');
  return razorpay.orders.create({
    amount: Math.round(Number(amountRupees) * 100),
    currency: 'INR',
    receipt,
    payment_capture: 1,
  });
}

// Verify the signature returned by Razorpay checkout on the client.
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch {
    // Length mismatch / non-hex input — treat as a failed verification.
    return false;
  }
}

// Verify a webhook payload signature.
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

module.exports = {
  razorpay,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  isConfigured: () => !!razorpay,
};
