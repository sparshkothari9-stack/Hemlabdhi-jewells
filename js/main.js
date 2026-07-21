let cart = [];
let wishlist = [];
let serverPrices = null;
let stockData = {};
let appliedCoupon = null;

const PAGE_PREFIX = window.location.pathname.includes('/pages/') ? '' : 'pages/';
const ROOT_PREFIX = window.location.pathname.includes('/pages/') ? '../' : '';
const API_BASE = window.location.origin;
const WHATSAPP_NUMBER = '919321671416';

if (!localStorage.getItem('pa_token')) {
  const publicPages = ['about.html', 'contact.html', 'enquiry.html'];
  const currentPage = window.location.pathname.split('/').pop();
  if (!publicPages.includes(currentPage)) {
    window.location.href = ROOT_PREFIX + 'login.html';
  }
}

function getToken() { return localStorage.getItem('pa_token'); }
function getClientInfo() { try { return JSON.parse(localStorage.getItem('pa_client')); } catch { return null; } }
function isLoggedIn() { return !!getToken(); }
function logout() { localStorage.removeItem('pa_token'); localStorage.removeItem('pa_client'); window.location.reload(); }
function clearAuth() { localStorage.removeItem('pa_token'); localStorage.removeItem('pa_client'); }
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
const escapeHtml = sanitize;

async function initCart() {
  if (!isLoggedIn()) { cart = []; updateCartUI(); return; }
  try {
    const res = await fetch(API_BASE + '/api/cart', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.ok) {
      const data = await res.json();
      cart = Array.isArray(data.cart) ? data.cart : [];
    }
  } catch { cart = []; }
  updateCartUI();
}

function saveCart() {}

async function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCartUI();
  renderCartDrawer();
  renderCartPage();
  if (!isLoggedIn()) return;
  try {
    await fetch(API_BASE + '/api/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ product_id: productId })
    });
  } catch {}
}

async function updateQty(productId, newQty) {
  if (newQty < 1) { await removeFromCart(productId); return; }
  const item = cart.find(i => i.id === productId);
  if (item) { item.qty = newQty; updateCartUI(); renderCartDrawer(); renderCartPage(); }
  if (!isLoggedIn()) return;
  try {
    await fetch(API_BASE + '/api/cart/update-qty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ product_id: productId, qty: newQty })
    });
  } catch {}
  await syncCartCount();
}

async function syncCartCount() {
  if (!isLoggedIn()) return;
  try {
    const res = await fetch(API_BASE + '/api/cart/count', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.ok) {
      const data = await res.json();
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = data.count;
        el.style.display = data.count > 0 ? 'flex' : 'none';
      });
    }
  } catch {}
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartUI() {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = getCartCount();
    el.style.display = getCartCount() > 0 ? 'flex' : 'none';
  });
}

// ===== WISHLIST =====
async function initWishlist() {
  if (!isLoggedIn()) { wishlist = []; updateWishlistUI(); return; }
  try {
    const res = await fetch(API_BASE + '/api/wishlist', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.ok) {
      const data = await res.json();
      wishlist = Array.isArray(data.wishlist) ? data.wishlist.map(i => i.id) : [];
    }
  } catch { wishlist = []; }
  updateWishlistUI();
}

function saveWishlist() {}

async function toggleWishlist(productId) {
  const idx = wishlist.indexOf(productId);
  if (idx > -1) {
    wishlist.splice(idx, 1);
    showToast('Removed from wishlist');
  } else {
    wishlist.push(productId);
    const product = products.find(p => p.id === productId);
    showToast(`${product ? product.name : 'Item'} added to wishlist!`);
  }
  updateWishlistUI();
  if (!isLoggedIn()) return;
  try {
    await fetch(API_BASE + '/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ product_id: productId })
    });
  } catch {}
}

function isInWishlist(productId) {
  return wishlist.includes(productId);
}

function updateWishlistUI() {
  document.querySelectorAll('.wishlist-count').forEach(el => {
    el.textContent = wishlist.length;
    el.style.display = wishlist.length > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    const id = parseInt(btn.dataset.productId);
    if (id) btn.classList.toggle('active', isInWishlist(id));
  });
  renderWishlistDrawer();
}

function openWishlistDrawer() {
  const drawer = document.getElementById('wishlistDrawer');
  const overlay = document.getElementById('wishlistOverlay');
  if (!drawer) return;
  renderWishlistDrawer();
  drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');
}

