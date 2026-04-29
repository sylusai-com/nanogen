// src/app/dashboard/create/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Sparkles } from "lucide-react";
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

  const onSubmit = async (payload) => {
    setSubmitting(true);
    setSubmittedAspect(payload.aspect || "16:9");
    setError(null);
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

      // If the API surfaced a `reason`, the generator fell back. Stop here
      // and surface that to the user instead of silently redirecting — they
      // need to know the model wasn't actually called and admin needs to fix
      // the configuration.
      if (data.reason) {
        setError(
          `Banner saved using the fallback template. Reason: ${data.reason}`,
        );
        setTimeout(() => {
          router.push(`/dashboard/banners/${data.banner.id}/edit`);
        }, 2200);
        return;
      }

      // If we picked the top scorer below threshold, let the user know
      // they can regenerate for a stronger result before redirecting.
      if (data.passedThreshold === false && typeof data.score === "number") {
        setError(
          `Showing the top-scoring variant (${data.score}/100). None of the ${data.variants?.length ?? 0} variants reached the ${data.threshold}-point threshold — regenerate or refine the prompt for a stronger result.`,
        );
        setTimeout(() => {
          router.push(`/dashboard/banners/${data.banner.id}/edit`);
        }, 2200);
        return;
      }

      router.push(`/dashboard/banners/${data.banner.id}/edit`);
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
            Generate a <span className="text-primary-gradient">new banner</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Describe the banner. Nanogen calls the admin-configured text model,
            saves the result, and drops you into the editor.
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

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <PromptForm onSubmit={onSubmit} isGenerating={submitting} />
            {submitting && <GenerationProgress aspect={submittedAspect} />}
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
                Your prompt is sent to the default text model (Admin → Models).
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-muted-strong">2.</span>
                Three banner variants are generated and scored in parallel.
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
      </div>
    </>
  );
}