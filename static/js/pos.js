// ── State ──────────────────────────────────────────────────────────────────
const state = {
  products: [],
  categories: [],
  cart: [],
  customer: null,
  searchQuery: '',
  activeCategory: 'all',
  discount: 0,
  paymentMode: 'CASH',
  gstPercent: 5,
  lastSale: null,
  isCartExpanded: false,
  printerConfig: null,
};

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);

  await loadFromServer();
  renderCategories();
  renderProducts();
  setupSearch();
  setupCartPanel();
  restoreRecentProducts();
  tryLoadPrinterConfig();
});

function updateClock() {
  const el = document.getElementById('live-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ── Data loading ───────────────────────────────────────────────────────────
async function loadFromServer() {
  try {
    const [pRes, cRes] = await Promise.all([
      fetch('/api/products/'),
      fetch('/api/categories/'),
    ]);
    if (pRes.ok) {
      const pData = await pRes.json();
      state.products = pData.products;
      // Cache in IndexedDB for offline
      if (window.BakeryDB) await BakeryDB.saveProducts(state.products);
    }
    if (cRes.ok) {
      const cData = await cRes.json();
      state.categories = cData.categories;
      if (window.BakeryDB) await BakeryDB.saveCategories(state.categories);
    }
  } catch (_) {
    // Offline: load from IndexedDB
    if (window.BakeryDB) {
      state.products   = await BakeryDB.getProducts();
      state.categories = await BakeryDB.getCategories();
      showToast('Loaded from offline cache', 'info');
    }
  }

  // Load GST setting
  try {
    const sRes = await fetch('/api/settings/');
    if (sRes.ok) {
      const s = await sRes.json();
      state.gstPercent = parseFloat(s.gst_percent) || 5;
    }
  } catch (_) {}
}

async function tryLoadPrinterConfig() {
  if (window.BakeryDB) {
    state.printerConfig = await BakeryDB.getSetting('printer');
  }
}

// ── Recent products (localStorage) ────────────────────────────────────────
function getRecentIds() {
  try { return JSON.parse(localStorage.getItem('recent_products') || '[]'); } catch { return []; }
}

function pushRecent(id) {
  let ids = getRecentIds().filter(x => x !== id);
  ids.unshift(id);
  ids = ids.slice(0, 8);
  localStorage.setItem('recent_products', JSON.stringify(ids));
}

function restoreRecentProducts() {}  // handled in renderProducts

// ── Categories ─────────────────────────────────────────────────────────────
function renderCategories() {
  const el = document.getElementById('category-pills');
  if (!el) return;
  const existing = el.querySelector('[data-cat="all"]');
  // Remove old dynamic pills
  [...el.querySelectorAll('[data-cat]:not([data-cat="all"])')].forEach(p => p.remove());
  state.categories.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill';
    btn.dataset.cat = c.id;
    btn.textContent = `${c.icon} ${c.name}`;
    btn.onclick = () => filterByCategory(String(c.id), btn);
    el.appendChild(btn);
  });
}

window.filterByCategory = (cat, btn) => {
  state.activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProducts();
};

// ── Search ─────────────────────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  if (!input) return;

  input.focus();

  input.addEventListener('input', () => {
    state.searchQuery = input.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderProducts();

    // If exact barcode match, add immediately
    if (state.searchQuery.length >= 4) {
      const match = state.products.find(p => p.barcode && p.barcode.toLowerCase() === state.searchQuery);
      if (match) { addToCart(match.id); input.value = ''; state.searchQuery = ''; renderProducts(); }
    }
  });
}

window.clearSearch = () => {
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; input.focus(); }
  state.searchQuery = '';
  document.getElementById('btn-clear-search').style.display = 'none';
  renderProducts();
};

// ── Product rendering ──────────────────────────────────────────────────────
function getFilteredProducts() {
  let products = state.products;
  if (state.activeCategory !== 'all') {
    products = products.filter(p => p.category && String(p.category.id) === state.activeCategory);
  }
  if (state.searchQuery) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(state.searchQuery) ||
      (p.barcode && p.barcode.toLowerCase().includes(state.searchQuery))
    );
  }
  return products;
}

