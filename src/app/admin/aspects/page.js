// src/app/admin/aspects/page.js
"use client";

import { useEffect, useState } from "react";
import { Edit3, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import AspectFormModal from "@/components/admin/AspectFormModal";
import Pagination from "@/components/ui/Pagination";
import {
  createAspectRatio,
  deleteAspectRatio,
  listAllAspectRatios,
  updateAspectRatio,
} from "@/lib/db/aspects";

const PAGE_SIZE = 12;

// Visual preview of each aspect ratio
function AspectPreview({ ratio }) {
  const styles = {
    "16:9": { width: 64, height: 36 },
    "1:1":  { width: 48, height: 48 },
    "4:5":  { width: 40, height: 50 },
    "9:16": { width: 27, height: 48 },
  };
  const s = styles[ratio] || { width: 64, height: 36 };
  return (
    <div
      className="rounded-md border-2 border-dashed border-border bg-surface-2"
      style={{ width: s.width, height: s.height }}
    />
  );
}

export default function AdminAspects() {
  const { user, supabase } = useAuth();
  const [aspects, setAspects] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError]   = useState(null);
  const [modal, setModal]   = useState({ open: false, item: null });
  const [busyId, setBusyId] = useState(null);

  const reload = async () => {
    try {
      const result = await listAllAspectRatios(supabase, { page, pageSize: PAGE_SIZE });
      setAspects(result.rows || []);
      setTotalPages(result.totalPages || 1);
      setTotalRows(result.total || 0);
    } catch (e) {
      setError(e.message || "Failed to load aspect ratios");
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  useEffect(() => {
    setPage(1);
  }, []);

  const onCreate = async (form) => {
    await createAspectRatio(supabase, form);
    await reload();
  };

  const onUpdate = async (form) => {
    if (!modal.item?.id) return;
    await updateAspectRatio(supabase, modal.item.id, form);
    await reload();
  };

  const onToggle = async (item) => {
    setBusyId(item.id);
    try {
      await updateAspectRatio(supabase, item.id, { enabled: !item.enabled });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (item) => {
    if (!confirm(`Delete aspect ratio "${item.label}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await deleteAspectRatio(supabase, item.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <TopBar
        title="Aspect Ratios"
        action={
          <Button
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => setModal({ open: true, item: null })}
          >
            New ratio
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Aspect ratio catalog
          </h1>
          <p className="mt-1 text-sm text-muted">
            Controls the ratio chips available to users on the generation form.
            Enabled ratios appear in the prompt form; disabled ones are hidden.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!aspects ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : aspects.length === 0 ? (
          <EmptyData
            icon={<LayoutTemplate className="h-5 w-5" />}
            title="No aspect ratios yet"
            body="Add one to get started."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {aspects.map((item) => (
              <Card elevated key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <AspectPreview ratio={item.ratio} />
                    <div>
                      <div className="text-base font-semibold tracking-tight">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-muted">
                        <code className="font-mono">{item.ratio}</code> ·{" "}
                        <code className="font-mono">{item.slug}</code>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={item.enabled}
                    disabled={busyId === item.id}
                    onChange={() => onToggle(item)}
                    ariaLabel="Toggle enabled"
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Sort order</dt>
                    <dd className="mt-1 font-mono text-foreground">{item.sortOrder}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Status</dt>
                    <dd className="mt-1 text-foreground">
                      {item.enabled ? (
                        <span className="text-emerald-400">Enabled</span>
                      ) : (
                        <span className="text-muted">Disabled</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-end gap-1 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, item })}
                    disabled={busyId === item.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-muted-strong hover:bg-surface-2 hover:text-foreground transition-colors"
                  >
                    <Edit3 className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={busyId === item.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {aspects && totalRows > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      <AspectFormModal
        open={modal.open}
        item={modal.item}
        onClose={() => setModal({ open: false, item: null })}
        onSubmit={modal.item ? onUpdate : onCreate}
      />
    </>
  );
}