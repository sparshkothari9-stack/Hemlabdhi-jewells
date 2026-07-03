const { get, all, run } = require('./db-helpers');
const { getDB } = require('./db');

(async () => {
  await getDB();

  const IMG = 'images/';

  function isCrown(id) { return id >= 83 && id <= 98; }
  function isBrooch(id) { return id >= 99 && id <= 116; }
  function isNewNecklace(id) { return id >= 117; }
  function isEarring(id) { return id >= 152 && id <= 216; }

  const generated = Array.from({ length: 216 }, (_, i) => {
    const id = i + 1;
    const img1 = id;
    const crown = isCrown(id);
    const brooch = isBrooch(id);
    const earring = isEarring(id);
    let seq, name, category, skuPrefix, desc, imgs;
    if (earring) {
      seq = id - 151;
      name = `Designer Earring ${String(seq).padStart(3, '0')}`;
      category = "Earring";
      skuPrefix = "PA-ER";
      desc = `Elegant designer earring piece from our premium collection.`;
      imgs = [`${IMG}product${id + 183}.jpeg`];
    } else if (brooch) {
      seq = id - 98;
      name = `Designer Brooch ${String(seq).padStart(3, '0')}`;
      category = "Brooch";
      skuPrefix = "PA-BR";
      desc = `Elegant designer brooch piece from our premium collection.`;
      imgs = [`${IMG}product${2*id-99}.jpeg`, `${IMG}product${2*id-98}.jpeg`, `${IMG}product${id + 52}.jpeg`];
    } else if (crown) {
      seq = id - 82;
      name = `Designer Crown ${String(seq).padStart(3, '0')}`;
      category = "Crowns";
      skuPrefix = "PA-CR";
      desc = `Regal designer crown piece from our premium collection.`;
      imgs = [`${IMG}product${id}.jpeg`, `${IMG}product${id + 52}.jpeg`];
    } else {
      seq = id;
      name = `Designer Necklace ${String(seq).padStart(3, '0')}`;
      category = "Necklace";
      skuPrefix = "PA-NK";
      desc = `Exquisite designer necklace piece from our premium collection.`;
    }
    if (isNewNecklace(id) && !earring) {
      seq = id <= 125 ? id - 116 : id - 117;
      imgs = [(id === 151 ? `${IMG}product271.jpeg` : `${IMG}product${id + 52}.jpeg`), `${IMG}product${236 + seq}.jpeg`, `${IMG}product${300 + seq}.jpeg`];
      name = `Designer Necklace ${String(seq).padStart(3, '0')}`;
    }
    return {
      id, name, category,
      images: JSON.stringify((earring || brooch || crown || isNewNecklace(id)) ? imgs : [`${IMG}product${img1}.jpeg`]),
      badge: "New",
      description: desc,
      features: JSON.stringify(["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"]),
      sku: `${skuPrefix}-${String(seq).padStart(3, '0')}`
    };
  }).filter(p => (p.id >= 83 && p.id <= 151 && p.id !== 126) || (p.id >= 152 && p.id <= 216));

  const extraProducts = [
    { id: 217, name: "Designer Earring 066", category: "Earring", images: JSON.stringify(Array.from({length:9},(_,i)=>`${IMG}product${400+i}.jpeg`)), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer earring piece available in multiple colors.", sku: "PA-ER-066", badge: "New" },
    { id: 218, name: "Designer Earring 067", category: "Earring", images: JSON.stringify(Array.from({length:7},(_,i)=>`${IMG}product${409+i}.jpeg`)), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer earring piece available in multiple colors.", sku: "PA-ER-067", badge: "New" },
    { id: 219, name: "Designer Earring 068", category: "Earring", images: JSON.stringify(Array.from({length:10},(_,i)=>`${IMG}product${416+i}.jpeg`)), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer earring piece available in multiple colors.", sku: "PA-ER-068", badge: "New" },
    { id: 220, name: "Designer Earring 069", category: "Earring", images: JSON.stringify(Array.from({length:7},(_,i)=>`${IMG}product${426+i}.jpeg`)), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer earring piece available in multiple colors.", sku: "PA-ER-069", badge: "New" },
    { id: 221, name: "Designer Earring 070", category: "Earring", images: JSON.stringify(Array.from({length:11},(_,i)=>`${IMG}product${433+i}.jpeg`)), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer earring piece available in multiple colors.", sku: "PA-ER-070", badge: "New" }
  ];

  for (let i = 0; i < 21; i++) {
    const id = 222 + i;
    const seq = i + 1;
    extraProducts.push({ id, name: `Designer Kada ${String(seq).padStart(3, '0')}`, category: "Kada", images: JSON.stringify([`${IMG}product${444+i}.jpeg`]), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer kada set from our premium collection.", sku: `PA-KD-${String(seq).padStart(3, '0')}`, badge: "New" });
  }

  for (let i = 0; i < 10; i++) {
    const id = 243 + i;
    const seq = i + 1;
    extraProducts.push({ id, name: `Designer Bracelet ${String(seq).padStart(3, '0')}`, category: "Bracelet", images: JSON.stringify([`${IMG}product${465+i}.jpeg`, `${IMG}product${475+i}.jpeg`]), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Elegant designer bracelet piece from our premium collection.", sku: `PA-BCL-${String(seq).padStart(3, '0')}`, badge: "New" });
  }

  for (let i = 0; i < 7; i++) {
    const id = 253 + i;
    const seq = 35 + i;
    extraProducts.push({ id, name: `Designer Necklace ${String(seq).padStart(3, '0')}`, category: "Necklace", images: JSON.stringify([`${IMG}product${485+i}.jpeg`, `${IMG}product${492+i}.jpeg`, `${IMG}product${499+i}.jpeg`]), features: JSON.stringify(["Premium Finish","Gold Plated","Hypoallergenic","Tarnish Resistant"]), description: "Exquisite designer necklace piece from our premium collection.", sku: `PA-NK-${String(seq).padStart(3, '0')}`, badge: "New" });
  }

  const allProducts = [...generated, ...extraProducts];
  console.log(`Total products to insert: ${allProducts.length}`);

  let count = 0;
  for (const p of allProducts) {
    const existing = get('SELECT id FROM products WHERE id = ?', [p.id]);
    if (!existing) {
      run('INSERT INTO products (id, name, category, sku, badge, images, features, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.category, p.sku, p.badge, p.images, p.features, p.description]);
      count++;
    }
  }
  console.log(`Inserted ${count} new products (${allProducts.length - count} already existed).`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