function productCardHTML(p) {
  const inCart = state.cart.find(i => i.id === p.id);
  const stockClass = p.stock_qty === 0 ? 'out' : p.stock_qty <= 5 ? 'low' : '';
  const stockLabel = p.stock_qty === 0 ? 'Out of stock' : `${p.stock_qty} in stock`;
  const emoji = p.category?.icon || '🧁';
  const imgHTML = p.image
    ? `<img src="${p.image}" class="product-img" alt="${p.name}" loading="lazy">`
    : `<div class="product-emoji">${emoji}</div>`;

  return `
    <div class="product-card" data-id="${p.id}" onclick="handleProductTap(${p.id})" oncontextmenu="handleProductLongPress(event,${p.id})">
      ${p.is_favorite ? '<span class="fav-star">★</span>' : ''}
      ${imgHTML}
      <div class="product-name">${p.name}</div>
      <div class="product-price">₹${parseFloat(p.selling_price).toFixed(2)}</div>
      <span class="stock-badge ${stockClass}">${stockLabel}</span>
      <button class="add-btn ${inCart ? 'in-cart' : ''}" onclick="event.stopPropagation(); addToCart(${p.id})">
        ${inCart ? `✓ In Cart (${inCart.quantity})` : '+ Add'}
      </button>
    </div>`;
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const filtered = getFilteredProducts();

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i>🔍</i>
        <p>${state.searchQuery ? `No products found for "${state.searchQuery}"` : 'No products in this category'}</p>
      </div>`;
    return;
  }

  // Favorites first, then recent, then rest — only when not searching/filtering
  if (!state.searchQuery && state.activeCategory === 'all') {
    const recentIds = getRecentIds();
    const favs    = filtered.filter(p => p.is_favorite);
    const recents = filtered.filter(p => !p.is_favorite && recentIds.includes(p.id));
    const others  = filtered.filter(p => !p.is_favorite && !recentIds.includes(p.id));

    let html = '';
    if (favs.length) {
      html += `<div class="section-label" style="grid-column:1/-1">⭐ Favourites</div>`;
      html += favs.map(productCardHTML).join('');
    }
    if (recents.length) {
      html += `<div class="section-label" style="grid-column:1/-1">🕐 Recently Sold</div>`;
      html += recents.map(productCardHTML).join('');
    }
    if (others.length) {
      if (favs.length || recents.length) {
        html += `<div class="section-label" style="grid-column:1/-1">All Products</div>`;
      }
      html += others.map(productCardHTML).join('');
    }
    grid.innerHTML = html;
  } else {
    grid.innerHTML = filtered.map(productCardHTML).join('');
  }
}

window.handleProductTap = (id) => addToCart(id);

window.handleProductLongPress = (e, id) => {
  e.preventDefault();
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const qty = prompt(`Quantity for ${p.name}:`, '1');
  if (qty && parseInt(qty) > 0) addToCart(id, parseInt(qty));
};

// ── Cart logic ─────────────────────────────────────────────────────────────
window.addToCart = (productId, qty = 1) => {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  if (p.stock_qty === 0) { showToast(`${p.name} is out of stock`, 'error'); return; }

  const existing = state.cart.find(i => i.id === productId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, p.stock_qty);
    existing.total = existing.quantity * existing.unit_price;
  } else {
    state.cart.push({
      id: p.id,
      name: p.name,
      unit_price: parseFloat(p.selling_price),
      quantity: qty,
      total: parseFloat(p.selling_price) * qty,
    });
  }

  pushRecent(productId);
  showToast(`${p.name} added`, 'success');
  updateCartUI();
  renderProducts(); // refresh "in cart" state on buttons
};

window.removeFromCart = (id) => {
  state.cart = state.cart.filter(i => i.id !== id);
  updateCartUI();
  renderProducts();
};

window.updateQty = (id, delta) => {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;
  const p = state.products.find(x => x.id === id);
  const maxQty = p ? p.stock_qty : 999;

  item.quantity = Math.max(0, Math.min(item.quantity + delta, maxQty));
  if (item.quantity === 0) { removeFromCart(id); return; }
  item.total = item.quantity * item.unit_price;
  updateCartUI();
  renderProducts();
};

window.applyDiscount = (val) => {
  state.discount = parseFloat(val) || 0;
  updateCartUI();
};

window.clearCart = () => {
  if (state.cart.length === 0) return;
  if (!confirm('Clear all items from cart?')) return;
  state.cart = [];
  state.discount = 0;
  state.customer = null;
  updateCartUI();
  renderProducts();
};

function getCartTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.total, 0);
  const discount = Math.min(state.discount, subtotal);
  const taxable  = subtotal - discount;
  const gst      = parseFloat((taxable * state.gstPercent / 100).toFixed(2));
  const total    = parseFloat((taxable + gst).toFixed(2));
  return { subtotal, discount, gst, total };
}

function updateCartUI() {
  const { subtotal, discount, gst, total } = getCartTotals();
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);

  // Bottom bar
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total-display').textContent = `₹${total.toFixed(2)}`;
  document.getElementById('cart-item-summary').textContent =
    count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : 'No items';

  const checkoutBtns = document.querySelectorAll('#checkout-btn, .btn-checkout');
  checkoutBtns.forEach(b => b.disabled = state.cart.length === 0);

  // Expanded cart
  renderCartItems();

  // Totals
  setText('subtotal-display', `₹${subtotal.toFixed(2)}`);
  setText('discount-display', `-₹${discount.toFixed(2)}`);
  setText('gst-display', `₹${gst.toFixed(2)}`);
  setText('net-total-display', `₹${total.toFixed(2)}`);
}

function renderCartItems() {
  const el = document.getElementById('cart-items');
  if (!el) return;
  if (state.cart.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><i>🛒</i><p>Cart is empty</p></div>`;
    return;
  }
  el.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₹${item.unit_price.toFixed(2)} each</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn minus" onclick="updateQty(${item.id}, -1)">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn plus"  onclick="updateQty(${item.id}, +1)">+</button>
      </div>
      <div class="cart-item-total">₹${item.total.toFixed(2)}</div>
    </div>`).join('');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Cart panel toggle ──────────────────────────────────────────────────────
function setupCartPanel() {
  const panel    = document.getElementById('cart-panel');
  const handle   = document.getElementById('cart-collapsed');
  if (!panel || !handle) return;
  panel.classList.add('collapsed');
}

window.toggleCart = () => {
  const panel    = document.getElementById('cart-panel');
  const expanded = document.getElementById('cart-expanded');
  const collapsed = document.getElementById('cart-collapsed');
  if (!panel) return;

  state.isCartExpanded = !state.isCartExpanded;
  if (state.isCartExpanded) {
    panel.classList.remove('collapsed');
    if (expanded)  expanded.style.display  = 'block';
    if (collapsed) collapsed.style.display = 'flex';
    renderCartItems();
  } else {
    panel.classList.add('collapsed');
    if (expanded)  expanded.style.display  = 'none';
  }
};

// ── Checkout ───────────────────────────────────────────────────────────────
window.openCheckout = (e) => {
  if (e) e.stopPropagation();
  if (state.cart.length === 0) return;

  const { subtotal, discount, gst, total } = getCartTotals();
  setText('modal-subtotal', `₹${subtotal.toFixed(2)}`);
  setText('modal-discount', `-₹${discount.toFixed(2)}`);
  setText('modal-gst',      `₹${gst.toFixed(2)}`);
  setText('modal-total',    `₹${total.toFixed(2)}`);

  // Reset cash
  const cashIn = document.getElementById('cash-tendered');
  if (cashIn) cashIn.value = '';
  document.getElementById('change-display')?.style && (document.getElementById('change-display').style.display = 'none');

  const modal = new bootstrap.Modal(document.getElementById('checkoutModal'));
  modal.show();
};

window.selectPaymentMode = (mode, btn) => {
  state.paymentMode = mode;
  document.querySelectorAll('.pay-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cashSection = document.getElementById('cash-section');
  if (cashSection) cashSection.style.display = mode === 'CASH' ? 'block' : 'none';
};

window.calcChange = () => {
  const { total } = getCartTotals();
  const tendered  = parseFloat(document.getElementById('cash-tendered')?.value || 0);
  const changeEl  = document.getElementById('change-display');
  const amountEl  = document.getElementById('change-amount');
  if (!changeEl || !amountEl) return;

  if (tendered >= total) {
    changeEl.style.display = 'block';
    amountEl.textContent   = `₹${(tendered - total).toFixed(2)}`;
  } else {
    changeEl.style.display = 'none';
  }
};

window.searchCustomer = async (q) => {
  if (!q || q.length < 2) {
    document.getElementById('customer-dropdown').style.display = 'none';
    return;
  }
  try {
    const res  = await fetch(`/api/customers/?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const dd   = document.getElementById('customer-dropdown');
    if (!dd) return;
    if (data.customers.length === 0) {
      dd.style.display = 'none';
      return;
    }
    dd.innerHTML = data.customers.map(c => `
      <div class="customer-result-item" onclick="selectCustomer(${JSON.stringify(c).replace(/"/g, '&quot;')})">
        <span class="customer-result-name">${c.name}</span>
        <span class="customer-result-phone">${c.phone}</span>
      </div>`).join('') +
      `<div class="customer-result-item" onclick="addNewCustomer('${q.replace(/'/g,'\\'')}')">
        <span class="customer-result-name text-primary">+ Add new customer "${q}"</span>
      </div>`;
    dd.style.display = 'block';
  } catch (_) {}
};

