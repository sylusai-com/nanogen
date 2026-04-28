// src/app/admin/styles/page.js
"use client";

import { useEffect, useState } from "react";
import { Edit3, Palette, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import StyleFormModal from "@/components/admin/StyleFormModal";
import {
  createBannerStyle,
  deleteBannerStyle,
  listAllBannerStyles,
  updateBannerStyle,
} from "@/lib/db/styles";

function ColorSwatch({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-5 w-5 rounded-full border border-border ring-1 ring-inset ring-black/10"
        style={{ background: color }}
      />
      <span className="font-mono text-[11px] text-muted">{color}</span>
      {label && <span className="text-[10px] text-muted/60">({label})</span>}
    </div>
  );
}

export default function AdminStyles() {
  const { user, supabase } = useAuth();
  const [styles, setStyles]   = useState(null);
  const [error, setError]     = useState(null);
  const [modal, setModal]     = useState({ open: false, item: null });
  const [busyId, setBusyId]   = useState(null);

  const reload = async () => {
    try {
      const rows = await listAllBannerStyles(supabase);
      setStyles(rows);
    } catch (e) {
      setError(e.message || "Failed to load styles");
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onCreate = async (form) => {
    await createBannerStyle(supabase, form);
    await reload();
  };

  const onUpdate = async (form) => {
    if (!modal.item?.id) return;
    await updateBannerStyle(supabase, modal.item.id, form);
    await reload();
  };

  const onToggle = async (item) => {
    setBusyId(item.id);
    try {
      await updateBannerStyle(supabase, item.id, { enabled: !item.enabled });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (item) => {
    if (!confirm(`Delete style "${item.label}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await deleteBannerStyle(supabase, item.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <TopBar
        title="Banner Styles"
        action={
          <Button
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => setModal({ open: true, item: null })}
          >
            New style
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Banner style catalog
          </h1>
          <p className="mt-1 text-sm text-muted">
            Each style drives the color preset applied by the HTML banner generator,
            and the chip options shown on the generation form.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!styles ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : styles.length === 0 ? (
          <EmptyData
            icon={<Palette className="h-5 w-5" />}
            title="No styles yet"
            body="Add one to get started."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {styles.map((item) => (
              <Card elevated key={item.id} className="overflow-hidden p-0">
                {/* Gradient preview */}
                <div
                  className="h-20 w-full"
                  style={{ background: item.gradient || item.bg }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold tracking-tight">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-muted">
                        <code className="font-mono">{item.slug}</code>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-[11px] text-muted">{item.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={item.enabled}
                      disabled={busyId === item.id}
                      onChange={() => onToggle(item)}
                      ariaLabel="Toggle enabled"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <ColorSwatch color={item.bg}     label="bg" />
                    <ColorSwatch color={item.fg}     label="fg" />
                    <ColorSwatch color={item.accent} label="accent" />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
                    <div className="text-[11px] text-muted">
                      Sort: <span className="font-mono text-foreground">{item.sortOrder}</span>
                    </div>
                    <div className="flex items-center gap-1">
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <StyleFormModal
        open={modal.open}
        item={modal.item}
        onClose={() => setModal({ open: false, item: null })}
        onSubmit={modal.item ? onUpdate : onCreate}
      />
    </>
  );
}