function closeWishlistDrawer() {
  const drawer = document.getElementById('wishlistDrawer');
  const overlay = document.getElementById('wishlistOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function renderWishlistDrawer() {
  const container = document.getElementById('wishlistDrawerItems');
  if (!container) return;
  if (wishlist.length === 0) {
    container.innerHTML = '<div class="cart-drawer-empty"><div class="empty-icon">&#10084;</div><p>Your wishlist is empty</p></div>';
    return;
  }
  container.innerHTML = wishlist.map(id => {
    const product = products.find(p => p.id === id);
    if (!product) return '';
    return `
      <div class="cart-drawer-item">
        <img src="${product.images[0]}" alt="${product.name}" style="cursor:pointer" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${product.id}'">
        <div class="cart-drawer-item-info">
          <h4 style="cursor:pointer" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${product.id}'">${product.name}</h4>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="cart-item-remove" onclick="toggleWishlist(${product.id})">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SEARCH =====
function openSearch() {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  const input = document.getElementById('searchInput');
  if (input) { input.value = ''; input.focus(); }
  document.getElementById('searchResults').innerHTML = '';
}

function closeSearch() {
  const overlay = document.getElementById('searchOverlay');
  if (overlay) overlay.classList.remove('active');
}

function searchProducts(query) {
  const results = document.getElementById('searchResults');
  if (!results) return;
  if (!query.trim()) { results.innerHTML = ''; return; }
  const q = query.toLowerCase().trim();
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q)
  );
  if (matches.length === 0) {
    results.innerHTML = '<div class="search-no-results">No products found</div>';
    return;
  }
  results.innerHTML = matches.slice(0, 10).map(p => `
    <div class="search-result-item" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'">
      <img src="${p.images[0]}" alt="${p.name}">
      <div class="search-result-item-info">
        <h4>${p.name}</h4>
      </div>
    </div>
  `).join('');
}

// ===== REVIEWS =====
let _reviewsCache = {};

async function loadAllReviews() {
  try {
    const res = await fetch(API_BASE + '/api/reviews');
    const data = await res.json();
    _reviewsCache = data.reviews || {};
  } catch { _reviewsCache = {}; }
}

function getReviews(productId) {
  return _reviewsCache[productId] || [];
}

async function saveReview(productId, review) {
  try {
    const res = await fetch(API_BASE + '/api/reviews/' + productId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: review.name, text: review.text, rating: review.rating })
    });
    if (res.ok) {
      if (!_reviewsCache[productId]) _reviewsCache[productId] = [];
      _reviewsCache[productId].unshift({
        name: sanitize(review.name || ''),
        text: sanitize(review.text || ''),
        rating: Number(review.rating) || 0,
        date: review.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      });
    }
  } catch {}
}

function getAverageRating(productId) {
  const reviews = getReviews(productId);
  if (reviews.length === 0) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function starHTML(rating, interactive) {
  let html = '<div class="stars">';
  for (let i = 1; i <= 5; i++) {
    if (interactive) {
      html += `<i class="fas fa-star${i <= rating ? '' : ' star-empty'}" data-star="${i}"></i>`;
    } else {
      html += `<i class="fas fa-star${i <= rating ? '' : ' star-empty'}"></i>`;
    }
  }
  html += '</div>';
  return html;
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer) return;
  renderCartDrawer();
  drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function renderCartDrawer() {
  const container = document.getElementById('cartDrawerItems');
  if (!container) return;
  const footer = document.getElementById('cartDrawerFooter');
  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-drawer-empty"><div class="empty-icon">&#128722;</div><p>Your cart is empty</p></div>';
    if (footer) footer.style.display = 'none';
    return;
  }
  if (footer) footer.style.display = 'block';
  container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    return `
      <div class="cart-drawer-item">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
        <div class="cart-drawer-item-info">
          <h4>${product.name}</h4>
          <div class="cart-price-note"><i class="fab fa-whatsapp"></i> Message for price</div>
          <div class="cart-item-qty">
            <button onclick="updateQty(${product.id}, ${item.qty - 1})">-</button>
            <span>${item.qty}</span>
            <button onclick="updateQty(${product.id}, ${item.qty + 1})">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${product.id})">Remove</button>
        </div>
      </div>
    `;
  }).join('');
  const totalEl = document.getElementById('cartDrawerTotal');
  if (totalEl) totalEl.innerHTML = '<div class="cart-price-help">Prices are shared on WhatsApp after reviewing your selected items.</div>';
}

function renderCartPage() {
  const container = document.getElementById('cartPageItems');
  const summary = document.getElementById('cartSummary');
  const empty = document.getElementById('cartEmpty');
  if (!container) return;
  if (cart.length === 0) {
    if (empty) empty.style.display = 'block';
    if (container) container.style.display = 'none';
    if (summary) summary.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (container) container.style.display = 'block';
  if (summary) summary.style.display = 'block';
  renderCartSummary();
  if (container) {
    container.innerHTML = cart.map(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return '';
      return `
        <div class="cart-page-item">
          <img src="${product.images[0]}" alt="${product.name}">
          <div class="cart-page-item-info">
            <h3>${product.name}</h3>

            <div class="cart-item-qty" style="margin-top: 8px;">
              <button onclick="updateQty(${product.id}, ${item.qty - 1})">-</button>
              <span>${item.qty}</span>
              <button onclick="updateQty(${product.id}, ${item.qty + 1})">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${product.id})">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function checkout() {
  if (cart.length === 0) { showToast('Your cart is empty!'); return; }
  openCartWhatsApp();
}

function renderCartSummary() {
  const container = document.getElementById('cartSummaryTotals');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Your cart is empty</p>';
    return;
  }
  container.innerHTML = `
    <p class="cart-price-help">Prices are not shown online. Send your cart on WhatsApp and we will reply with item prices.</p>
    <button class="btn whatsapp-cart-btn" type="button" onclick="openCartWhatsApp()"><i class="fab fa-whatsapp"></i><span>Message on WhatsApp for prices</span></button>
  `;
}

function placeOrder() {
  const fields = [
    { id: 'checkoutName', label: 'Full Name', validator: v => v.length >= 2 },
    { id: 'checkoutPhone', label: 'Phone', validator: v => /^\+?[\d\s\-]{10,15}$/.test(v) },
    { id: 'checkoutAddress', label: 'Address', validator: v => v.length >= 5 },
    { id: 'checkoutCity', label: 'City', validator: v => v.length >= 2 },
    { id: 'checkoutState', label: 'State', validator: v => v.length >= 2 },
    { id: 'checkoutPincode', label: 'Pincode', validator: v => /^\d{6}$/.test(v) }
  ];
  let firstError = null;
  const formData = {};
  for (const f of fields) {
    const el = document.getElementById(f.id);
    const val = el ? el.value.trim() : '';
    formData[f.id.replace('checkout', '').toLowerCase()] = val;
    const errorEl = el ? el.parentNode.querySelector('.field-error') : null;
    if (!val || !f.validator(val)) {
      if (el) el.style.borderColor = 'var(--red)';
      if (errorEl) errorEl.textContent = `Please enter a valid ${f.label}`;
      if (!firstError) firstError = el;
    } else {
      if (el) el.style.borderColor = '';
      if (errorEl) errorEl.textContent = '';
    }
  }
  if (firstError) {
    showToast('Please fix the highlighted fields');
    firstError.focus();
    return;
  }

  if (cart.length === 0) { showToast('Your cart is empty'); return; }

  let subtotal = 0;
  const items = [];
  for (const item of cart) {
    const product = products.find(p => p.id === item.id);
    if (!product) continue;
    const price = getProductPrice(product);
    if (!price) continue;
    items.push({ product_id: product.id, product_name: product.name, price, qty: item.qty });
    subtotal += price * item.qty;
  }
  if (items.length === 0) { showToast('No priced items in cart'); return; }

  const shipping = subtotal >= 5000 ? 0 : 199;
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const body = {
    name: formData.name,
    phone: formData.phone,
    address: formData.address,
    city: formData.city,
    state: formData.state,
    pincode: formData.pincode,
    items,
    subtotal,
    shipping,
    coupon_code: appliedCoupon ? appliedCoupon.code : ''
  };

  const submitBtn = document.getElementById('placeOrderBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Placing Order...'; }

  fetch(API_BASE + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}) },
    body: JSON.stringify(body)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      fetch(API_BASE + '/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ phone: formData.phone, address: formData.address, city: formData.city, state: formData.state, pincode: formData.pincode })
      }).catch(() => {});
      showToast('Order placed successfully!');
      const waMsg = encodeURIComponent(`New Order #${data.order?.id || ''}!\nName: ${formData.name}\nAmount: ₹${total}\nItems: ${items.length}`);
      window.open(`https://wa.me/919321671416?text=${waMsg}`, '_blank');
      cart = [];
      updateCartUI();
      appliedCoupon = null;
      setTimeout(() => { window.location.href = ROOT_PREFIX + 'index.html'; }, 2000);
    } else {
      showToast(data.error || 'Failed to place order');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
    }
  })
  .catch(err => {
    showToast('Failed to connect to server. Please try again.');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
  });
}

