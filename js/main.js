let cart = [];
let wishlist = [];
let serverPrices = null;
let stockData = {};
let appliedCoupon = null;
let checkoutOtp = (() => { try { const s = localStorage.getItem('pa_checkout_otp'); return s ? JSON.parse(s) : { challengeId: null, phone: '', verified: false }; } catch { return { challengeId: null, phone: '', verified: false }; } })();

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

function initCart() {
  try {
    const saved = localStorage.getItem('jewelleryCart');
    if (saved) {
      const parsed = JSON.parse(saved);
      cart = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) { cart = []; }
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('jewelleryCart', JSON.stringify(cart));
}

function addToCart(productId, qty = 1) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const price = getProductPrice(product);
  if (!price) { showToast('Please login to see prices and add items'); return; }
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }
  saveCart();
  updateCartUI();
  showToast(`${product.name} added to cart!`);
  const drawer = document.getElementById('cartDrawer');
  if (drawer) openCartDrawer();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
  renderCartDrawer();
  renderCartPage();
}

function updateQty(productId, newQty) {
  if (newQty < 1) { removeFromCart(productId); return; }
  const item = cart.find(i => i.id === productId);
  if (item) { item.qty = newQty; saveCart(); updateCartUI(); renderCartDrawer(); renderCartPage(); }
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
function initWishlist() {
  try {
    const saved = localStorage.getItem('jewelleryWishlist');
    if (saved) {
      const parsed = JSON.parse(saved);
      wishlist = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) { wishlist = []; }
  updateWishlistUI();
}

function saveWishlist() {
  localStorage.setItem('jewelleryWishlist', JSON.stringify(wishlist));
}

function toggleWishlist(productId) {
  const idx = wishlist.indexOf(productId);
  if (idx > -1) {
    wishlist.splice(idx, 1);
    showToast('Removed from wishlist');
  } else {
    wishlist.push(productId);
    const product = products.find(p => p.id === productId);
    showToast(`${product ? product.name : 'Item'} added to wishlist!`);
  }
  saveWishlist();
  updateWishlistUI();
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
            <button class="btn" style="padding:6px 12px;font-size:11px" onclick="addToCart(${product.id}); toggleWishlist(${product.id})">Add to Cart</button>
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
function getReviews(productId) {
  try {
    const data = localStorage.getItem('jewelleryReviews');
    const all = data ? JSON.parse(data) : {};
    if (typeof all !== 'object' || Array.isArray(all)) return [];
    return Array.isArray(all[productId]) ? all[productId] : [];
  } catch { return []; }
}

function saveReview(productId, review) {
  try {
    const data = localStorage.getItem('jewelleryReviews');
    const all = data ? JSON.parse(data) : {};
    if (!all[productId]) all[productId] = [];
    all[productId].push(review);
    localStorage.setItem('jewelleryReviews', JSON.stringify(all));
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
  let subtotal = 0;
  container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    const price = getProductPrice(product);
    if (!price) return '';
    subtotal += price * item.qty;
    return `
      <div class="cart-drawer-item">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
        <div class="cart-drawer-item-info">
          <h4>${product.name}</h4>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px;">&#8377;${price.toLocaleString()}</div>
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
  if (totalEl) totalEl.innerHTML = `<div class="order-totals"><div class="order-total-row order-total-final"><span>Subtotal</span><span>&#8377;${subtotal.toLocaleString()}</span></div></div>`;
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
  window.location.href = PAGE_PREFIX + 'checkout.html';
}

function renderCartSummary() {
  const container = document.getElementById('cartSummaryTotals');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Your cart is empty</p>';
    return;
  }
  let subtotal = 0;
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    const price = getProductPrice(product);
    if (!price) return;
    subtotal += price * item.qty;
  });
  if (subtotal === 0) { container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">No priced items in cart</p>'; return; }
  const shipping = subtotal >= 5000 ? 0 : 199;
  const total = subtotal + shipping;
  container.innerHTML = `
    <div class="order-totals">
      <div class="order-total-row"><span>Subtotal</span><span>&#8377;${subtotal.toLocaleString()}</span></div>
      <div class="order-total-row"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:var(--green)">FREE</span>' : '&#8377;' + shipping}</span></div>
      <div class="order-total-row order-total-final"><span>Total</span><span>&#8377;${total.toLocaleString()}</span></div>
    </div>
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
  if (!checkoutOtp.verified || checkoutOtp.phone !== formData.phone) {
    showToast('Please verify phone OTP before placing order');
    document.getElementById('checkoutOtp')?.focus();
    return;
  }

  let cartData = [];
  try { cartData = JSON.parse(localStorage.getItem('jewelleryCart') || '[]'); } catch { cartData = []; }
  if (!Array.isArray(cartData) || cartData.length === 0) {
    showToast('Your cart is empty'); return;
  }

  let subtotal = 0;
  const items = [];
  for (const item of cartData) {
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
    otp_challenge_id: checkoutOtp.challengeId,
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
      saveCart();
      updateCartUI();
      appliedCoupon = null;
      setTimeout(() => { window.location.href = '../index.html'; }, 2000);
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

function getRandomPrice() {
  return Math.floor(Math.random() * 15000) + 1999;
}

function getProductPrice(product) {
  if (product._serverPrice != null) return product._serverPrice;
  if (serverPrices && serverPrices[product.id] != null) return serverPrices[product.id];
  return null;
}

function getProductUrl(productId) {
  return `${window.location.origin}/pages/product-detail.html?id=${productId}`;
}

function getPriceWhatsAppUrl(product) {
  const msg = `Hi, I want the price for ${product.name} (${product.sku}). ${getProductUrl(product.id)}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
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
    btn.innerHTML = `<i class="fas fa-sign-in-alt"></i>`;
    btn.title = 'Client Login';
    btn.onclick = () => window.location.href = '/login.html';
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
    const price = getProductPrice(p);
    const priceHTML = price
      ? `&#8377;${price.toLocaleString()}`
      : `<a href="${getPriceWhatsAppUrl(p)}" target="_blank" onclick="event.stopPropagation();" style="color:var(--gold);font-size:12px;text-decoration:underline;"><i class="fab fa-whatsapp"></i> Contact on WhatsApp for price</a>`;
    const stock = stockData[p.id];
    const stockBadge = stock ? (stock.stock <= 0 ? '<div class="product-card-badge sold-out">Sold Out</div>' : stock.stock <= stock.low_stock_threshold ? '<div class="product-card-badge low-stock-badge">Only ' + stock.stock + ' left</div>' : '') : '';
    const badge = stockBadge || (p.badge ? `<div class="product-card-badge sale">${p.badge}</div>` : '');
    return `
      <div class="product-card animate-on-scroll" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'" role="button" tabindex="0" aria-label="${p.name}">
        ${badge}
        <button class="wishlist-btn ${wished ? 'active' : ''}" data-product-id="${p.id}" onclick="event.stopPropagation(); toggleWishlist(${p.id})" aria-label="${wished ? 'Remove from' : 'Add to'} wishlist"><i class="fa${wished ? 's' : 'r'} fa-heart"></i></button>
        <div class="product-card-image">
          <img src="${p.images[0]}" alt="${p.name}" loading="lazy">
          <img class="img-hover" src="${p.images[1] || p.images[0]}" alt="${p.name}" loading="lazy">
          <div class="product-card-actions">
            <button class="btn quick-view-btn" onclick="event.stopPropagation(); openQuickView(${p.id})">Quick View</button>
            <button class="btn btn-dark" onclick="event.stopPropagation(); addToCart(${p.id})">Add to Cart</button>
            <button class="btn" style="font-size:11px;padding:6px 10px;margin-top:4px;" onclick="event.stopPropagation(); window.open('${getPriceWhatsAppUrl(p)}', '_blank')">WhatsApp Price</button>
            <button class="btn" style="font-size:11px;padding:6px 10px;margin-top:4px;" onclick="event.stopPropagation(); window.location.href='${PAGE_PREFIX}enquiry.html?products=${p.id}'">Enquire</button>
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
}

function renderFeaturedProducts() {
  renderProducts('featuredProducts', products);
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
    <div class="category-card animate-on-scroll delay-${i + 1}" onclick="window.location.href='${PAGE_PREFIX}products.html?category=${encodeURIComponent(cat.name)}'">
      <img src="${cat.image}" alt="${cat.name}">
      <div class="category-card-overlay">
        <h3>${cat.name}</h3>
        <span>${cat.count}</span>
      </div>
    </div>
  `).join('');
}

let _productImages = [];
let _currentImageIndex = 0;

// ===== RECENTLY VIEWED =====
function trackRecentlyViewed(id) {
  let recent = [];
  try {
    const saved = localStorage.getItem('jewelleryRecent');
    if (saved) {
      const parsed = JSON.parse(saved);
      recent = Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  recent = recent.filter(i => typeof i === 'number');
  recent.unshift(id);
  if (recent.length > 8) recent = recent.slice(0, 8);
  localStorage.setItem('jewelleryRecent', JSON.stringify(recent));
}

function renderRecentlyViewed() {
  const container = document.getElementById('recentlyViewed');
  if (!container) return;
  let recent = [];
  try {
    const saved = localStorage.getItem('jewelleryRecent');
    if (saved) {
      const parsed = JSON.parse(saved);
      recent = Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  if (recent.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const items = recent.map(id => products.find(p => p.id === id)).filter(Boolean);
  container.querySelector('.recent-grid').innerHTML = items      .map(p => `
    <div class="recent-card animate-on-scroll" onclick="window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'">
      <img src="${p.images[0]}" alt="${p.name}">
      <div class="recent-card-body">
        <h4>${p.name}</h4>
      </div>
    </div>
  `).join('');
}

// ===== QUICK VIEW =====
function openQuickView(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById('quickViewOverlay');
  const modal = document.getElementById('quickViewModal');
  if (!overlay || !modal) return;
  const quickPrice = getProductPrice(p);
  const quickPriceHTML = quickPrice
    ? `<div class="quick-view-price">&#8377;${quickPrice.toLocaleString()}</div>`
    : `<a href="${getPriceWhatsAppUrl(p)}" target="_blank" style="color:var(--gold);display:inline-block;margin:10px 0;text-decoration:underline;font-size:12px;"><i class="fab fa-whatsapp"></i> Contact on WhatsApp for price</a>`;
  modal.innerHTML = `
    <div class="quick-view-close" onclick="closeQuickView()">&times;</div>
    <div class="quick-view-layout">
      <div class="quick-view-image">
        <img src="${p.images[0]}" alt="${p.name}">
      </div>
      <div class="quick-view-info">
        <div class="product-tag">${p.category}</div>
        <h3>${p.name}</h3>
        ${quickPriceHTML}
        <p class="quick-view-desc">${p.description}</p>
        <button class="btn" onclick="addToCart(${p.id}); closeQuickView()">Add to Cart</button>
        <button class="btn" onclick="window.open('${getPriceWhatsAppUrl(p)}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp Price</button>
        <button class="btn btn-dark" onclick="closeQuickView(); window.location.href='${PAGE_PREFIX}product-detail.html?id=${p.id}'">View Details</button>
      </div>
    </div>
  `;
  overlay.classList.add('active');
  modal.classList.add('active');
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
  const text = encodeURIComponent(`Check out this ${p.name} at Hem Labdhi jewels!`);
  window.open(`https://wa.me/919321671416?text=${text}%20${url}`, '_blank');
}

// ===== VIDEO CALL =====
function videoCall(productName) {
  let msg = 'Hi! I visited Hem Labdhi jewels and would like a video call demonstration. Please video call me back.';
  if (productName) {
    msg = `Hi! I'm interested in ${productName} and would like a video call demonstration. Please video call me back.`;
  }
  window.open(`https://wa.me/919321671416?text=${encodeURIComponent(msg)}`, '_blank');
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
  trackRecentlyViewed(product.id);
  document.title = `${product.name} - Hem Labdhi jewels`;
  const avgRating = getAverageRating(product.id);
  const reviews = getReviews(product.id);
  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  const youMayAlsoLike = getYouMayAlsoLike(product, 4);
  const wished = isInWishlist(product.id);
  const price = getProductPrice(product);
  const priceHTML = price
    ? `&#8377;${price.toLocaleString()}`
    : `<a href="${getPriceWhatsAppUrl(product)}" target="_blank" style="color:var(--gold);text-decoration:underline;"><i class="fab fa-whatsapp"></i> Contact on WhatsApp for price</a>`;
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
            <img id="mainImage" src="${product.images[0]}" alt="${product.name}" onclick="openLightbox()" style="cursor:pointer">
            ${product.images.length > 1 ? `
              <button class="slide-arrow slide-arrow-prev" onclick="event.stopPropagation(); prevImage()" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
              <button class="slide-arrow slide-arrow-next" onclick="event.stopPropagation(); nextImage()" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
            <button class="btn btn-expand" onclick="event.stopPropagation(); openLightbox()" aria-label="Expand image"><i class="fas fa-expand"></i></button>
          </div>
          <div class="product-detail-thumbs" id="productThumbs">
            ${product.images.map((img, i) => `
              <img src="${img}" alt="${product.name}" class="${i === 0 ? 'active' : ''}" onclick="showProductImage('${img}', this)" loading="lazy">
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
            ${product.features ? `<ul style="margin-top:15px;padding-left:20px;list-style:disc">${product.features.map(f => `<li style="margin-bottom:5px">${f}</li>`).join('')}</ul>` : ''}
            <p style="margin-top:15px"><strong>SKU:</strong> ${product.sku}</p>
          </div>
          ${product.colors ? `
          <div class="color-options">
            <h4>Available Colors</h4>
            <div class="color-swatches">
              ${product.colors.map((c, i) => `
                <button class="color-swatch ${i === 0 ? 'active' : ''}" onclick="selectColor(${product.id}, ${i})" title="${c.name}" aria-label="${c.name}">
                  <img src="${c.image}" alt="${c.name}">
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
            <button class="btn" onclick="addToCart(${product.id}, parseInt(document.getElementById('detailQty').value))">Add to Cart</button>
            <button class="btn btn-dark" onclick="addToCart(${product.id}, parseInt(document.getElementById('detailQty').value)); setTimeout(() => window.location.href='checkout.html', 300)">Buy It Now</button>
            <button class="btn share-btn" onclick="shareOnWhatsApp(${product.id})"><i class="fab fa-whatsapp"></i> Share on WhatsApp</button>
            <button class="btn video-call-btn" onclick="videoCall('${product.name.replace(/'/g, "\\'")}')"><i class="fas fa-video"></i> Video Call</button>
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
    }
    const mainContainer = document.getElementById('mainMediaContainer');
    if (mainContainer) {
      initSwipe(mainContainer, () => prevImage(), () => nextImage());
    }
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
        i.className = parseInt(i.dataset.star) <= selectedRating ? 'fas fa-star' : 'far fa-star';
      });
    });
  });
}

