// src/app/dashboard/create/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Sparkles } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Eyebrow from "@/components/ui/Eyebrow";
import Card from "@/components/ui/Card";
import PromptForm from "@/components/generate/PromptForm";
import GenerationProgress from "@/components/generate/GenerationProgress";
import { invalidateTags } from "@/lib/cache";

export default function DashboardCreate() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submittedAspect, setSubmittedAspect] = useState("16:9");
  const [error, setError]           = useState(null);
  const [modelErrors, setModelErrors] = useState([]);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    setSubmittedAspect(payload.aspect || "16:9");
    setError(null);
    setModelErrors([]);
    try {
      const res  = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      // A new banner was just persisted server-side — drop the dashboard
      // cache so /dashboard/banners shows it immediately on next visit.
      invalidateTags(["banners"]);

      // Surface per-model failures so admins can see (e.g.) "Claude
      // Sonnet 4.6 failed: invalid model ID — fix in Admin → Models".
      // The banner still saved (other models succeeded or fallback ran)
      // so we redirect after a short pause.
      if (Array.isArray(data.modelErrors) && data.modelErrors.length) {
        setModelErrors(data.modelErrors);
      }

      const hasMultipleSaved = Array.isArray(data.banners) && data.banners.length > 1;
      const destination = hasMultipleSaved
        ? "/dashboard/banners"
        : `/dashboard/banners/${data.banner.id}/edit`;

      // If the WINNER fell back, surface why. Same redirect-after-pause UX.
      if (data.reason) {
        setError(
          `Banner saved using the fallback template. Reason: ${data.reason}`,
        );
        setTimeout(() => {
          router.push(destination);
        }, 2800);
        return;
      }

      // If we picked the top scorer below threshold, let the user know
      // they can regenerate for a stronger result before redirecting.
      if (data.passedThreshold === false && typeof data.score === "number") {
        setError(
          `Showing the top-scoring variant (${data.score}/100). None of the ${data.variants?.length ?? 0} variants reached the ${data.threshold}-point threshold — regenerate or refine the prompt for a stronger result.`,
        );
        setTimeout(() => {
          router.push(destination);
        }, 2800);
        return;
      }

      // If there were per-model errors but the winner is still fine,
      // give the user a moment to see the warnings before we navigate.
      if (modelErrors.length || (Array.isArray(data.modelErrors) && data.modelErrors.length)) {
        setTimeout(() => {
          router.push(destination);
        }, 2800);
        return;
      }

      router.push(destination);
    } catch (e) {
      setError(e?.message || "Generation failed");
      setSubmitting(false);
    }
  };

  return (
    <>
      <TopBar title="Create banner" action={null} />
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
        <header className="mb-8 max-w-2xl">
          <Eyebrow tone="primary">Banner studio</Eyebrow>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            {submitting ? (
              <>Generating your <span className="text-primary-gradient">banner</span></>
            ) : (
              <>Generate a <span className="text-primary-gradient">new banner</span></>
            )}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {submitting
              ? "Nanogen is fanning your prompt out across every enabled text model and scoring each result. Hang tight — usually 15–45 seconds."
              : "Describe the banner. Nanogen fans your prompt across every admin-enabled text model in parallel, scores each result, and surfaces the best one."}
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Heads up</div>
              <div className="text-amber-300/80">{error}</div>
            </div>
          </div>
        )}

        {modelErrors.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-amber-200">
                  {modelErrors.length} model{modelErrors.length > 1 ? "s" : ""} failed during generation
                </div>
                <ul className="mt-2 space-y-1.5">
                  {modelErrors.map((m, i) => (
                    <li key={i} className="text-amber-300/85">
                      <span className="font-mono text-amber-200/95">{m.modelLabel || m.modelId || "fallback"}</span>
                      <span className="text-amber-300/70">: {m.reason}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-[11px] text-amber-300/60">
                  Other models succeeded — the winner is shown. Fix the failing rows in Admin → Models.
                </div>
              </div>
            </div>
          </div>
        )}

        {submitting ? (
          // Skeleton replaces the form entirely while generating — the
          // user gets a single, focused "we're working on it" view.
          <GenerationProgress aspect={submittedAspect} />
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
              <PromptForm onSubmit={onSubmit} isGenerating={submitting} />
            </div>

            <Card elevated className="h-fit p-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary ring-1 ring-inset ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">
                How it works
              </h3>
              <ol className="mt-3 space-y-3 text-xs text-muted">
                <li className="flex gap-2">
                  <span className="font-mono text-muted-strong">1.</span>
                  Your prompt is fanned out across every admin-enabled text
                  model (Admin → Models).
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-muted-strong">2.</span>
                  Each model produces a banner variant; all are scored in
                  parallel against the same rubric.
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-muted-strong">3.</span>
                  The top scorer (≥ 80, else absolute top) is saved to your
                  library — fine-tune in the editor or rearrange in the
                  visual builder.
                </li>
              </ol>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}