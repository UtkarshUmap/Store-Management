const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { asyncHandler, ApiError } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const publicUser = (u) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  phone: u.phone,
});

// Register either a STORE_OWNER (the shopkeeper) or a CUSTOMER (the shopper).
// SUPER_ADMIN and STAFF are not self-serve; an existing admin must create them.
router.post(
  '/register',
  validate({
    body: z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().optional(),
      role: z.enum(['STORE_OWNER', 'CUSTOMER']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { fullName, email, password, phone, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash, phone, role: role || 'STORE_OWNER' },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  validate({ body: z.object({ email: z.string().email(), password: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid credentials');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, email: true, role: true, phone: true },
    });
    // A validly-signed token can still name a user who no longer exists (say,
    // after a database restore). Returning 200 + {user:null} left the client
    // "logged in" with a dead token forever; a 401 makes it clear the session
    // and send them back to login.
    if (!user) throw new ApiError(401, 'Your session is no longer valid. Please log in again.');
    res.json({ user });
  })
);

module.exports = router;
