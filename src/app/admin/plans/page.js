"use client";

import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Coins, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PlanFormModal from "@/components/admin/PlanFormModal";

async function adminFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ open: false, plan: null });
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = async () => {
    try {
      const data = await adminFetch("/api/admin/credits", { cache: "no-store" });
      setPlans(data || []);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load plans");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.id) reload();
     
  }, [user?.id]);

  const onSave = async (form) => {
    await adminFetch("/api/admin/credits", {
      method: "POST",
      body: JSON.stringify(form),
    });
    await reload();
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setBusyId(deleteTarget.id);
    try {
      await adminFetch(`/api/admin/credits?id=${deleteTarget.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <TopBar
        title="Credit Plans"
        action={
          <Button
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => setModal({ open: true, plan: null })}
          >
            New plan
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Credit plans
          </h1>
          <p className="mt-1 text-sm text-muted">
            Define subscription tiers and their monthly credit allocations. The default plan is automatically assigned to new users.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-text">
            {error}
          </div>
        )}

        {!plans ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyData
            icon={<Coins className="h-5 w-5" />}
            title="No plans yet"
            body="Create a plan to start managing user credits."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <Card elevated key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary ring-1 ring-inset ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
                      <Coins className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold tracking-tight truncate">
                          {p.name}
                        </span>
                        {p.is_default && (
                          <Badge tone="primary">Default</Badge>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-muted">
                        {p.slug}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex-1 space-y-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted">Credits / month</div>
                    <div className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {p.credits === -1 ? "Unlimited" : p.credits}
                    </div>
                  </div>
                  {p.description && (
                    <div className="text-muted-strong leading-relaxed">
                      {p.description}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-1 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, plan: p })}
                    disabled={busyId === p.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-muted-strong hover:bg-surface-2 hover:text-foreground transition-colors"
                  >
                    <Edit3 className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    disabled={busyId === p.id || p.is_default}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={p.is_default ? "Cannot delete the default plan" : ""}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PlanFormModal
        open={modal.open}
        plan={modal.plan}
        onClose={() => setModal({ open: false, plan: null })}
        onSubmit={onSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete plan?"}
        description={deleteTarget ? `This will permanently remove the ${deleteTarget.name} plan. Users on this plan will lose their plan association.` : "This will permanently remove the selected plan."}
        confirmLabel="Delete plan"
        loading={busyId === deleteTarget?.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
