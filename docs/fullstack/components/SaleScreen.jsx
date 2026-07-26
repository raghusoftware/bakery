// Sale screen: product grid + cart with +/- counters and a running total.
import { useMemo, useState } from 'react';
import { sb, api, useCollection, money } from '../lib/supabase';

const GST = 0.05;

export default function SaleScreen() {
  const [products, reloadProducts] = useCollection('products');
  const [cart, setCart] = useState({}); // { [id]: qty }

  const setQty = (id, delta) =>
    setCart((c) => {
      const q = (c[id] || 0) + delta;
      const { [id]: _, ...rest } = c;
      return q > 0 ? { ...c, [id]: q } : rest;
    });

  const lines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => {
      const p = products.find((x) => x.id === +id);
      return { ...p, qty, amount: p.price * qty };
    }),
    [cart, products]
  );
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = subtotal * (1 + GST);

  async function confirmSale() {
    if (!lines.length) return;
    // 1) deduct finished-goods stock
    await Promise.all(lines.map((l) =>
      api.update('products', l.id, { stock_qty: Math.max(0, l.stock_qty - l.qty) })));
    // 2) record the sale
    await api.add('sales', {
      invoice_no: 'INV-' + Date.now(),
      items: lines.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      subtotal, gst_amount: subtotal * GST, total,
      pay_mode: 'CASH', date: new Date().toISOString(),
    });
    setCart({});
    reloadProducts();
  }

  return (
    <div className="sale">
      <div className="grid">
        {products.map((p) => (
          <button key={p.id} className="prod" onClick={() => setQty(p.id, +1)}>
            {p.image && <img src={p.image} alt="" />}
            <b>{p.name}</b><span>{money(p.price)}</span>
            <small>Stock: {p.stock_qty}</small>
          </button>
        ))}
      </div>

      <aside className="cart">
        <h3>Order</h3>
        {lines.map((l) => (
          <div key={l.id} className="row">
            <span>{l.name}</span>
            <div className="counter">
              <button onClick={() => setQty(l.id, -1)}>−</button>
              <b>{l.qty}</b>
              <button onClick={() => setQty(l.id, +1)}>+</button>
            </div>
            <span>{money(l.amount)}</span>
          </div>
        ))}
        <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="row total"><span>Total (incl GST)</span><span>{money(total)}</span></div>
        <button className="primary" disabled={!lines.length} onClick={confirmSale}>
          Confirm Sale
        </button>
      </aside>
    </div>
  );
}
