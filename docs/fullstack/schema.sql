-- ============================================================================
-- FastBill POS — Database schema (PostgreSQL / Supabase)
-- Multi-tenant: every row is owned by an auth user (owner = auth.uid()).
-- Row-Level Security isolates each shop's data. PostgREST auto-exposes REST.
-- ============================================================================

-- Convention used by every table:
--   id       bigint identity primary key
--   owner    uuid, defaults to the caller (auth.uid()), FK to auth.users
--   created_at timestamptz default now()
-- RLS policy per table: USING/CHECK (owner = auth.uid()).

-- ---------- Catalogue ----------
create table categories      (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, created_at timestamptz default now());
create table products        (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, category text, price numeric default 0, stock_qty numeric default 0, barcode text, image text /* URL or data-URI blob */, created_at timestamptz default now());

-- ---------- Inventory: raw materials + recipes (BOM) ----------
create table raw_materials   (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, unit text, stock_qty numeric default 0, reorder_level numeric default 0, cost_per_unit numeric default 0, created_at timestamptz default now());
create table recipes         (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, product_id bigint references products(id) on delete cascade, raw_material_id bigint references raw_materials(id) on delete cascade, qty_required numeric, created_at timestamptz default now());
create table production_logs  (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, product_id bigint, product_name text, qty_produced numeric, type text /* PRODUCE | WASTAGE | ADJUST */, reason text, materials_used jsonb, date timestamptz, date_str text, created_at timestamptz default now());

-- ---------- Sales / customers / receivables ----------
create table customers       (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, phone text, address text, created_at timestamptz default now());
create table sales           (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, invoice_no text, items jsonb /* [{id,name,price,qty}] */, subtotal numeric, discount numeric, gst_amount numeric, total numeric, customer_id bigint, customer_name text, pay_mode text, order_type text, table_no text, account_id bigint, date timestamptz, date_str text, created_at timestamptz default now());
create table receivables     (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, sale_id bigint, invoice_no text, customer_id bigint, customer_name text, customer_phone text, amount numeric, date timestamptz, date_str text, settled boolean default false, settled_date timestamptz, created_at timestamptz default now());

-- ---------- Suppliers / purchases (stock inward) / payables ----------
create table suppliers        (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, phone text, address text, gstin text, created_at timestamptz default now());
create table purchases        (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, supplier_id bigint references suppliers(id) on delete set null, supplier_name text, raw_material_id bigint references raw_materials(id) on delete set null, raw_material_name text, qty numeric, unit text, rate numeric, total numeric, paid boolean, account_id bigint, notes text, date timestamptz, date_str text, created_at timestamptz default now());
create table supplier_payments(id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, supplier_id bigint, supplier_name text, account_id bigint, amount numeric, note text, date timestamptz, created_at timestamptz default now());

-- ---------- Staff / attendance / advances (staff payables) ----------
create table staff           (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, phone text, role text, wage_type text /* MONTHLY | DAILY */, monthly_salary numeric, daily_rate numeric, join_date timestamptz, is_active boolean default true, created_at timestamptz default now());
create table attendance       (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, staff_id bigint references staff(id) on delete cascade, date timestamptz, status text /* P | A | H */, check_in text, created_at timestamptz default now());
create table advances         (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, staff_id bigint references staff(id) on delete cascade, staff_name text, account_id bigint, amount numeric, note text, date timestamptz, created_at timestamptz default now());

-- ---------- Money: accounts (cash/bank) + ledger + expenses ----------
create table accounts         (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, type text /* CASH | BANK | UPI */, opening_balance numeric default 0, created_at timestamptz default now());
create table account_txns     (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, account_id bigint references accounts(id) on delete cascade, amount numeric /* +in / -out */, type text, ref text, note text, date timestamptz, date_str text, created_at timestamptz default now());
create table expenses         (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, amount numeric not null, category text, note text, account_id bigint, date timestamptz default now(), created_at timestamptz default now());

-- ---------- Dine-in ----------
create table tables           (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, active boolean default true, created_at timestamptz default now());
create table open_orders      (id bigint generated always as identity primary key, owner uuid not null default auth.uid() references auth.users(id) on delete cascade, table_id bigint, table_no text, order_type text, items jsonb, customer_id bigint, customer_name text, discount numeric, created_at timestamptz default now(), created_str text);

-- ---------- Settings (one row per owner) ----------
create table settings (owner uuid primary key default auth.uid() references auth.users(id) on delete cascade, brand text, name text, address text, phone text, gst numeric, gstin text, updated_at timestamptz default now());

-- ---------- Enable RLS + owner policy on every table (DRY loop) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','customers','sales','raw_materials','recipes','production_logs',
    'staff','attendance','advances','suppliers','purchases','supplier_payments','receivables',
    'accounts','account_txns','expenses','open_orders','tables','settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_all on %I', t);
    execute format('create policy own_all on %I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
    execute format('create index if not exists %I on %I (owner)', t||'_owner_idx', t);
  end loop;
end $$;

-- ============================================================================
-- Inventory adjustment logic for PRODUCTION (atomic, server-side).
-- Deducts every recipe ingredient, raises if short, adds finished stock,
-- and writes a production_logs row. Runs as the caller so RLS applies.
--   select produce_batch(<product_id>, <qty>);
-- ============================================================================
create or replace function produce_batch(p_product_id bigint, p_qty numeric)
returns bigint language plpgsql security invoker as $$
declare r record; used numeric; mats jsonb := '[]'::jsonb; v_name text; v_log_id bigint;
begin
  select name into v_name from products where id = p_product_id and owner = auth.uid();
  if v_name is null then raise exception 'Product not found'; end if;
  for r in
    select rc.raw_material_id, rc.qty_required, rm.name, rm.unit, rm.stock_qty
    from recipes rc join raw_materials rm on rm.id = rc.raw_material_id and rm.owner = auth.uid()
    where rc.product_id = p_product_id and rc.owner = auth.uid()
  loop
    used := r.qty_required * p_qty;
    if r.stock_qty < used then raise exception 'Not enough %: need % have %', r.name, used, r.stock_qty; end if;
    update raw_materials set stock_qty = stock_qty - used where id = r.raw_material_id and owner = auth.uid();
    mats := mats || jsonb_build_object('rm_id', r.raw_material_id, 'rm_name', r.name, 'qty_used', used, 'unit', r.unit);
  end loop;
  update products set stock_qty = stock_qty + p_qty where id = p_product_id and owner = auth.uid();
  insert into production_logs(product_id, product_name, qty_produced, type, materials_used, date, date_str)
  values (p_product_id, v_name, p_qty, 'PRODUCE', mats, now(), to_char(now(),'DD Mon HH24:MI'))
  returning id into v_log_id;
  return v_log_id;
end $$;
