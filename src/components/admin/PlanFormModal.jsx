import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export default function PlanFormModal({ open, plan, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    credits: 5,
    description: "",
    is_default: false,
  });

  useEffect(() => {
    if (open) {
      if (plan) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm({
          id: plan.id,
          name: plan.name || "",
          slug: plan.slug || "",
          credits: plan.credits ?? 5,
          description: plan.description || "",
          is_default: !!plan.is_default,
        });
      } else {
         
        setForm({
          name: "",
          slug: "",
          credits: 5,
          description: "",
          is_default: false,
        });
      }
       
      setError(null);
    }
  }, [open, plan]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={plan ? "Edit plan" : "New plan"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-4 md:p-5">
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-xs text-danger-text">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Plan name
            </label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary"
              placeholder="e.g. Free, Pro"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Slug
            </label>
            <input
              required
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary"
              placeholder="e.g. free, pro"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Credits per month
            </label>
            <input
              required
              type="number"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value, 10) || 0 })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary"
              min="-1"
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Use -1 for unlimited credits.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary"
              placeholder="Brief description of the plan"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-border-strong">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-surface"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Default plan</span>
              <span className="text-[11px] text-muted">
                Assign to all new users by default.
              </span>
            </div>
          </label>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !form.name || !form.slug}>
            {busy ? "Saving…" : "Save plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
