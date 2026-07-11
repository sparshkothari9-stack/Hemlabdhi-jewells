const IMG = typeof IMG_PREFIX !== 'undefined' ? IMG_PREFIX : 'images/';

const productVideos = {
  1: `${IMG}video1.mp4`,
  2: `${IMG}video2.mp4`,
  3: `${IMG}video3.mp4`
};

const isCrown = (id) => id >= 83 && id <= 98;
const isBrooch = (id) => id >= 99 && id <= 116;
const isNewNecklace = (id) => id >= 117;
const isEarring = (id) => id >= 152 && id <= 216;
const isKada = (id) => id >= 222 && id <= 242;
const isBracelet = (id) => id >= 243 && id <= 252;
const isReplica = (id) => id >= 253 && id <= 395;

const products = Array.from({ length: 216 }, (_, i) => {
  const id = i + 1;
  const img1 = id;
  const crown = isCrown(id);
  const brooch = isBrooch(id);
  const earring = isEarring(id);
  let seq, name, category, skuPrefix, desc, imgs;
  if (earring) {
    seq = id - 151;
    if (id > 199) seq = id - 152;
    name = `Designer Earring ${String(seq).padStart(3, '0')}`;
    category = "Earring";
    skuPrefix = "PA-ER";
    desc = `Elegant designer earring piece from our premium collection. Crafted with attention to detail and high-quality materials.`;
    imgs = [`${IMG}product${id + 183}.jpeg`];
  } else if (brooch) {
    seq = id - 98;
    name = `Designer Brooch ${String(seq).padStart(3, '0')}`;
    category = "Brooch";
    skuPrefix = "PA-BR";
    desc = `Elegant designer brooch piece from our premium collection. Crafted with attention to detail and high-quality materials.`;
    imgs = [`${IMG}product${2*id-99}.jpeg`, `${IMG}product${2*id-98}.jpeg`, `${IMG}product${id + 52}.jpeg`];
  } else if (crown) {
    seq = id - 82;
    name = `Designer Crown ${String(seq).padStart(3, '0')}`;
    category = "Crowns";
    skuPrefix = "PA-CR";
    desc = `Regal designer crown piece from our premium collection. Crafted with attention to detail and high-quality materials.`;
    imgs = [`${IMG}product${id}.jpeg`, `${IMG}product${id + 52}.jpeg`];
  } else {
    seq = id;
    name = `Designer Necklace ${String(seq).padStart(3, '0')}`;
    category = "Necklace";
    skuPrefix = "PA-NK";
    desc = `Exquisite designer necklace piece from our premium collection. Crafted with attention to detail and high-quality materials.`;
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
    images: (earring || brooch || crown || isNewNecklace(id)) ? imgs : [`${IMG}product${img1}.jpeg`],
    video: productVideos[id] || null,
    badge: "New",
    description: desc,
    features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
    sku: `${skuPrefix}-${String(seq).padStart(3, '0')}`
  };
}).filter(p => (p.id >= 83 && p.id <= 116) || (isEarring(p.id) && p.id !== 199) || isKada(p.id) || isBracelet(p.id) || isReplica(p.id));

const replicaColors = [
  { name: "Maroon", color: "#800000" },
  { name: "Green", color: "#008000" },
  { name: "Pink", color: "#FFC0CB" },
  { name: "Rani", color: "#E30B5C" },
  { name: "Black", color: "#000000" },
  { name: "Montana", color: "#2C3E50" },
  { name: "Rose", color: "#FF007F" },
  { name: "Mint", color: "#98FF98" },
  { name: "Rose mint", color: "#E8B4B8" },
  { name: "White", color: "#FFFFFF" }
];

