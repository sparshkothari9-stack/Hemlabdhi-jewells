const { get, all, run } = require('./db-helpers');
const { getDB } = require('./db');

(async () => {
  await getDB();

  const products = all('SELECT id, category FROM products ORDER BY id');
  const clients = all('SELECT id, tier FROM clients WHERE is_admin = 0 ORDER BY id');
  console.log(`Setting missing prices for ${products.length} products and ${clients.length} clients...`);

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

  let inserted = 0;
  for (const client of clients) {
    for (const product of products) {
      const existing = get('SELECT id FROM pricing WHERE client_id = ? AND product_id = ?', [client.id, product.id]);
      if (existing) continue;

      const base = baseByCategory[product.category] || 5000;
      const multiplier = tierMultiplier[client.tier] || 1;
      const variation = (product.id % 11) * 75;
      const price = Math.round((base + variation) * multiplier);

      run('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [client.id, product.id, price]);
      inserted++;
    }
  }

  const counts = all('SELECT client_id, COUNT(*) c FROM pricing GROUP BY client_id ORDER BY client_id');
  console.log(`Inserted ${inserted} missing prices.`);
  for (const row of counts) {
    console.log(`Client ${row.client_id}: ${row.c} prices`);
  }
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
