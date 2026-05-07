// src/app/dashboard/create/page.js
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Eyebrow from "@/components/ui/Eyebrow";
import PromptForm from "@/components/generate/PromptForm";
import GenerationProgress from "@/components/generate/GenerationProgress";
import { useAuth } from "@/components/layout/AuthProvider";
import { invalidateTags } from "@/lib/cache";
import { GenerationSteps } from "@/lib/bannerGeneration";

export default function DashboardCreate() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [submittedAspect, setSubmittedAspect] = useState("16:9");
  const [error, setError] = useState(null);
  const [modelErrors, setModelErrors] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  const pollGenerationStatus = useCallback(async (jobId, maxAttempts = 120) => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/generation-status/${jobId}`);
        const data = await res.json();

        if (data.status === "completed") {
          setGenerationDone(true);
          return data.banner;
        }

        if (data.status === "failed") {
          throw new Error(data.error || "Generation failed");
        }

        if (data.currentStep) {
          setCurrentStep(data.currentStep);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      } catch (e) {
        console.error("Error polling generation status:", e);
        throw e;
      }
    }

    throw new Error("Generation timeout");
  }, []);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    setGenerationDone(false);
    setSubmittedAspect(payload.aspect || "16:9");
    setError(null);
    setGenerationError(null);
    setModelErrors([]);
    setCurrentStep(GenerationSteps.ANALYZE_REFERENCE);

    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // If we got a job ID, poll for status
      if (data.jobId) {
        try {
          const banner = await pollGenerationStatus(data.jobId);
          setGenerationDone(true);
          invalidateTags(["banners", "generation_results"]);

          if (isAdmin && Array.isArray(data.modelErrors) && data.modelErrors.length) {
            setModelErrors(data.modelErrors);
          }

          const hasMultipleSaved = Array.isArray(data.banners) && data.banners.length > 1;
          const destination = hasMultipleSaved
            ? "/dashboard/banners"
            : `/dashboard/banners/${banner.id}/edit`;

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

          router.push(destination);
        } catch (pollError) {
          setGenerationError(pollError.message || "Generation failed");
          setSubmitting(false);
        }
      } else {
        // Fallback: immediate completion
        setGenerationDone(true);
        invalidateTags(["banners", "generation_results"]);

        if (isAdmin && Array.isArray(data.modelErrors) && data.modelErrors.length) {
          setModelErrors(data.modelErrors);
        }

        const hasMultipleSaved = Array.isArray(data.banners) && data.banners.length > 1;
        const destination = hasMultipleSaved
          ? "/dashboard/banners"
          : `/dashboard/banners/${data.banner.id}/edit`;

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

        router.push(destination);
      }
    } catch (e) {
      setGenerationError(e?.message || "Generation failed");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSubmitting(false);
    setGenerationDone(false);
    setCurrentStep(null);
    setGenerationError(null);
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
              ? "Hang tight — your banner is being generated step by step. This usually takes 10–30 seconds."
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
          <GenerationProgress 
            aspect={submittedAspect} 
            done={generationDone} 
            currentStep={currentStep}
            error={generationError}
            onCancel={handleCancel}
          />
        ) : (
          <PromptForm onSubmit={onSubmit} isGenerating={submitting} />
        )}
      </div>
    </>
  );
}