for (let i = 0; i < 120; i++) {
  const id = 253 + i;
  const seq = i + 1;
  products.push({
    id,
    name: `Necklace Ad Replica ${String(seq).padStart(3, '0')}`,
    category: "Necklace Ad Replica",
    images: [`${IMG}product${539 + i}.jpeg`],
    colors: replicaColors,
    video: null,
    badge: "New",
    description: `Exquisite necklace replica piece from our premium collection. Available in Maroon, Green, Pink, Rani, Black, Montana, Rose, Mint, Rose mint, White. Crafted with attention to detail and high-quality materials.`,
    sku: `PA-NR-${String(seq).padStart(3, '0')}`
  });
}
for (let i = 0; i < 23; i++) {
  const id = 373 + i;
  const seq = 121 + i;
  products.push({
    id,
    name: `Necklace Ad Replica ${String(seq).padStart(3, '0')}`,
    category: "Necklace Ad Replica",
    images: [`${IMG}product${659 + i}.jpeg`],
    colors: replicaColors,
    video: null,
    badge: "New",
    description: `Exquisite necklace replica piece from our premium collection. Available in Maroon, Green, Pink, Rani, Black, Montana, Rose, Mint, Rose mint, White. Crafted with attention to detail and high-quality materials.`,
    sku: `PA-NR-${String(seq).padStart(3, '0')}`
  });
}


const earringColors = [
  { name: "Gold", image: `${IMG}product400.jpeg` },
  { name: "Silver", image: `${IMG}product401.jpeg` },
  { name: "Rose Gold", image: `${IMG}product402.jpeg` },
  { name: "Black", image: `${IMG}product403.jpeg` },
  { name: "White", image: `${IMG}product404.jpeg` },
  { name: "Pink", image: `${IMG}product405.jpeg` },
  { name: "Blue", image: `${IMG}product406.jpeg` },
  { name: "Purple", image: `${IMG}product407.jpeg` },
  { name: "Champagne", image: `${IMG}product408.jpeg` }
];

products.push({
  id: 217,
  name: "Designer Earring 065",
  category: "Earring",
  images: earringColors.map(c => c.image),
  colors: earringColors,
  video: null,
  badge: "New",
  description: "Elegant designer earring piece available in multiple colors. Crafted with attention to detail and high-quality materials.",
  features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
  sku: "PA-ER-065"
});

const earringColors2 = [
  { name: "Gold", image: `${IMG}product409.jpeg` },
  { name: "Silver", image: `${IMG}product410.jpeg` },
  { name: "Rose Gold", image: `${IMG}product411.jpeg` },
  { name: "Black", image: `${IMG}product412.jpeg` },
  { name: "White", image: `${IMG}product413.jpeg` },
  { name: "Pink", image: `${IMG}product414.jpeg` },
  { name: "Champagne", image: `${IMG}product415.jpeg` }
];

products.push({
  id: 218,
  name: "Designer Earring 066",
  category: "Earring",
  images: earringColors2.map(c => c.image),
  colors: earringColors2,
  video: null,
  badge: "New",
  description: "Elegant designer earring piece available in multiple colors. Crafted with attention to detail and high-quality materials.",
  features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
  sku: "PA-ER-066"
});

const earringColors3 = [
  { name: "Gold", image: `${IMG}product416.jpeg` },
  { name: "Silver", image: `${IMG}product417.jpeg` },
  { name: "Rose Gold", image: `${IMG}product418.jpeg` },
  { name: "Black", image: `${IMG}product419.jpeg` },
  { name: "White", image: `${IMG}product420.jpeg` },
  { name: "Pink", image: `${IMG}product421.jpeg` },
  { name: "Blue", image: `${IMG}product422.jpeg` },
  { name: "Purple", image: `${IMG}product423.jpeg` },
  { name: "Champagne", image: `${IMG}product424.jpeg` },
  { name: "Coral", image: `${IMG}product425.jpeg` }
];

products.push({
  id: 219,
  name: "Designer Earring 067",
  category: "Earring",
  images: earringColors3.map(c => c.image),
  colors: earringColors3,
  video: null,
  badge: "New",
  description: "Elegant designer earring piece available in multiple colors. Crafted with attention to detail and high-quality materials.",
  features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
  sku: "PA-ER-067"
});

const earringColors4 = [
  { name: "Gold", image: `${IMG}product426.jpeg` },
  { name: "Silver", image: `${IMG}product427.jpeg` },
  { name: "Rose Gold", image: `${IMG}product428.jpeg` },
  { name: "Black", image: `${IMG}product429.jpeg` },
  { name: "White", image: `${IMG}product430.jpeg` },
  { name: "Pink", image: `${IMG}product431.jpeg` },
  { name: "Champagne", image: `${IMG}product432.jpeg` }
];