function submitReview(productId) {
  const name = document.getElementById('reviewName')?.value.trim() || 'Anonymous';
  const text = document.getElementById('reviewText')?.value.trim();
  if (!text) { showToast('Please write a review'); return; }
  if (selectedRating === 0) { showToast('Please select a rating'); return; }
  saveReview(productId, { name, rating: selectedRating, text, date: new Date().toLocaleDateString() });
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
  if (mainImg) { mainImg.style.display = 'block'; mainImg.src = color.image; }
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
  }
  const counter = document.getElementById('lightboxCounter');
  if (counter) {
    counter.textContent = `${_currentImageIndex + 1} / ${_productImages.length}`;
  }
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
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

function setOtpMessage(message, type = 'info') {
  const msg = document.getElementById('otpMessage');
  if (!msg) return;
  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--text-secondary)';
  msg.innerHTML = `<span style="color:${color};">${message}</span>`;
}

function saveCheckoutOtp() {
  localStorage.setItem('pa_checkout_otp', JSON.stringify(checkoutOtp));
}

function resetCheckoutOtp() {
  checkoutOtp = { challengeId: null, phone: '', verified: false };
  saveCheckoutOtp();
  const otpInput = document.getElementById('checkoutOtp');
  if (otpInput) otpInput.value = '';
}

