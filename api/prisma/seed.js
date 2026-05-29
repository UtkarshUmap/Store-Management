require('dotenv').config();
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const prisma = require('../src/lib/prisma');

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      fullName: 'Demo Owner',
      email: 'owner@demo.com',
      passwordHash,
      role: 'STORE_OWNER',
    },
  });

  const slug = 'reliance-fresh-andheri';
  const url = `${process.env.PUBLIC_WEB_URL || 'http://localhost:5173'}/store/${slug}`;
  const qr = await QRCode.toDataURL(url, { width: 512, margin: 2 });

  const store = await prisma.store.upsert({
    where: { storeSlug: slug },
    update: {},
    create: {
      ownerId: owner.id,
      storeName: 'Reliance Fresh Andheri',
      storeSlug: slug,
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      phone: '+91 99999 99999',
      qrCodeUrl: qr,
    },
  });

  const cat = await prisma.category.create({
    data: { storeId: store.id, name: 'Snacks' },
  });
  const drinks = await prisma.category.create({
    data: { storeId: store.id, name: 'Drinks' },
  });

  const products = [
    { name: 'Lays Classic 52g', price: 20, stockQuantity: 50, categoryId: cat.id },
    { name: 'Kurkure Masala 90g', price: 20, stockQuantity: 4, categoryId: cat.id },
    { name: 'Coca-Cola 750ml', price: 40, stockQuantity: 30, categoryId: drinks.id },
    { name: 'Bisleri Water 1L', price: 20, stockQuantity: 100, categoryId: drinks.id },
    { name: 'Dairy Milk 50g', price: 45, stockQuantity: 8, categoryId: cat.id },
  ];
  for (const p of products) {
    await prisma.product.create({
      data: { ...p, price: p.price.toFixed(2), storeId: store.id },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seeded.');
  console.log('  Login: owner@demo.com / password123');
  console.log(`  Storefront: ${url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