function getProductPrice(product) {
  if (product && product._serverPrice != null) return product._serverPrice;
  if (product && serverPrices && serverPrices[product.id] != null) return serverPrices[product.id];
  return null;
}

function getProductUrl(productId) {
  return `${window.location.origin}/pages/product-detail.html?id=${productId}`;
}

function getPriceWhatsAppUrl(product) {
  const msg = `Hi, I want the price for ${product.name} (${product.sku}). ${getProductUrl(product.id)}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function getCartWhatsAppUrl() {
  const lines = cart
    .map(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return null;
      return `- ${product.name} (${product.sku}) x ${item.qty}: ${getProductUrl(product.id)}`;
    })
    .filter(Boolean);
  const msg = lines.length
    ? `Hi, please share prices for these items:\n${lines.join('\n')}`
    : 'Hi, I want to know product prices.';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function openCartWhatsApp() {
  if (cart.length === 0) { showToast('Your cart is empty!'); return; }
  window.open(getCartWhatsAppUrl(), '_blank');
}

function priceRequestHTML(product, extraClass = '') {
  return `<a class="price-request ${extraClass}" href="${getPriceWhatsAppUrl(product)}" target="_blank" onclick="event.stopPropagation();"><i class="fab fa-whatsapp"></i><span>Message on WhatsApp for price</span></a>`;
}

async function initAuth() {
  if (!isLoggedIn()) {
    renderAuthUI();
    return;
  }
  try {
    const res = await fetch(API_BASE + '/api/products', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearAuth();
      throw new Error('Auth failed');
    }
    const data = await res.json();
    serverPrices = {};
    for (const p of data.products) {
      if (p.price != null) {
        serverPrices[p.id] = p.price;
        const product = products.find(x => x.id === p.id);
        if (product) product._serverPrice = p.price;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server prices:', err.message);
  }
  try {
    const stockRes = await fetch(API_BASE + '/api/stock', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (stockRes.ok) {
      const stockData_ = await stockRes.json();
      stockData = stockData_.stock || {};
    }
  } catch {}
  renderAuthUI();
}

function renderAuthUI() {
  const container = document.querySelector('.header-right');
  if (!container) return;
  const existing = container.querySelector('.auth-btn');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.className = 'header-icon auth-btn';
  if (isLoggedIn()) {
    const client = getClientInfo();
    btn.innerHTML = `<i class="fas fa-user"></i>`;
    btn.title = client ? client.name : 'Account';
    btn.onclick = logout;
    if (client && client.is_admin) {
      const adminBtn = document.createElement('button');
      adminBtn.className = 'header-icon';
      adminBtn.innerHTML = '<i class="fas fa-cog"></i>';
      adminBtn.title = 'Admin Panel';
      adminBtn.onclick = () => window.location.href = ROOT_PREFIX + 'admin.html';
      adminBtn.style.marginRight = '8px';
      container.insertBefore(adminBtn, container.firstChild);
    }
  } else {
    return;
  }
  container.insertBefore(btn, container.firstChild);
}

function renderProducts(containerId, productsToRender) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = productsToRender.map(p => {
    const wished = isInWishlist(p.id);
    const avgRating = getAverageRating(p.id);
    const reviewCount = getReviews(p.id).length;
    const priceHTML = priceRequestHTML(p);
    const stock = stockData[p.id];
    const stockBadge = stock ? (stock.stock <= 0 ? '<div class="product-card-badge sold-out">Sold Out</div>' : stock.stock <= stock.low_stock_threshold ? '<div class="product-card-badge low-stock-badge">Only ' + stock.stock + ' left</div>' : '') : '';
    const badge = stockBadge || (p.badge ? `<div class="product-card-badge sale">${p.badge}</div>` : '');
    return `
      <div class="product-card animate-on-scroll" data-product-id="${p.id}" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'" role="button" tabindex="0" aria-label="${p.name}">
        ${badge}
        <button class="wishlist-btn ${wished ? 'active' : ''}" data-product-id="${p.id}" onclick="event.stopPropagation(); toggleWishlist(${p.id})" aria-label="${wished ? 'Remove from' : 'Add to'} wishlist"><i class="fa${wished ? 's' : 'r'} fa-heart"></i></button>
        <div class="product-card-image">
          <img src="${p.images[0]}" alt="${p.name}" loading="lazy" onclick="event.stopPropagation(); showImagePopup(this)">
          <img class="img-hover" src="${p.images[1] || p.images[0]}" alt="${p.name}" loading="lazy">
          <div class="product-card-actions">
            <button class="btn quick-view-btn" onclick="event.stopPropagation(); openQuickView(${p.id})">Quick View</button>
            <button class="btn compact-action" onclick="event.stopPropagation(); window.open('${getPriceWhatsAppUrl(p)}', '_blank')"><i class="fab fa-whatsapp"></i> Price</button>
            <button class="btn compact-action" onclick="event.stopPropagation(); window.location.href='${PAGE_PREFIX}enquiry.html?products=${p.id}'">Enquire</button>
          </div>
        </div>
        <div class="product-card-body">
          <h3 class="product-card-title">${p.name}</h3>
          <div class="product-card-rating">${starHTML(Math.round(avgRating))} ${reviewCount > 0 ? `<span>(${reviewCount})</span>` : ''}</div>
          <div class="product-card-price">${priceHTML}</div>
        </div>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.animate-on-scroll:not(.visible)').forEach(el => el.classList.add('visible'));
  container.querySelectorAll('.product-card-image img:first-child').forEach(initLongPress);
}

function renderFeaturedProducts() {
  renderProducts('featuredProducts', products.slice(0, 20));
}

function renderNewCollections() {
  var el = document.getElementById('newCollections');
  if (!el) return;
  var handPanjas = products.filter(function(p) { return p.category === 'Hand Panjas'; }).slice(0, 4);
  var maangTika = products.filter(function(p) { return p.category === 'Maang Tika'; }).slice(0, 2);
  var items = handPanjas.concat(maangTika);
  el.innerHTML = items.map(function(p) {
    return '<a class="new-collections-card" href="' + PAGE_PREFIX + 'product-detail.html?id=' + p.id + '"><img src="' + p.images[0] + '" alt="' + sanitize(p.name) + '" loading="lazy"><div class="new-collections-overlay"><h3>' + sanitize(p.name) + '</h3><span>' + sanitize(p.category) + '</span><div class="box-info"><i class="fas fa-box-open" style="margin-right:4px"></i>' + (BOX_QTY[p.category] || 1) + ' per box</div></div></a>';
  }).join('');
}

function renderAllProducts() {
  const urlParams = new URLSearchParams(window.location.search);
  const catFilter = urlParams.get('category');
  let filtered = catFilter ? products.filter(p => p.category === catFilter) : products;
  renderProducts('allProducts', filtered);
  const count = document.getElementById('productCount');
  if (count) count.textContent = `Showing ${filtered.length} products`;
}