window.selectCustomer = (c) => {
  state.customer = c;
  document.getElementById('customer-dropdown').style.display = 'none';
  document.getElementById('customer-search').value = '';
  setText('selected-customer-name', `${c.name} (${c.phone})`);
  document.getElementById('selected-customer').style.display = 'flex';
};

window.clearCustomer = () => {
  state.customer = null;
  document.getElementById('selected-customer').style.display = 'none';
};

window.addNewCustomer = async (name) => {
  const phone = prompt('Phone number for new customer:');
  if (!phone) return;
  try {
    const res = await fetch('/api/customers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    if (res.ok) {
      const c = await res.json();
      selectCustomer(c);
      showToast('Customer added', 'success');
    }
  } catch (_) { showToast('Could not add customer', 'error'); }
  document.getElementById('customer-dropdown').style.display = 'none';
};

// ── Process payment ────────────────────────────────────────────────────────
window.processPayment = async () => {
  const { subtotal, discount, gst, total } = getCartTotals();
  const btn = document.getElementById('confirm-sale-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  const tendered = parseFloat(document.getElementById('cash-tendered')?.value || 0);
  const change   = state.paymentMode === 'CASH' ? Math.max(0, tendered - total) : 0;

  const payload = {
    items: state.cart.map(i => ({
      product_id: i.id,
      quantity:   i.quantity,
      unit_price: i.unit_price,
    })),
    subtotal,
    discount,
    gst_percent:  state.gstPercent,
    payment_mode: state.paymentMode,
    customer_id:  state.customer?.id || null,
  };

  let saleData = null;

  try {
    const res = await fetch('/api/sales/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (res.ok) {
      saleData = await res.json();
      saleData.change_amount      = change.toFixed(2);
      saleData.customer_phone     = state.customer?.phone || '';
    } else {
      throw new Error('Server error');
    }
  } catch (_) {
    // Save offline
    await BakeryDB?.savePendingSale(payload);
    showToast('Sale saved offline — will sync when online', 'info');
    saleData = {
      invoice_no:   'OFFLINE-' + Date.now(),
      sale_date:     new Date().toLocaleString('en-IN'),
      customer:      state.customer?.name || 'Walk-in Customer',
      customer_phone: state.customer?.phone || '',
      items:         state.cart.map(i => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price.toFixed(2), total: i.total.toFixed(2) })),
      subtotal:      subtotal.toFixed(2),
      discount:      discount.toFixed(2),
      gst_percent:   state.gstPercent,
      gst_amount:    gst.toFixed(2),
      total:         total.toFixed(2),
      payment_mode:  state.paymentMode,
      change_amount: change.toFixed(2),
      store: { name: 'Jay Narayan Bakery', address: 'Main Market, Rajkot', phone: '+91 7984178801', footer: 'Thank You! Visit Again Soon' },
    };
  }

  state.lastSale = saleData;

  // Hide checkout modal
  bootstrap.Modal.getInstance(document.getElementById('checkoutModal'))?.hide();

  // Show success
  setText('success-invoice-no', `Invoice: ${saleData.invoice_no} • ₹${parseFloat(saleData.total).toFixed(2)}`);
  new bootstrap.Modal(document.getElementById('successModal')).show();

  // Reset cart
  state.cart      = [];
  state.customer  = null;
  state.discount  = 0;
  updateCartUI();
  renderProducts();
  if (state.isCartExpanded) toggleCart();

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Confirm Sale'; }

  // Auto-focus search
  setTimeout(() => document.getElementById('search-input')?.focus(), 500);
};