products.push({
  id: 220,
  name: "Designer Earring 068",
  category: "Earring",
  images: earringColors4.map(c => c.image),
  colors: earringColors4,
  video: null,
  badge: "New",
  description: "Elegant designer earring piece available in multiple colors. Crafted with attention to detail and high-quality materials.",
  features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
  sku: "PA-ER-068"
});

const earringColors5 = [
  { name: "Gold", image: `${IMG}product433.jpeg` },
  { name: "Silver", image: `${IMG}product434.jpeg` },
  { name: "Rose Gold", image: `${IMG}product435.jpeg` },
  { name: "Black", image: `${IMG}product436.jpeg` },
  { name: "White", image: `${IMG}product437.jpeg` },
  { name: "Pink", image: `${IMG}product438.jpeg` },
  { name: "Blue", image: `${IMG}product439.jpeg` },
  { name: "Purple", image: `${IMG}product440.jpeg` },
  { name: "Champagne", image: `${IMG}product441.jpeg` },
  { name: "Coral", image: `${IMG}product442.jpeg` },
  { name: "Lavender", image: `${IMG}product443.jpeg` }
];

products.push({
  id: 221,
  name: "Designer Earring 069",
  category: "Earring",
  images: earringColors5.map(c => c.image),
  colors: earringColors5,
  video: null,
  badge: "New",
  description: "Elegant designer earring piece available in multiple colors. Crafted with attention to detail and high-quality materials.",
  features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
  sku: "PA-ER-069"
});

for (let i = 0; i < 21; i++) {
  const id = 222 + i;
  const seq = i + 1;
  products.push({
    id,
    name: `Designer Kada ${String(seq).padStart(3, '0')}`,
    category: "Kada",
    images: [`${IMG}product${444 + i}.jpeg`],
    video: null,
    badge: "New",
    description: `Elegant designer kada set from our premium collection. Crafted with attention to detail and high-quality materials.`,
    features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
    sku: `PA-KD-${String(seq).padStart(3, '0')}`
  });
}

for (let i = 0; i < 10; i++) {
  const id = 243 + i;
  const seq = i + 1;
  products.push({
    id,
    name: `Designer Bracelet ${String(seq).padStart(3, '0')}`,
    category: "Bracelet",
    images: [`${IMG}product${465 + i}.jpeg`, `${IMG}product${475 + i}.jpeg`],
    video: null,
    badge: "New",
    description: `Elegant designer bracelet piece from our premium collection. Crafted with attention to detail and high-quality materials.`,
    features: ["Premium Finish", "Gold Plated", "Hypoallergenic", "Tarnish Resistant"],
    sku: `PA-BCL-${String(seq).padStart(3, '0')}`
  });
}

const categories = [
  { name: "Necklace Ad Replica", image: `${IMG}product539.jpeg`, count: `143 Designs` },
  { name: "Crowns", image: `${IMG}product83.jpeg`, count: `16 Designs` },
  { name: "Brooch", image: `${IMG}product99.jpeg`, count: `18 Designs` },
  { name: "Earring", image: `${IMG}product335.jpeg`, count: `69 Designs` },
  { name: "Kada", image: `${IMG}product444.jpeg`, count: `21 Designs` },
  { name: "Bracelet", image: `${IMG}product465.jpeg`, count: `10 Designs` }
];

const heroSlides = [
  {
    bg: `${IMG}product33.jpeg`,
    tag: "New Collection 2026",
    title: "Elegance Redefined",
    subtitle: "Discover our exclusive collection of handcrafted necklace pieces designed for the modern woman.",
    btnText: "Shop Now",
    btnLink: "pages/products.html"
  },
  {
    bg: `${IMG}product34.jpeg`,
    tag: "Premium Quality",
    title: "Necklace & Crowns Collection",
    subtitle: "Explore our wide range of designer necklaces and regal crowns. Perfect for every occasion.",
    btnText: "Shop Now",
    btnLink: "pages/products.html"
  },
  {
    bg: `${IMG}product35.jpeg`,
    tag: "Festive Offer",
    title: "Shine This Festival Season",
    subtitle: "Get amazing deals on our necklace collection.",
    btnText: "Shop Collection",
    btnLink: "pages/products.html"
  }
];