function renderCategories() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;
  grid.innerHTML = categories.map((cat, i) => `
    <div class="category-card animate-on-scroll delay-${i + 1}" onclick="window.location.href='${PAGE_PREFIX}products.html?category=${encodeURIComponent(cat.filter || cat.name)}'">
      <img src="${cat.image}" alt="${cat.name}" loading="lazy" onclick="event.stopPropagation(); showImagePopup(this)">
      <div class="category-card-overlay">
        <h3>${cat.name}</h3>
        <span>${cat.count}</span>
        ${cat.boxQty > 1 ? `<span style="display:block;margin-top:4px;font-size:11px;color:rgba(255,255,255,0.85);background:rgba(0,0,0,0.4);padding:3px 8px;border-radius:4px;width:fit-content"><i class="fas fa-box-open" style="margin-right:4px"></i>${cat.boxQty} per box</span>` : ''}
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.category-card img').forEach(initLongPress);
  observeNewAnimations(grid);
}

const _preloadedImages = {};

function preloadImage(src) {
  if (_preloadedImages[src]) return;
  _preloadedImages[src] = true;
  const img = new Image();
  img.src = src;
}

let _productImages = [];
let _currentImageIndex = 0;

// ===== RECENTLY VIEWED =====
async function trackRecentlyViewed(id) {
  if (!isLoggedIn()) return;
  try {
    await fetch(API_BASE + '/api/products/recent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ product_id: id })
    });
  } catch {}
}

async function renderRecentlyViewed() {
  const container = document.getElementById('recentlyViewed');
  if (!container) return;
  let recent = [];
  if (isLoggedIn()) {
    try {
      const res = await fetch(API_BASE + '/api/products/recent', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      if (res.ok) {
        const data = await res.json();
        recent = Array.isArray(data.recent) ? data.recent : [];
      }
    } catch {}
  }
  if (recent.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const items = recent.map(id => products.find(p => p.id === id)).filter(Boolean);
  const recentGrid = container.querySelector('.recent-grid');
  recentGrid.innerHTML = items.map(p => `
    <div class="recent-card animate-on-scroll" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'">
      <img src="${p.images[0]}" alt="${p.name}" loading="lazy" onclick="event.stopPropagation(); showImagePopup(this)">
      <div class="recent-card-body">
        <h4>${p.name}</h4>
      </div>
    </div>
  `).join('');
  recentGrid.querySelectorAll('.recent-card img').forEach(initLongPress);
}

// ===== QUICK VIEW =====
function openQuickView(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById('quickViewOverlay');
  const modal = document.getElementById('quickViewModal');
  if (!overlay || !modal) return;
  const quickPriceHTML = priceRequestHTML(p, 'price-request-large');
  modal.innerHTML = `
    <div class="quick-view-close" onclick="closeQuickView()" aria-label="Close">&times;</div>
    <div class="quick-view-layout">
      <div class="quick-view-image">
        <img src="${p.images[0]}" alt="${p.name}">
      </div>
      <div class="quick-view-info">
        <div class="product-tag">${p.category}</div>
        <h3>${p.name}</h3>
        ${quickPriceHTML}
        <p class="quick-view-desc">${p.description}</p>
        <button class="btn" onclick="window.open('${getPriceWhatsAppUrl(p)}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp Price</button>
        <button class="btn btn-dark" onclick="closeQuickView(); window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'">View Details</button>
      </div>
    </div>
  `;
  overlay.classList.add('active');
  modal.classList.add('active');
  setTimeout(() => {
    const qvImg = modal.querySelector('.quick-view-image img');
    if (qvImg) initLongPress(qvImg);
  }, 100);
}

function closeQuickView() {
  document.getElementById('quickViewOverlay')?.classList.remove('active');
  document.getElementById('quickViewModal')?.classList.remove('active');
}

// ===== WHATSAPP SHARE =====
function shareOnWhatsApp(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const url = encodeURIComponent(window.location.origin + '/' + PAGE_PREFIX + 'product-detail.html?id=' + id);
  const text = encodeURIComponent(`Check out this ${p.name} at Hem Labdhi Jewels by Pavan Art!`);
  window.open(`https://wa.me/919321671416?text=${text}%20${url}`, '_blank');
}


