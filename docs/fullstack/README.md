# FastBill POS — Full-stack reference (restaurant + bakery)

A minimal, DRY, extensible full-stack POS. The **live FastBill app**
(`app/www/index.html`) already implements these features against this exact
backend; this folder is the clean React + schema reference to build on.

## Stack
- **DB + API:** Supabase (PostgreSQL + PostgREST auto REST + RLS + Auth + Storage)
- **Frontend:** React (components here) — or the shipped vanilla single-file app
- **Auth/multi-tenant:** every row `owner = auth.uid()`, isolated by RLS

## Files
| File | What |
|------|------|
| `schema.sql` | All tables, relationships, RLS, and the `produce_batch` function |
| `api.md` | REST + RPC endpoints per feature |
| `lib/supabase.js` | One client + generic `api` CRUD + `useCollection` hook (DRY core) |
| `components/SaleScreen.jsx` | Item grid + cart with +/- counters + running total |
| `components/ProductForm.jsx` | Product CRUD with image upload → Storage URL |
| `components/ExpenseEntry.jsx` | Expense add/list by category & date |

## Data relationships (summary)
```
products ─< recipes >─ raw_materials         (BOM: many-to-many)
products ─< production_logs                  (each PRODUCE/WASTAGE/ADJUST)
sales   (items jsonb snapshot) ─ customers ─< receivables
suppliers ─< purchases >─ raw_materials      (stock inward)
suppliers ─< supplier_payments               (supplier ledger)
staff ─< attendance,  staff ─< advances      (staff ledger)
accounts ─< account_txns                     (cash/bank ledger)
expenses (amount, category, date)
```

## Inventory adjustment logic (production)
Making a recipe must be **atomic** — deduct every ingredient, fail if any is
short, add the finished product, and log it. That lives in one Postgres
function so a half-finished batch can never corrupt stock:

```sql
select produce_batch(<product_id>, <qty>);   -- see schema.sql
```

- Reads `recipes` for the product, multiplies each `qty_required` by the batch qty.
- Raises `Not enough X` (rolls back everything) if a material is short.
- Otherwise `raw_materials.stock_qty -= used`, `products.stock_qty += qty`,
  and inserts a `production_logs` row with the materials consumed.
- `security invoker` ⇒ runs under the caller's RLS, so it only ever touches
  that shop's rows.

Client call (SDK): `await sb.rpc('produce_batch', { p_product_id: id, p_qty: qty })`.

**Sales** do the opposite and simpler deduction (finished goods only), inline —
see `SaleScreen.confirmSale`.

## Run the React reference
```bash
npm create vite@latest fastbill -- --template react
npm i @supabase/supabase-js
# .env: VITE_SUPABASE_URL=...  VITE_SUPABASE_KEY=<publishable key>
# create a public Storage bucket "product-images" for ProductForm uploads
```

## Extending
- New feature = new table + the same `api`/`useCollection` pattern; RLS via the
  loop in `schema.sql`. No new endpoints to write (PostgREST exposes them).
- Money reports (P&L) = sums over `sales`, `expenses`, `purchases`, `advances`.
