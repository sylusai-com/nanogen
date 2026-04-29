// src/lib/db/aspects.js
// Aspect ratios — admin-managed. Anyone (incl. anon) can read enabled rows.
// Only admins can write (RLS enforced server-side).
//
// Mutations invalidate the "aspects" cache tag.

import { invalidateTags } from "@/lib/cache";

const COLUMNS = `
  id, slug, label, ratio, enabled,
  sortOrder:sort_order,
  createdAt:created_at,
  updatedAt:updated_at
`;

function normalizePagination({ page = 1, pageSize = null } = {}) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = pageSize == null ? null : Math.max(1, Math.floor(Number(pageSize) || 1));
  return {
    page: safePage,
    pageSize: safePageSize,
    from: safePageSize ? (safePage - 1) * safePageSize : 0,
    to: safePageSize ? (safePage - 1) * safePageSize + safePageSize - 1 : 0,
  };
}

export async function listAspectRatios(supabase) {
  const { data, error } = await supabase
    .from("aspect_ratios")
    .select(COLUMNS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listAllAspectRatios(supabase, options = {}) {
  const { page, pageSize, from, to } = normalizePagination(options);
  const paginated = pageSize != null;
  let query = supabase
    .from("aspect_ratios")
    .select(COLUMNS, paginated ? { count: "exact" } : undefined)
    .order("sort_order", { ascending: true });
  if (paginated) query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  if (!paginated) return data || [];
  const total = count ?? 0;
  return { rows: data || [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function createAspectRatio(supabase, row) {
  const { data, error } = await supabase
    .from("aspect_ratios")
    .insert(toRow(row))
    .select(COLUMNS)
    .single();
  if (error) throw error;
  invalidateTags(["aspects"]);
  return data;
}

export async function updateAspectRatio(supabase, id, patch) {
  const { data, error } = await supabase
    .from("aspect_ratios")
    .update(toRow(patch))
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  invalidateTags(["aspects"]);
  return data;
}

export async function deleteAspectRatio(supabase, id) {
  const { error } = await supabase
    .from("aspect_ratios")
    .delete()
    .eq("id", id);
  if (error) throw error;
  invalidateTags(["aspects"]);
}

function toRow(p) {
  const out = {};
  if (p.slug      !== undefined) out.slug       = p.slug;
  if (p.label     !== undefined) out.label      = p.label;
  if (p.ratio     !== undefined) out.ratio      = p.ratio;
  if (p.enabled   !== undefined) out.enabled    = p.enabled;
  if (p.sortOrder !== undefined) out.sort_order = p.sortOrder;
  return out;
}