function getYouMayAlsoLike(product, count = 4) {
  const others = products.filter(p => p.id !== product.id);
  const shuffled = [...others].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function renderProductDetail() {
  const container = document.getElementById('productDetail');
  if (!container) return;
  const urlParams = new URLSearchParams(window.location.search);
  const id = parseInt(urlParams.get('id'));
  const product = products.find(p => p.id === id);
  if (!product) {
    container.innerHTML = '<div class="container" style="text-align:center;padding:80px 20px"><h2>Product not found</h2><a href="../index.html" class="btn" style="margin-top:20px">Go Home</a></div>';
    return;
  }
  _productImages = product.images;
  _currentImageIndex = 0;
  const _cache = document.createElement('img'); _cache.src = product.images[0];
  _productImages.forEach((imgSrc) => preloadImage(imgSrc));
  trackRecentlyViewed(product.id);
  document.title = `${product.name} - Hem Labdhi Jewels by Pavan Art`;
  const avgRating = getAverageRating(product.id);
  const reviews = getReviews(product.id);
  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  const youMayAlsoLike = getYouMayAlsoLike(product, 4);
  const wished = isInWishlist(product.id);
  const priceHTML = priceRequestHTML(product, 'price-request-large');
  const stock = stockData[product.id];
  const stockHTML = stock ? (stock.stock <= 0 ? '<div style="color:var(--red);font-weight:600;margin-bottom:8px;">Sold Out</div>' : stock.stock <= stock.low_stock_threshold ? `<div style="color:var(--red);font-weight:600;margin-bottom:8px;">Only ${stock.stock} left in stock</div>` : `<div style="color:var(--green);font-size:13px;margin-bottom:8px;">In Stock (${stock.stock} available)</div>`) : '';
  container.innerHTML = `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "${sanitize(product.name)}",
      "description": "${sanitize(product.description)}",
      "sku": "${product.sku}",
      "category": "${product.category}",
      "image": "${window.location.origin}/${PAGE_PREFIX}../${product.images[0]}"
    }
    <\/script>
    <div class="container">
      <div class="breadcrumbs">
        <a href="../index.html">Home</a> / <a href="products.html">Products</a> / <span>${product.name}</span>
      </div>
      <div class="product-detail">
        <div class="product-detail-images">
          <div class="product-detail-main-image" id="mainMediaContainer">
            ${product.video ? `
              <video id="mainVideo" width="100%" controls style="display:none;">
                <source src="${product.video}" type="video/mp4">
              </video>
            ` : ''}
            <img id="mainImage" src="${product.images[0]}" alt="${product.name}" onclick="openLightbox()" style="cursor:pointer" decoding="async">
            ${product.images.length > 1 ? `
              <button class="slide-arrow slide-arrow-prev" onclick="event.stopPropagation(); prevImage()" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
              <button class="slide-arrow slide-arrow-next" onclick="event.stopPropagation(); nextImage()" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
            <button class="btn btn-expand" onclick="event.stopPropagation(); openLightbox()" aria-label="Expand image"><i class="fas fa-expand"></i></button>
          </div>
          <div class="product-detail-thumbs" id="productThumbs">
            ${product.images.map((img, i) => `
              <img src="${img}" alt="${product.name}" class="${i === 0 ? 'active' : ''}" onclick="showProductImage('${img}', this)">
            `).join('')}
            ${product.video ? `
              <div class="video-thumb" onclick="showProductVideo('${product.video}', this)" style="width:80px;height:80px;background:#1c1c1c;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid transparent;color:var(--gold);font-size:24px;">
                <i class="fas fa-play"></i>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="product-detail-info">
          <div class="product-tag">${product.category}</div>
          <h1>${product.name}</h1>
          <div class="product-detail-price">${priceHTML}</div>
          <div style="margin-bottom:10px">${starHTML(Math.round(avgRating))} ${reviews.length > 0 ? `<span style="font-size:13px;color:var(--text-secondary)">(${reviews.length} review${reviews.length > 1 ? 's' : ''})</span>` : '<span style="font-size:13px;color:var(--text-secondary)">No reviews yet</span>'}</div>
          <div class="product-detail-description">
            ${stockHTML}
            <p>${product.description}</p>
            ${product.boxQty && product.boxQty > 1 ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(208,176,112,0.08);border:1px solid rgba(208,176,112,0.25);border-radius:6px;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--black)"><i class="fas fa-box-open" style="color:var(--gold);font-size:18px"></i> Box Packing: ${product.boxQty} pieces per box</div>` : ''}
            ${product.features ? `<ul style="margin-top:15px;padding-left:20px;list-style:disc">${product.features.map(f => `<li style="margin-bottom:5px">${f}</li>`).join('')}</ul>` : ''}
            <p style="margin-top:15px"><strong>SKU:</strong> ${product.sku}</p>
          </div>
          ${product.colors ? `
          <div class="color-options">
            <h4>Available Colors</h4>
            <div class="color-swatches">
              ${product.colors.map((c, i) => `
                <button class="color-swatch ${i === 0 ? 'active' : ''}" onclick="selectColor(${product.id}, ${i})" title="${c.name}" aria-label="${c.name}">
                  ${c.color ? `<span style="display:block;width:100%;height:100%;border-radius:50%;background:${c.color}"></span>` : `<img src="${c.image}" alt="${c.name}">`}
                </button>
              `).join('')}
            </div>
            <div class="color-name-pill" id="colorLabel">${product.colors[0].name}</div>
          </div>
          ` : ''}
          <div class="product-detail-actions">
            <div style="display:flex;gap:10px;align-items:center">
              <div class="qty-selector">
                <button onclick="changeDetailQty(-1)" aria-label="Decrease quantity">-</button>
                <input type="text" id="detailQty" value="1" readonly aria-label="Quantity">
                <button onclick="changeDetailQty(1)" aria-label="Increase quantity">+</button>
              </div>
              <button class="wishlist-btn ${wished ? 'active' : ''}" data-product-id="${product.id}" onclick="toggleWishlist(${product.id})" style="position:static;font-size:22px;width:44px;height:44px" aria-label="${wished ? 'Remove from' : 'Add to'} wishlist"><i class="fa${wished ? 's' : 'r'} fa-heart"></i></button>
            </div>
            <button class="btn btn-dark whatsapp-cart-btn" onclick="window.open('${getPriceWhatsAppUrl(product)}', '_blank')"><i class="fab fa-whatsapp"></i><span>Message on WhatsApp for price</span></button>
            <button class="btn share-btn" onclick="shareOnWhatsApp(${product.id})"><i class="fab fa-whatsapp"></i> Share</button>
            <button class="btn" onclick="window.location.href='${PAGE_PREFIX}enquiry.html?products=${product.id}'"><i class="fas fa-file-invoice"></i> Bulk Enquiry</button>
          </div>
        </div>
      </div>
    </div>

    <div class="container reviews-section">
      <h2>Customer Reviews</h2>
      ${reviews.length > 0 ? reviews.map(r => `
        <div class="review-item">
          <div class="review-header">
            <span class="review-name">${sanitize(r.name)}</span>
            <span class="review-date">${sanitize(r.date)}</span>
          </div>
          ${starHTML(r.rating)}
          <div class="review-text">${sanitize(r.text)}</div>
        </div>
      `).join('') : '<p style="color:var(--text-secondary);margin-bottom:15px">Be the first to review this product!</p>'}

      <div class="review-form">
        <h3>Write a Review</h3>
        <div class="star-select" id="starSelect" role="radiogroup" aria-label="Rating">
          <i class="far fa-star" data-star="1" role="radio" aria-label="1 star" tabindex="0"></i>
          <i class="far fa-star" data-star="2" role="radio" aria-label="2 stars" tabindex="0"></i>
          <i class="far fa-star" data-star="3" role="radio" aria-label="3 stars" tabindex="0"></i>
          <i class="far fa-star" data-star="4" role="radio" aria-label="4 stars" tabindex="0"></i>
          <i class="far fa-star" data-star="5" role="radio" aria-label="5 stars" tabindex="0"></i>
        </div>
        <input type="text" class="review-name-input" id="reviewName" placeholder="Your name" maxlength="50" aria-label="Your name">
        <textarea id="reviewText" placeholder="Write your review..." maxlength="500" aria-label="Your review"></textarea>
        <button class="btn" onclick="submitReview(${product.id})">Submit Review</button>
      </div>
    </div>

    ${related.length > 0 ? `
    <div class="container related-section">
      <h2>Related Products</h2>
      <div class="product-grid" id="relatedProducts"></div>
    </div>
    ` : ''}

    <div class="container related-section">
      <h2>You May Also Like</h2>
      <div class="product-grid" id="youMayAlsoLikeGrid"></div>
    </div>
  `;
  setTimeout(() => {
    const mainImg = document.getElementById('mainImage');
    if (mainImg) {
      mainImg.addEventListener('click', function(e) {
        openLightbox();
      });
      initLongPress(mainImg);
    }
    const mainContainer = document.getElementById('mainMediaContainer');
    if (mainContainer) {
      initSwipe(mainContainer, () => prevImage(), () => nextImage());
    }
    document.querySelectorAll('.product-detail-thumbs img').forEach(t => initLongPress(t));
  }, 50);
  if (related.length > 0) {
    renderProducts('relatedProducts', related);
  }
  renderProducts('youMayAlsoLikeGrid', youMayAlsoLike);
  initStarSelector();
}

let detailQty = 1;
function changeDetailQty(delta) {
  detailQty = Math.max(1, detailQty + delta);
  const el = document.getElementById('detailQty');
  if (el) el.value = detailQty;
}

let selectedRating = 0;
function initStarSelector() {
  const container = document.getElementById('starSelect');
  if (!container) return;
  selectedRating = 0;
  container.querySelectorAll('i').forEach(el => {
    el.className = 'far fa-star';
    el.addEventListener('click', function() {
      selectedRating = parseInt(this.dataset.star);
      container.querySelectorAll('i').forEach(i => {
        const filled = parseInt(i.dataset.star) <= selectedRating;
        i.className = filled ? 'fas fa-star active' : 'far fa-star';
      });
    });
  });
}

async function submitReview(productId) {
  const name = document.getElementById('reviewName')?.value.trim() || 'Anonymous';
  const text = document.getElementById('reviewText')?.value.trim();
  if (!text) { showToast('Please write a review'); return; }
  if (selectedRating === 0) { showToast('Please select a rating'); return; }
  await saveReview(productId, { name, rating: selectedRating, text });
  showToast('Review submitted! Thank you.');
  renderProductDetail();
}

let _selectedColorIdx = 0;

function selectColor(productId, idx) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.colors) return;
  _selectedColorIdx = idx;
  const color = product.colors[idx];
  const mainImg = document.getElementById('mainImage');
  const video = document.getElementById('mainVideo');
  const container = document.getElementById('mainMediaContainer');
  if (container) container.classList.remove('zoomed');
  if (mainImg) { mainImg.style.display = 'block'; mainImg.src = color.image || product.images[0]; }
  if (video) video.style.display = 'none';
  document.querySelectorAll('.color-swatch').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
  });
  const label = document.querySelector('.color-name-pill');
  if (label) label.textContent = color.name;
  _currentImageIndex = _productImages.indexOf(color.image);
  if (_currentImageIndex === -1) _currentImageIndex = 0;
  document.querySelectorAll('.product-detail-thumbs img').forEach((t, i) => {
    t.style.borderColor = i === _currentImageIndex ? 'var(--gold)' : 'transparent';
  });
}

function showProductImage(src, thumb) {
  const img = document.getElementById('mainImage');
  const video = document.getElementById('mainVideo');
  const container = document.getElementById('mainMediaContainer');
  if (container) container.classList.remove('zoomed');
  if (img) { img.style.display = 'block'; img.src = src; }
  if (video) video.style.display = 'none';
  _currentImageIndex = _productImages.indexOf(src);
  if (_currentImageIndex === -1) _currentImageIndex = 0;
  if (_productImages[_currentImageIndex + 1]) preloadImage(_productImages[_currentImageIndex + 1]);
  if (_productImages[_currentImageIndex - 1]) preloadImage(_productImages[_currentImageIndex - 1]);
  document.querySelectorAll('.product-detail-thumbs img, .product-detail-thumbs .video-thumb').forEach(t => t.style.borderColor = 'transparent');
  if (thumb) thumb.style.borderColor = 'var(--gold)';
}

function prevImage() {
  if (_productImages.length < 2) return;
  const container = document.getElementById('mainMediaContainer');
  if (container) container.classList.remove('zoomed');
  _currentImageIndex = (_currentImageIndex - 1 + _productImages.length) % _productImages.length;
  const img = document.getElementById('mainImage');
  const video = document.getElementById('mainVideo');
  if (img) { img.style.display = 'block'; img.src = _productImages[_currentImageIndex]; }
  if (video) video.style.display = 'none';
  if (_productImages[_currentImageIndex + 1]) preloadImage(_productImages[_currentImageIndex + 1]);
  if (_productImages[_currentImageIndex - 1]) preloadImage(_productImages[_currentImageIndex - 1]);
  const thumbs = document.querySelectorAll('.product-detail-thumbs img');
  thumbs.forEach((t, i) => t.style.borderColor = i === _currentImageIndex ? 'var(--gold)' : 'transparent');
}

function nextImage() {
  if (_productImages.length < 2) return;
  const container = document.getElementById('mainMediaContainer');
  if (container) container.classList.remove('zoomed');
  _currentImageIndex = (_currentImageIndex + 1) % _productImages.length;
  const img = document.getElementById('mainImage');
  const video = document.getElementById('mainVideo');
  if (img) { img.style.display = 'block'; img.src = _productImages[_currentImageIndex]; }
  if (video) video.style.display = 'none';
  if (_productImages[_currentImageIndex + 1]) preloadImage(_productImages[_currentImageIndex + 1]);
  if (_productImages[_currentImageIndex - 1]) preloadImage(_productImages[_currentImageIndex - 1]);
  const thumbs = document.querySelectorAll('.product-detail-thumbs img');
  thumbs.forEach((t, i) => t.style.borderColor = i === _currentImageIndex ? 'var(--gold)' : 'transparent');
}

function showProductVideo(src, thumb) {
  const img = document.getElementById('mainImage');
  const video = document.getElementById('mainVideo');
  if (img) img.style.display = 'none';
  if (video) { video.style.display = 'block'; video.src = src; video.play(); }
  document.querySelectorAll('.product-detail-thumbs img, .product-detail-thumbs .video-thumb').forEach(t => t.style.borderColor = 'transparent');
  if (thumb) thumb.style.borderColor = 'var(--gold)';
}

// ===== LIGHTBOX =====
function openLightbox() {
  let overlay = document.getElementById('lightboxOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button class="lightbox-close" onclick="closeLightbox()" aria-label="Close lightbox">&times;</button>
      <button class="lightbox-arrow lightbox-prev" onclick="lightboxNav(-1)" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
      <img id="lightboxImage" class="lightbox-image" src="" alt="">
      <button class="lightbox-arrow lightbox-next" onclick="lightboxNav(1)" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
      <div class="lightbox-counter" id="lightboxCounter"></div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', function(e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(1);
    });
  }
  const img = document.getElementById('lightboxImage');
  if (img && _productImages.length > 0) {
    img.src = _productImages[_currentImageIndex];
    if (_productImages[_currentImageIndex + 1]) preloadImage(_productImages[_currentImageIndex + 1]);
    if (_productImages[_currentImageIndex - 1]) preloadImage(_productImages[_currentImageIndex - 1]);
  }
  const counter = document.getElementById('lightboxCounter');
  if (counter) {
    counter.textContent = `${_currentImageIndex + 1} / ${_productImages.length}`;
  }
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const lbImg = document.getElementById('lightboxImage');
    if (lbImg) initLongPress(lbImg);
  }, 100);
}

function closeLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  if (_productImages.length < 2) return;
  _currentImageIndex = (_currentImageIndex + dir + _productImages.length) % _productImages.length;
  const img = document.getElementById('lightboxImage');
  if (img) img.src = _productImages[_currentImageIndex];
  if (_productImages[_currentImageIndex + 1]) preloadImage(_productImages[_currentImageIndex + 1]);
  if (_productImages[_currentImageIndex - 1]) preloadImage(_productImages[_currentImageIndex - 1]);
  const counter = document.getElementById('lightboxCounter');
  if (counter) counter.textContent = `${_currentImageIndex + 1} / ${_productImages.length}`;
  const thumbs = document.querySelectorAll('.product-detail-thumbs img');
  thumbs.forEach((t, i) => t.style.borderColor = i === _currentImageIndex ? 'var(--gold)' : 'transparent');
}

// ===== SWIPE SUPPORT =====
function initSwipe(el, onLeft, onRight) {
  let startX, startY, distX, distY;
  el.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });
  el.addEventListener('touchend', function(e) {
    const touch = e.changedTouches[0];
    distX = touch.clientX - startX;
    distY = touch.clientY - startY;
    if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 50) {
      if (distX > 0) onRight();
      else onLeft();
    }
  }, { passive: true });
}

// ===== LONG PRESS ON IMAGES =====
let _longPressTimer = null;
let _longPressSrc = '';

function initLongPress(imgEl) {
  if (!imgEl) return;
  imgEl.addEventListener('touchstart', function(e) {
    _longPressSrc = this.src || this.querySelector('img')?.src || '';
    if (!_longPressSrc) return;
    _longPressTimer = setTimeout(() => {
      showImagePopup(_longPressSrc);
    }, 800);
  }, { passive: true });
  imgEl.addEventListener('touchmove', function() {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
  }, { passive: true });
  imgEl.addEventListener('touchend', function() {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
  }, { passive: true });
  imgEl.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showImagePopup(this.src || this.querySelector('img')?.src || '');
  });
}

function showImagePopup(el) {
  const src = typeof el === 'string' ? el : (el?.src || el?.currentSrc || '');
  if (!src) return;
  const existing = document.getElementById('imagePopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'imagePopup';
  popup.className = 'image-popup';
  popup.innerHTML = `
    <div class="image-popup-overlay" onclick="closeImagePopup()"></div>
    <div class="image-popup-card">
      <div class="image-popup-preview"><img src="${src}" alt=""></div>
      <div class="image-popup-actions">
        <a class="btn" href="${src}" download target="_blank"><i class="fas fa-download"></i> Save Image</a>
        <a class="btn btn-dark" href="${src}" target="_blank"><i class="fas fa-expand"></i> View Full Size</a>
        <button class="btn" onclick="closeImagePopup()"><i class="fas fa-times"></i> Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  popup.classList.add('active');
}

function closeImagePopup() {
  const popup = document.getElementById('imagePopup');
  if (popup) popup.classList.remove('active');
  setTimeout(() => { const p = document.getElementById('imagePopup'); if (p) p.remove(); }, 300);
}

// ===== COUPON =====
async function applyCoupon() {
  const input = document.getElementById('couponInput');
  const msg = document.getElementById('couponMessage');
  const code = input ? input.value.trim().toUpperCase() : '';
  if (!code) { if (msg) msg.innerHTML = ''; appliedCoupon = null; renderCheckoutOrderTotal(); return; }
  let subtotal = 0;
  try {
    const cartData = JSON.parse(localStorage.getItem('jewelleryCart') || '[]');
    for (const item of cartData) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;
      const price = getProductPrice(product);
      if (price) subtotal += price * item.qty;
    }
  } catch {}
  try {
    const res = await fetch(API_BASE + '/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ code, amount: subtotal })
    });
    const data = await res.json();
    if (data.valid) {
      appliedCoupon = data;
      if (msg) msg.innerHTML = `<span style="color:var(--green);font-weight:600;">Coupon applied! You save ₹${data.discount.toLocaleString()}</span>`;
      renderCheckoutOrderTotal();
    } else {
      appliedCoupon = null;
      if (msg) msg.innerHTML = `<span style="color:var(--red);">${escapeHtml(data.error || 'Invalid coupon')}</span>`;
      renderCheckoutOrderTotal();
    }
  } catch {
    appliedCoupon = null;
    if (msg) msg.innerHTML = '<span style="color:var(--red);">Could not validate coupon</span>';
  }
}



