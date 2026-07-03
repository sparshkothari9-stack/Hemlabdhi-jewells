const bcrypt = require('bcryptjs');
const { get, all } = require('./db-helpers');
const { getDB, save } = require('./db');

function exec(sql, params = []) {
  getDB.__syncDb.run(sql, params);
}

function insertDefaultUsers() {
  const adminEmail = process.env.ADMIN_EMAIL || 'sparshkothari9@gmail.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin@123';
  const clientPass = process.env.CLIENT_PASSWORD || 'client@123';

  const clients = [
    { name: 'Admin', email: adminEmail, password: bcrypt.hashSync(adminPass, 10), tier: 'admin', is_admin: 1 },
    { name: 'Rajesh Jewellers', email: 'rajesh@example.com', password: bcrypt.hashSync(clientPass, 10), tier: 'wholesale', is_admin: 0 },
    { name: 'Priya Retail', email: 'priya@example.com', password: bcrypt.hashSync(clientPass, 10), tier: 'retailer', is_admin: 0 }
  ];

  for (const c of clients) {
    if (!get('SELECT id FROM clients WHERE email = ?', [c.email])) {
      exec('INSERT INTO clients (name, email, password, tier, is_admin) VALUES (?, ?, ?, ?, ?)',
        [c.name, c.email, c.password, c.tier, c.is_admin]);
    }
  }
}

