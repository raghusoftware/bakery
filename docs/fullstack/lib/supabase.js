// Single Supabase client + tiny DRY data helpers shared by every component.
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';

export const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// One generic CRUD wrapper for any table — keeps every feature DRY.
export const api = {
  list: (table, q = (b) => b) =>
    q(sb.from(table).select('*').order('id')).then(r => r.data ?? []),
  add: (table, row) =>
    sb.from(table).insert(row).select('id').single().then(r => r.data?.id),
  update: (table, id, patch) =>
    sb.from(table).update(patch).eq('id', id),
  remove: (table, id) =>
    sb.from(table).delete().eq('id', id),
  rpc: (fn, args) => sb.rpc(fn, args),
};

// Reusable hook: load a collection + expose reload. Used by every screen.
export function useCollection(table, query) {
  const [rows, setRows] = useState([]);
  const reload = useCallback(async () => setRows(await api.list(table, query)), [table]);
  useEffect(() => { reload(); }, [reload]);
  return [rows, reload, setRows];
}

export const money = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