// ===== ENHANCED CHECKOUT =====
function validateCheckoutField(id, errorMsg) {
  const el = document.getElementById(id);
  const errorEl = el ? el.nextElementSibling : null;
  if (!el) return false;
  const val = el.value.trim();
  if (!val) {
    el.style.borderColor = 'var(--red)';
    if (errorEl && errorEl.classList.contains('field-error')) errorEl.textContent = errorMsg;
    return false;
  }
  el.style.borderColor = '';
  if (errorEl && errorEl.classList.contains('field-error')) errorEl.textContent = '';
  return val;
}

async function initCheckoutValidation() {
  const client = getClientInfo();
  if (client) {
    const nameEl = document.getElementById('checkoutName');
    if (nameEl && !nameEl.value) nameEl.value = client.name || '';
    if (getToken()) {
      try {
        const res = await fetch(API_BASE + '/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (res.ok) {
          const data = await res.json();
          const profile = data.client;
          const fields = { checkoutPhone: profile.phone, checkoutAddress: profile.address, checkoutCity: profile.city, checkoutState: profile.state, checkoutPincode: profile.pincode };
          for (const [id, val] of Object.entries(fields)) {
            if (val) {
              const el = document.getElementById(id);
              if (el && !el.value) el.value = val;
            }
          }
        }
      } catch {}
    }
  }

  document.querySelectorAll('#checkoutName, #checkoutPhone, #checkoutAddress, #checkoutCity, #checkoutState, #checkoutPincode').forEach(el => {
    const errorSpan = document.createElement('span');
    errorSpan.className = 'field-error';
    errorSpan.style.cssText = 'color:var(--red);font-size:12px;display:block;margin-top:4px;';
    el.parentNode.appendChild(errorSpan);
    el.addEventListener('input', function() {
      this.style.borderColor = '';
      if (this.nextElementSibling && this.nextElementSibling.classList.contains('field-error')) {
        this.nextElementSibling.textContent = '';
      }
    });
    el.addEventListener('blur', function() {
      if (!this.value.trim()) {
        this.style.borderColor = 'var(--red)';
      }
    });
  });

}