function buildProducts() {
  const IMG = 'images/';
  const isCrown = id => id >= 83 && id <= 98;
  const isBrooch = id => id >= 99 && id <= 116;
  const isNewNecklace = id => id >= 117;
  const isEarring = id => id >= 152 && id <= 216;

  const generated = Array.from({ length: 216 }, (_, i) => {
    const id = i + 1;
    let seq = id;
    let name = `Designer Necklace ${String(seq).padStart(3, '0')}`;
    let category = 'Necklace';
    let skuPrefix = 'PA-NK';
    let desc = 'Exquisite designer necklace piece from our premium collection.';
    let imgs = [`${IMG}product${id}.jpeg`];

    if (isEarring(id)) {
      seq = id - 151;
      name = `Designer Earring ${String(seq).padStart(3, '0')}`;
      category = 'Earring';
      skuPrefix = 'PA-ER';
      desc = 'Elegant designer earring piece from our premium collection.';
      imgs = [`${IMG}product${id + 183}.jpeg`];
    } else if (isBrooch(id)) {
      seq = id - 98;
      name = `Designer Brooch ${String(seq).padStart(3, '0')}`;
      category = 'Brooch';
      skuPrefix = 'PA-BR';
      desc = 'Elegant designer brooch piece from our premium collection.';
      imgs = [`${IMG}product${2 * id - 99}.jpeg`, `${IMG}product${2 * id - 98}.jpeg`, `${IMG}product${id + 52}.jpeg`];
    } else if (isCrown(id)) {
      seq = id - 82;
      name = `Designer Crown ${String(seq).padStart(3, '0')}`;
      category = 'Crowns';
      skuPrefix = 'PA-CR';
      desc = 'Regal designer crown piece from our premium collection.';
      imgs = [`${IMG}product${id}.jpeg`, `${IMG}product${id + 52}.jpeg`];
    }

    if (isNewNecklace(id) && !isEarring(id)) {
      seq = id <= 125 ? id - 116 : id - 117;
      imgs = [(id === 151 ? `${IMG}product271.jpeg` : `${IMG}product${id + 52}.jpeg`), `${IMG}product${236 + seq}.jpeg`, `${IMG}product${300 + seq}.jpeg`];
      name = `Designer Necklace ${String(seq).padStart(3, '0')}`;
    }

    return {
      id,
      name,
      category,
      images: JSON.stringify(imgs),
      badge: 'New',
      description: desc,
      features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']),
      sku: `${skuPrefix}-${String(seq).padStart(3, '0')}`
    };
  }).filter(p => (p.id >= 83 && p.id <= 151 && p.id !== 126) || (p.id >= 152 && p.id <= 216));

  const extraProducts = [
    { id: 217, name: 'Designer Earring 066', category: 'Earring', images: JSON.stringify(Array.from({ length: 9 }, (_, i) => `${IMG}product${400 + i}.jpeg`)), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer earring piece available in multiple colors.', sku: 'PA-ER-066', badge: 'New' },
    { id: 218, name: 'Designer Earring 067', category: 'Earring', images: JSON.stringify(Array.from({ length: 7 }, (_, i) => `${IMG}product${409 + i}.jpeg`)), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer earring piece available in multiple colors.', sku: 'PA-ER-067', badge: 'New' },
    { id: 219, name: 'Designer Earring 068', category: 'Earring', images: JSON.stringify(Array.from({ length: 10 }, (_, i) => `${IMG}product${416 + i}.jpeg`)), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer earring piece available in multiple colors.', sku: 'PA-ER-068', badge: 'New' },
    { id: 220, name: 'Designer Earring 069', category: 'Earring', images: JSON.stringify(Array.from({ length: 7 }, (_, i) => `${IMG}product${426 + i}.jpeg`)), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer earring piece available in multiple colors.', sku: 'PA-ER-069', badge: 'New' },
    { id: 221, name: 'Designer Earring 070', category: 'Earring', images: JSON.stringify(Array.from({ length: 11 }, (_, i) => `${IMG}product${433 + i}.jpeg`)), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer earring piece available in multiple colors.', sku: 'PA-ER-070', badge: 'New' }
  ];

  for (let i = 0; i < 21; i++) {
    const id = 222 + i;
    const seq = i + 1;
    extraProducts.push({ id, name: `Designer Kada ${String(seq).padStart(3, '0')}`, category: 'Kada', images: JSON.stringify([`${IMG}product${444 + i}.jpeg`]), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer kada set from our premium collection.', sku: `PA-KD-${String(seq).padStart(3, '0')}`, badge: 'New' });
  }

  for (let i = 0; i < 10; i++) {
    const id = 243 + i;
    const seq = i + 1;
    extraProducts.push({ id, name: `Designer Bracelet ${String(seq).padStart(3, '0')}`, category: 'Bracelet', images: JSON.stringify([`${IMG}product${465 + i}.jpeg`, `${IMG}product${475 + i}.jpeg`]), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Elegant designer bracelet piece from our premium collection.', sku: `PA-BCL-${String(seq).padStart(3, '0')}`, badge: 'New' });
  }

  for (let i = 0; i < 7; i++) {
    const id = 253 + i;
    const seq = 35 + i;
    extraProducts.push({ id, name: `Designer Necklace ${String(seq).padStart(3, '0')}`, category: 'Necklace', images: JSON.stringify([`${IMG}product${485 + i}.jpeg`, `${IMG}product${492 + i}.jpeg`, `${IMG}product${499 + i}.jpeg`]), features: JSON.stringify(['Premium Finish', 'Gold Plated', 'Hypoallergenic', 'Tarnish Resistant']), description: 'Exquisite designer necklace piece from our premium collection.', sku: `PA-NK-${String(seq).padStart(3, '0')}`, badge: 'New' });
  }

  return [...generated, ...extraProducts];
}

function insertProducts() {
  for (const p of buildProducts()) {
    if (!get('SELECT id FROM products WHERE id = ?', [p.id])) {
      exec('INSERT INTO products (id, name, category, sku, badge, images, features, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.category, p.sku, p.badge, p.images, p.features, p.description]);
    }
  }
}

function setMissingPrices() {
  const products = all('SELECT id, category FROM products ORDER BY id');
  const clients = all('SELECT id, tier FROM clients WHERE is_admin = 0 ORDER BY id');
  const baseByCategory = {
    Necklace: 8500,
    Crowns: 12000,
    Brooch: 4500,
    Earring: 3200,
    Kada: 2800,
    Bracelet: 5500
  };
  const tierMultiplier = {
    wholesale: 0.9,
    distributor: 0.82,
    retailer: 1
  };

  for (const client of clients) {
    for (const product of products) {
      if (get('SELECT id FROM pricing WHERE client_id = ? AND product_id = ?', [client.id, product.id])) continue;

      const base = baseByCategory[product.category] || 5000;
      const multiplier = tierMultiplier[client.tier] || 1;
      const variation = (product.id % 11) * 75;
      const price = Math.round((base + variation) * multiplier);
      exec('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [client.id, product.id, price]);
    }
  }
}

async function ensureSeedData() {
  insertDefaultUsers();
  insertProducts();
  setMissingPrices();
  save();
}

module.exports = { ensureSeedData };
