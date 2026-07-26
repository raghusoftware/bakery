// Product form with image upload (stored in Supabase Storage; URL saved on the row).
import { useState } from 'react';
import { sb, api } from '../lib/supabase';

const BLANK = { name: '', category: 'Bread', price: 0, stock_qty: 0, barcode: '', image: '' };

export default function ProductForm({ product, onSaved }) {
  const [form, setForm] = useState(product || BLANK);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function uploadImage(file) {
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await sb.storage.from('product-images').upload(path, file);
    if (error) return alert(error.message);
    const { data } = sb.storage.from('product-images').getPublicUrl(path);
    setForm((f) => ({ ...f, image: data.publicUrl }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const row = { ...form, price: +form.price, stock_qty: +form.stock_qty };
    if (form.id) await api.update('products', form.id, row);
    else await api.add('products', row);
    setBusy(false);
    onSaved?.();
  }

  return (
    <form className="product-form" onSubmit={save}>
      <label>Name<input value={form.name} onChange={set('name')} required /></label>
      <label>Category<input value={form.category} onChange={set('category')} /></label>
      <div className="row2">
        <label>Price<input type="number" step="0.5" value={form.price} onChange={set('price')} /></label>
        <label>Stock<input type="number" value={form.stock_qty} onChange={set('stock_qty')} /></label>
      </div>
      <label>Barcode<input value={form.barcode} onChange={set('barcode')} /></label>
      <label>Photo
        <input type="file" accept="image/*"
               onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0])} />
      </label>
      {form.image && <img className="preview" src={form.image} alt="" />}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</button>
    </form>
  );
}