function renderCheckoutOrderTotal() {
  const container = document.getElementById('checkoutOrderItems');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Your cart is empty. <a href="products.html" style="color:var(--gold);">Shop now</a></p>';
    return;
  }
  const itemsHtml = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    return `
      <div class="order-item">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
        <div class="order-item-info">
          <h4>${product.name}</h4>
          <div class="qty">Qty: ${item.qty}</div>
          <div class="cart-price-note"><i class="fab fa-whatsapp"></i> Message for price</div>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = itemsHtml + `
    <p class="cart-price-help">Prices are shared on WhatsApp after reviewing your selected items.</p>
    <button class="btn whatsapp-cart-btn" type="button" onclick="openCartWhatsApp()"><i class="fab fa-whatsapp"></i><span>Message on WhatsApp for prices</span></button>
  `;
}

function initAnnouncementSlider() {
  const slider = document.getElementById('announcementSlider');
  if (!slider) return;
  let idx = 0;
  const slides = slider.querySelectorAll('.announcement-slide');
  if (slides.length < 2) return;
  setInterval(() => {
    idx = (idx + 1) % slides.length;
    slider.style.transform = `translateX(-${idx * 100}%)`;
  }, 3000);
}

function initHeroSlider() {
  const slider = document.getElementById('heroSlider');
  if (!slider) return;
  const slides = slider.querySelectorAll('.hero-slide');
  const dots = slider.querySelectorAll('.hero-dot');
  const prevBtn = document.getElementById('heroPrev');
  const nextBtn = document.getElementById('heroNext');
  let idx = 0;
  function goTo(i) {
    idx = i;
    slider.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, j) => d.classList.toggle('active', j === idx));
  }
  if (prevBtn) prevBtn.addEventListener('click', () => goTo((idx - 1 + slides.length) % slides.length));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo((idx + 1) % slides.length));
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
  if (slides.length > 1) {
    setInterval(() => goTo((idx + 1) % slides.length), 5000);
  }
}

function openMobileNav() {
  document.getElementById('mobileNav').classList.add('open');
  document.getElementById('navOverlay').classList.add('active');
}

function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('open');
  document.getElementById('navOverlay').classList.remove('active');
}

function populateMobileNav() {
  const links = document.getElementById('mobileNavLinks');
  if (!links) return;
  const authLink = isLoggedIn()
    ? `<a href="#" onclick="logout()" style="color:var(--gold);"><i class="fas fa-sign-out-alt"></i> Logout (${(getClientInfo()||{}).name||''})</a>`
    : '';
  const adminLink = isLoggedIn() && getClientInfo()?.is_admin
    ? `<a href="${ROOT_PREFIX}admin.html"><i class="fas fa-cog"></i> Admin Panel</a>`
    : '';
  const ordersLink = isLoggedIn() ? `<a href="${PAGE_PREFIX}my-orders.html"><i class="fas fa-box"></i> My Orders</a>` : '';
  links.innerHTML = `
    <a href="${ROOT_PREFIX}index.html">Home</a>
    <a href="${PAGE_PREFIX}products.html?category=Necklace+Ad+Replica">Necklace Ad Replica</a>
    <a href="${PAGE_PREFIX}products.html?category=Crowns">Crowns</a>
    <a href="${PAGE_PREFIX}products.html?category=Brooch">Brooch</a>
    <a href="${PAGE_PREFIX}products.html?category=Earring">Earring</a>
    <a href="${PAGE_PREFIX}products.html?category=Kada">Kada</a>
    <a href="${PAGE_PREFIX}products.html?category=Bracelet">Bracelet</a>
    <a href="${PAGE_PREFIX}products.html?category=Hand+Panjas">Hand Panjas</a>
    <a href="${PAGE_PREFIX}products.html?category=Maang+Tika">Maang Tika</a>
    <a href="${PAGE_PREFIX}products.html">All Products</a>
    <a href="${PAGE_PREFIX}enquiry.html"><i class="fas fa-file-invoice"></i> Bulk Enquiry</a>
    <a href="${PAGE_PREFIX}about.html">About Us</a>
    <a href="${PAGE_PREFIX}contact.html">Contact</a>
    ${ordersLink}
    ${adminLink}
    ${authLink}
  `;
}

async function subscribeNewsletter(form) {
  const email = form.querySelector('input[type="email"]')?.value.trim();
  if (!email) { showToast('Please enter your email'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email'); return; }
  try {
    const res = await fetch(API_BASE + '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Subscribed! Welcome to Hem Labdhi Jewels by Pavan Art.');
      form.querySelector('input[type="email"]').value = '';
    } else {
      showToast(data.error || 'Could not subscribe');
    }
  } catch {
    showToast('Could not subscribe. Please try again.');
  }
}

let _scrollObserver;
function initScrollAnimations() {
  _scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate-on-scroll').forEach(el => _scrollObserver.observe(el));
}

function observeNewAnimations(container) {
  if (!_scrollObserver) return;
  container.querySelectorAll('.animate-on-scroll:not(.visible)').forEach(el => _scrollObserver.observe(el));
}

function initKeyboardNav() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const lightbox = document.getElementById('lightboxOverlay');
      if (lightbox && lightbox.classList.contains('active')) { closeLightbox(); return; }
      const qv = document.getElementById('quickViewModal');
      if (qv && qv.classList.contains('active')) { closeQuickView(); return; }
      const search = document.getElementById('searchOverlay');
      if (search && search.classList.contains('active')) { closeSearch(); return; }
      closeCartDrawer();
      closeWishlistDrawer();
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initCart();
  initWishlist();
  initAuth();
  initAnnouncementSlider();
  initHeroSlider();
  populateMobileNav();
  initScrollAnimations();
  renderCategories();
  renderNewCollections();
  renderFeaturedProducts();
  renderAllProducts();
  loadAllReviews().then(() => {
    renderProductDetail();
    renderCartPage();
    renderRecentlyViewed();
  });
  initKeyboardNav();
  initCheckoutValidation();
  renderCheckoutOrderTotal();

  document.getElementById('cartIcon')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartDrawerClose')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('hamburger')?.addEventListener('click', openMobileNav);
  document.getElementById('mobileNavClose')?.addEventListener('click', closeMobileNav);
  document.getElementById('navOverlay')?.addEventListener('click', closeMobileNav);

  document.getElementById('searchIcon')?.addEventListener('click', openSearch);
  document.getElementById('searchClose')?.addEventListener('click', closeSearch);
  document.getElementById('searchOverlay')?.addEventListener('click', function(e) { if (e.target === this) closeSearch(); });
  document.getElementById('searchInput')?.addEventListener('input', function() { searchProducts(this.value); });
  document.getElementById('searchInput')?.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSearch(); });

  document.getElementById('wishlistIcon')?.addEventListener('click', openWishlistDrawer);
  document.getElementById('wishlistDrawerClose')?.addEventListener('click', closeWishlistDrawer);
  document.getElementById('wishlistOverlay')?.addEventListener('click', closeWishlistDrawer);
});