// ── Printing ───────────────────────────────────────────────────────────────
window.printCurrentReceipt = () => {
  if (!state.lastSale) return;
  const config = state.printerConfig;
  const width  = config?.paper_width || '80';

  if (window.Printer?.isConnected) {
    Printer.printReceipt(state.lastSale, width)
      .then(() => showToast('Printed!', 'success'))
      .catch(e => { showToast('Print error: ' + e.message, 'error'); Printer.printReceiptBrowser(state.lastSale, width); });
  } else {
    Printer.printReceiptBrowser(state.lastSale, width);
  }
};

window.shareWhatsApp = () => {
  if (state.lastSale && window.Printer) Printer.shareOnWhatsApp(state.lastSale);
};

// ── New sale ───────────────────────────────────────────────────────────────
window.newSale = () => {
  bootstrap.Modal.getInstance(document.getElementById('successModal'))?.hide();
  state.lastSale = null;
  document.getElementById('search-input')?.focus();
};

// ── Barcode scanner ────────────────────────────────────────────────────────
window.openBarcodeScanner = () => {
  BarcodeScanner.open((code) => {
    const p = state.products.find(x => x.barcode === code);
    if (p) {
      addToCart(p.id);
    } else {
      // Populate search for manual lookup
      const input = document.getElementById('search-input');
      if (input) { input.value = code; input.dispatchEvent(new Event('input')); }
      showToast(`Barcode: ${code} — product not found`, 'info');
    }
  });
};
