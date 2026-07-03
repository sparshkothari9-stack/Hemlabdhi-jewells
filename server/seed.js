require('dotenv').config();

const bcrypt = require('bcryptjs');
const { get, all, run } = require('./db-helpers');
const { getDB } = require('./db');

(async () => {
  await getDB();

  const isProduction = process.env.NODE_ENV === 'production';

  const secret = process.env.JWT_SECRET;
  if (isProduction && (!secret || secret.length < 32)) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    console.error('FATAL: ADMIN_PASSWORD must be set and at least 8 characters.');
    process.exit(1);
  }
  if (!process.env.CLIENT_PASSWORD || process.env.CLIENT_PASSWORD.length < 8) {
    console.error('FATAL: CLIENT_PASSWORD must be set and at least 8 characters.');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'sparshkothari9@gmail.com';
  const adminPass = process.env.ADMIN_PASSWORD;
  const clientPass = process.env.CLIENT_PASSWORD;

  const adminPassword = bcrypt.hashSync(adminPass, 10);
  const clientPassword = bcrypt.hashSync(clientPass, 10);

  const clients = [
    { name: 'Admin', email: adminEmail, password: adminPassword, tier: 'admin', is_admin: 1 },
    { name: 'Rajesh Jewellers', email: 'rajesh@example.com', password: clientPassword, tier: 'wholesale', is_admin: 0 },
    { name: 'Priya Retail', email: 'priya@example.com', password: clientPassword, tier: 'retailer', is_admin: 0 }
  ];

  for (const c of clients) {
    const existing = get('SELECT id FROM clients WHERE email = ?', [c.email]);
    if (!existing) {
      run('INSERT INTO clients (name, email, password, tier, is_admin) VALUES (?, ?, ?, ?, ?)',
        [c.name, c.email, c.password, c.tier, c.is_admin]);
    }
  }

  const products = [
    { id: 83, name: 'Designer Crown 001', category: 'Crowns', sku: 'PA-CR-001', badge: 'New', images: '["images/product83.jpeg","images/product135.jpeg"]', features: '["Premium Finish","Gold Plated","Hypoallergenic"]', description: 'Regal designer crown piece from our premium collection.' },
    { id: 99, name: 'Designer Brooch 001', category: 'Brooch', sku: 'PA-BR-001', badge: 'New', images: '["images/product99.jpeg","images/product100.jpeg","images/product151.jpeg"]', features: '["Premium Finish","Gold Plated","Hypoallergenic"]', description: 'Elegant designer brooch piece from our premium collection.' },
    { id: 152, name: 'Designer Earring 001', category: 'Earring', sku: 'PA-ER-001', badge: 'New', images: '["images/product335.jpeg"]', features: '["Premium Finish","Gold Plated","Hypoallergenic"]', description: 'Elegant designer earring piece from our premium collection.' },
    { id: 222, name: 'Designer Kada 001', category: 'Kada', sku: 'PA-KD-001', badge: 'New', images: '["images/product444.jpeg"]', features: '["Premium Finish","Gold Plated","Hypoallergenic"]', description: 'Elegant designer kada set from our premium collection.' },
    { id: 243, name: 'Designer Bracelet 001', category: 'Bracelet', sku: 'PA-BCL-001', badge: 'New', images: '["images/product465.jpeg","images/product475.jpeg"]', features: '["Premium Finish","Gold Plated","Hypoallergenic"]', description: 'Elegant designer bracelet piece from our premium collection.' }
  ];

  run('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, sku TEXT, badge TEXT, images TEXT, features TEXT, description TEXT)');

  for (const p of products) {
    const existing = get('SELECT id FROM products WHERE id = ?', [p.id]);
    if (!existing) {
      run('INSERT INTO products (id, name, category, sku, badge, images, features, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.category, p.sku, p.badge, p.images, p.features, p.description]);
    }
  }

  const rajesh = get("SELECT id FROM clients WHERE email = 'rajesh@example.com'");
  const priya = get("SELECT id FROM clients WHERE email = 'priya@example.com'");

  if (rajesh) {
    const pricing = [[rajesh.id, 83, 12000], [rajesh.id, 99, 4500], [rajesh.id, 152, 3200], [rajesh.id, 222, 2800], [rajesh.id, 243, 5500]];
    for (const [cid, pid, price] of pricing) {
      if (!get('SELECT id FROM pricing WHERE client_id = ? AND product_id = ?', [cid, pid])) {
        run('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [cid, pid, price]);
      }
    }
  }

  if (priya) {
    const pricing = [[priya.id, 83, 14000], [priya.id, 99, 5200], [priya.id, 152, 3800], [priya.id, 222, 3500], [priya.id, 243, 6500]];
    for (const [cid, pid, price] of pricing) {
      if (!get('SELECT id FROM pricing WHERE client_id = ? AND product_id = ?', [cid, pid])) {
        run('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [cid, pid, price]);
      }
    }
  }

  console.log('Seed completed successfully!');
  if (!isProduction) {
    console.log('---');
    console.log(`Admin:     ${adminEmail}`);
    console.log('Rajesh (wholesale): rajesh@example.com');
    console.log('Priya (retailer):   priya@example.com');
  }
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
