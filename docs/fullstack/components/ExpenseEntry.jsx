// Expense entry + list (amount, category, date). Reuses the DRY api/useCollection.
import { useState } from 'react';
import { api, useCollection, money } from '../lib/supabase';

const CATEGORIES = ['Rent', 'Utilities', 'Fuel', 'Repairs', 'Marketing', 'Misc'];

export default function ExpenseEntry() {
  const [rows, reload] = useCollection('expenses', (b) => b.order('date', { ascending: false }));
  const [form, setForm] = useState({ amount: '', category: 'Misc', note: '', date: today() });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function add(e) {
    e.preventDefault();
    if (!(+form.amount > 0)) return;
    await api.add('expenses', {
      amount: +form.amount, category: form.category, note: form.note,
      date: new Date(form.date).toISOString(),
    });
    setForm({ amount: '', category: 'Misc', note: '', date: today() });
    reload();
  }

  const monthTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="expenses">
      <form className="card" onSubmit={add}>
        <h3>Add Expense</h3>
        <input type="number" placeholder="Amount ₹" value={form.amount} onChange={set('amount')} />
        <select value={form.category} onChange={set('category')}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Note" value={form.note} onChange={set('note')} />
        <input type="date" value={form.date} onChange={set('date')} />
        <button className="primary">Add</button>
      </form>

      <div className="total">Total: {money(monthTotal)} · {rows.length} entries</div>
      {rows.map((r) => (
        <div key={r.id} className="row">
          <div><b>{r.category}</b><small>{new Date(r.date).toLocaleDateString('en-IN')} · {r.note}</small></div>
          <span>{money(r.amount)}</span>
          <button onClick={() => api.remove('expenses', r.id).then(reload)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