async function requestCheckoutOtp() {
  const phoneEl = document.getElementById('checkoutPhone');
  const phone = normalizePhone(phoneEl ? phoneEl.value : '');
  if (!/^\d{10}$/.test(phone)) {
    if (phoneEl) phoneEl.style.borderColor = 'var(--red)';
    setOtpMessage('Enter a valid 10-digit phone number. +91 format is also accepted.', 'error');
    return;
  }
  if (phoneEl) {
    phoneEl.value = phone;
    phoneEl.style.borderColor = '';
  }

  resetCheckoutOtp();
  setOtpMessage('Sending OTP...');

  try {
    const res = await fetch(API_BASE + '/api/orders/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not send OTP');

    checkoutOtp = { challengeId: data.challenge_id, phone, verified: false };
    saveCheckoutOtp();
    const demoText = data.dev_otp ? ` Demo OTP: <strong>${escapeHtml(data.dev_otp)}</strong>` : '';
    setOtpMessage(`OTP sent. It expires in ${data.expires_in_minutes} minutes.${demoText}`, 'success');
    document.getElementById('checkoutOtp')?.focus();
  } catch (err) {
    setOtpMessage(escapeHtml(err.message || 'Could not send OTP'), 'error');
  }
}

async function verifyCheckoutOtp() {
  const otpEl = document.getElementById('checkoutOtp');
  const otp = otpEl ? otpEl.value.trim() : '';
  if (!checkoutOtp.challengeId) {
    setOtpMessage('Request OTP first.', 'error');
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    if (otpEl) otpEl.style.borderColor = 'var(--red)';
    setOtpMessage('Enter the 6-digit OTP.', 'error');
    return;
  }

  setOtpMessage('Verifying OTP...');
  try {
    const res = await fetch(API_BASE + '/api/orders/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ challenge_id: checkoutOtp.challengeId, otp })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'OTP verification failed');

    checkoutOtp.verified = true;
    saveCheckoutOtp();
    if (otpEl) otpEl.style.borderColor = 'var(--green)';
    setOtpMessage('Phone verified. You can place the order now.', 'success');
  } catch (err) {
    checkoutOtp.verified = false;
    saveCheckoutOtp();
    setOtpMessage(escapeHtml(err.message || 'OTP verification failed'), 'error');
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

  document.querySelectorAll('#checkoutName, #checkoutPhone, #checkoutAddress, #checkoutCity, #checkoutState, #checkoutPincode, #checkoutOtp').forEach(el => {
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

  document.getElementById('checkoutPhone')?.addEventListener('input', function() {
    if (checkoutOtp.phone && normalizePhone(this.value) !== checkoutOtp.phone) {
      resetCheckoutOtp();
      setOtpMessage('Phone changed. Please request a new OTP.');
    }
  });
}

function renderCheckoutOrderTotal() {
  const container = document.getElementById('checkoutOrderItems');
  if (!container) return;
  let cartData = [];
  try { cartData = JSON.parse(localStorage.getItem('jewelleryCart') || '[]'); } catch { cartData = []; }
  if (!Array.isArray(cartData)) cartData = [];
  if (cartData.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Your cart is empty. <a href="products.html" style="color:var(--gold);">Shop now</a></p>';
    return;
  }
  let subtotal = 0;
  const itemsHtml = cartData.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    const price = getProductPrice(product);
    if (!price) return '';
    const lineTotal = price * item.qty;
    subtotal += lineTotal;
    return `
      <div class="order-item">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
        <div class="order-item-info">
          <h4>${product.name}</h4>
          <div class="qty">Qty: ${item.qty} x &#8377;${price.toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join('');
  const shipping = subtotal >= 5000 ? 0 : 199;
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const total = Math.max(0, subtotal + shipping - discount);
  container.innerHTML = itemsHtml + `
    <div class="order-totals">
      <div class="order-total-row"><span>Subtotal</span><span>&#8377;${subtotal.toLocaleString()}</span></div>
      <div class="order-total-row"><span>Shipping</span><span>${shipping === 0 ? 'FREE' : '&#8377;' + shipping}</span></div>
      ${discount > 0 ? `<div class="order-total-row" style="color:var(--green);"><span>Discount (${appliedCoupon.code})</span><span>-&#8377;${discount.toLocaleString()}</span></div>` : ''}
      <div class="order-total-row order-total-final"><span>Total</span><span>&#8377;${total.toLocaleString()}</span></div>
    </div>
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
    : `<a href="${ROOT_PREFIX}login.html" style="color:var(--gold);"><i class="fas fa-sign-in-alt"></i> Client Login</a>`;
  const adminLink = isLoggedIn() && getClientInfo()?.is_admin
    ? `<a href="${ROOT_PREFIX}admin.html"><i class="fas fa-cog"></i> Admin Panel</a>`
    : '';
  const ordersLink = isLoggedIn() ? `<a href="${PAGE_PREFIX}my-orders.html"><i class="fas fa-box"></i> My Orders</a>` : '';
  links.innerHTML = `
    <a href="${ROOT_PREFIX}index.html">Home</a>
    <a href="${PAGE_PREFIX}products.html?category=Necklace">Necklace</a>
    <a href="${PAGE_PREFIX}products.html?category=Crowns">Crowns</a>
    <a href="${PAGE_PREFIX}products.html?category=Brooch">Brooch</a>
    <a href="${PAGE_PREFIX}products.html?category=Earring">Earring</a>
    <a href="${PAGE_PREFIX}products.html?category=Kada">Kada</a>
    <a href="${PAGE_PREFIX}products.html?category=Bracelet">Bracelet</a>
    <a href="${PAGE_PREFIX}products.html?category=Necklace+Ad+Replica">Necklace Ad Replica</a>
    <a href="${PAGE_PREFIX}products.html">All Products</a>
    <a href="${PAGE_PREFIX}enquiry.html"><i class="fas fa-file-invoice"></i> Bulk Enquiry</a>
    <a href="${PAGE_PREFIX}about.html">About Us</a>
    <a href="${PAGE_PREFIX}contact.html">Contact</a>
    ${ordersLink}
    ${adminLink}
    ${authLink}
  `;
}

function subscribeNewsletter(form) {
  const email = form.querySelector('input[type="email"]')?.value.trim();
  if (!email) { showToast('Please enter your email'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email'); return; }
  let subscribers = [];
  try {
    const saved = localStorage.getItem('jewellerySubscribers');
    if (saved) {
      const parsed = JSON.parse(saved);
      subscribers = Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  if (subscribers.includes(email)) { showToast('You are already subscribed!'); return; }
  subscribers.push(email);
  localStorage.setItem('jewellerySubscribers', JSON.stringify(subscribers));
  showToast('Subscribed! Welcome to Hem Labdhi jewels.');
  form.querySelector('input[type="email"]').value = '';
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
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

document.addEventListener('DOMContentLoaded', async function() {
  initCart();
  initWishlist();
  await initAuth();
  initAnnouncementSlider();
  initHeroSlider();
  populateMobileNav();
  renderCategories();
  renderFeaturedProducts();
  renderAllProducts();
  renderProductDetail();
  renderCartPage();
  renderRecentlyViewed();
  initScrollAnimations();
  initKeyboardNav();
  await initCheckoutValidation();
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
