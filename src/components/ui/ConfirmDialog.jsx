"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  destructive = true,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={
              destructive
                ? "bg-red-500/90 text-white hover:bg-red-500 border border-red-400/20 shadow-sm shadow-red-900/30"
                : ""
            }
            leftIcon={
              !loading ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : undefined
            }
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-border-strong bg-surface-2 px-4 py-3.5">
        <div className="mt-0.5 shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-medium text-foreground">
            This action cannot be undone.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
      </div>
    </Modal>
  );
}