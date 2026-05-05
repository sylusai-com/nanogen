// src/app/dashboard/create/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Eyebrow from "@/components/ui/Eyebrow";
import PromptForm from "@/components/generate/PromptForm";
import GenerationProgress from "@/components/generate/GenerationProgress";
import { useAuth } from "@/components/layout/AuthProvider";
import { invalidateTags } from "@/lib/cache";

export default function DashboardCreate() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  // Flips true the moment /api/banners returns successfully. The progress
  // bar reads it to fill from its 90% hold ceiling up to 100% before the
  // route change fires — without this the bar would just freeze at 90%
  // until the page navigates.
  const [generationDone, setGenerationDone] = useState(false);
  const [submittedAspect, setSubmittedAspect] = useState("16:9");
  const [error, setError]           = useState(null);
  const [modelErrors, setModelErrors] = useState([]);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    setGenerationDone(false);
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

      // Tell the progress bar to finish from 90 → 100. The fill animation
      // is short (~700ms) so the bar reaches 100% just as the redirect
      // fires for the no-warning path below.
      setGenerationDone(true);

      // A new banner was just persisted server-side — drop the dashboard
      // cache so /dashboard/banners shows it immediately on next visit.
      // Also invalidate generation_results so admin views (model stats)
      // refresh when new runs/results are created.
      invalidateTags(["banners", "generation_results"]);

      // Surface per-model failures only to admins — regular users don't
      // need to know which model failed. Admins can use the warning to
      // fix the failing rows in Admin → Models.
      if (
        isAdmin &&
        Array.isArray(data.modelErrors) &&
        data.modelErrors.length
      ) {
        setModelErrors(data.modelErrors);
      }

      const hasMultipleSaved = Array.isArray(data.banners) && data.banners.length > 1;
      const destination = hasMultipleSaved
        ? "/dashboard/banners"
        : `/dashboard/banners/${data.banner.id}/edit`;

      // If the WINNER fell back, surface why — admins see the reason
      // verbatim, regular users get a generic notice.
      if (data.reason) {
        setError(
          isAdmin
            ? `Banner saved using the fallback template. Reason: ${data.reason}`
            : "We couldn't reach the AI model just now, so we saved a default banner you can edit.",
        );
        setTimeout(() => {
          router.push(destination);
        }, 2800);
        return;
      }

      // If we picked the top scorer below threshold, suggest regenerating
      // for a stronger result. Internal threshold/score numbers are hidden
      // from regular users.
      if (data.passedThreshold === false && typeof data.score === "number") {
        setError(
          isAdmin
            ? `Showing the top-scoring variant (${data.score}/100). None of the ${data.variants?.length ?? 0} variants reached the ${data.threshold}-point threshold — regenerate or refine the prompt for a stronger result.`
            : "Saved your banner — try regenerating or refining your prompt if you want a stronger result.",
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
              ? "Hang tight — your banner is being generated. This usually takes 10–30 seconds."
              : "Describe the banner you want in plain language. We’ll generate it from your prompt and drop you into the editor."}
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
          <PromptForm onSubmit={onSubmit} isGenerating={submitting} />
        )}
      </div>
    </>
  );
}