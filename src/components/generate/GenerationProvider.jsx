// src/components/generate/GenerationProvider.jsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { invalidateTags } from "@/lib/cache";
import { GenerationSteps } from "@/lib/bannerGeneration";
import GenerationPopup from "@/components/generate/GenerationPopup";

// Single source of truth for the floating GenerationPopup. Mounted ONCE
// at the dashboard layout so the popup keeps running when the user
// navigates away from the page that started the generation — previously
// the popup was rendered inside each page (BannersHub, RegenerateDialog),
// which meant Next.js unmounted it the moment the user clicked a link.
//
// API:
//   const { startGeneration } = useGeneration();
//   startGeneration({
//     payload,      // POST body for /api/banners
//     aspect,       // for the skeleton's aspect ratio
//     onSuccess,    // optional: ({ banner, generation }) => void
//     onError,      // optional: (err) => void
//     redirectTo,   // optional: pathname to navigate to after success
//                   //   (e.g. "/dashboard/banners" for regenerate)
//     isAdmin,      // surfaces detailed model errors when true
//   });

const Ctx = createContext(null);

export function useGeneration() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGeneration must be used inside <GenerationProvider>");
  return ctx;
}

const INITIAL = {
  open: false,
  aspect: "16:9",
  currentStep: null,
  stepsCompleted: [],
  stepsSkipped: [],
  done: false,
  error: null,
  successTitle: null,
  targetUrl: null,
  modelErrors: [],
  warning: null,
  banner: null,
};

export default function GenerationProvider({ children }) {
  const router = useRouter();
  const [gen, setGen] = useState(INITIAL);

  // Tracks the in-flight job so a second startGeneration call can ignore
  // late responses from a previous one (e.g. user kicks off a regenerate
  // while a previous one is still polling).
  const activeJobRef = useRef(null);

  const pollGeneration = useCallback(async (jobId, maxAttempts = 240) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`/api/generation-status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Status request failed (${res.status})`);
      // Drop updates for stale jobs — happens when the user starts a
      // second generation before the first one finishes polling.
      if (activeJobRef.current !== jobId) return data;
      setGen((s) => ({
        ...s,
        currentStep: data.currentStep || s.currentStep,
        stepsCompleted: Array.isArray(data.stepsCompleted) ? data.stepsCompleted : s.stepsCompleted,
        stepsSkipped: Array.isArray(data.stepsSkipped) ? data.stepsSkipped : s.stepsSkipped,
      }));
      if (data.status === "completed") return data;
      if (data.status === "failed") throw new Error(data.error || "Generation failed");
      await new Promise((r) => setTimeout(r, 800));
    }
    throw new Error("Generation timed out");
  }, []);

  const startGeneration = useCallback(async ({
    payload,
    aspect = "16:9",
    onSuccess = null,
    onError = null,
    redirectTo = null,
    isAdmin = false,
  }) => {
    // Reset popup to a fresh "processing" state.
    setGen({
      ...INITIAL,
      open: true,
      aspect: aspect || "16:9",
      currentStep: GenerationSteps.UPLOAD_IMAGES,
    });

    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.jobId) throw new Error("Server did not return a job ID");

      activeJobRef.current = data.jobId;
      const generation = await pollGeneration(data.jobId);
      if (activeJobRef.current !== data.jobId) return; // stale

      // Invalidate every list view that depends on banners so all open
      // dashboards refetch in the background.
      const tags = ["banners", "generation_results"];
      if (payload?.regenerateFromId) tags.push(`banner:${payload.regenerateFromId}`);
      invalidateTags(tags);

      const banner = generation?.banner;
      const usedFallback = generation?.results?.usedFallback === true;
      const jobModelErrors = generation?.results?.modelErrors || [];

      setGen((s) => ({
        ...s,
        done: true,
        currentStep: null,
        stepsCompleted: Array.isArray(generation?.stepsCompleted) ? generation.stepsCompleted : s.stepsCompleted,
        stepsSkipped: Array.isArray(generation?.stepsSkipped) ? generation.stepsSkipped : s.stepsSkipped,
        successTitle: banner?.title || null,
        // `redirectTo` overrides the per-banner edit URL — used by the
        // regenerate flow to land on the gallery instead of the editor.
        targetUrl: redirectTo || (banner?.id ? `/dashboard/banners/${banner.id}/edit` : null),
        modelErrors: isAdmin && Array.isArray(jobModelErrors) ? jobModelErrors : [],
        warning: usedFallback
          ? (isAdmin
              ? "Banner saved using the static fallback template — every configured model errored or returned malformed output. Fix in Admin → Models."
              : "We couldn't reach the AI model just now, so we saved a default banner you can edit.")
          : null,
        banner: banner || null,
      }));

      onSuccess?.({ banner, generation });
    } catch (err) {
      if (activeJobRef.current && activeJobRef.current === activeJobRef.current) {
        setGen((s) => ({
          ...s,
          done: false,
          error: err?.message || "Generation failed",
        }));
      }
      onError?.(err);
    }
  }, [pollGeneration]);

  const cancel = useCallback(() => {
    activeJobRef.current = null;
    setGen(INITIAL);
  }, []);

  const dismiss = useCallback(() => {
    const target = gen.targetUrl;
    activeJobRef.current = null;
    setGen(INITIAL);
    if (target) router.push(target);
  }, [gen.targetUrl, router]);

  return (
    <Ctx.Provider value={{ gen, startGeneration, cancel, dismiss }}>
      {children}
      <GenerationPopup
        open={gen.open}
        aspect={gen.aspect}
        currentStep={gen.currentStep}
        stepsCompleted={gen.stepsCompleted}
        stepsSkipped={gen.stepsSkipped}
        done={gen.done}
        error={gen.error}
        successTitle={gen.successTitle}
        banner={gen.banner}
        onCancel={cancel}
        onDismiss={dismiss}
      />
    </Ctx.Provider>
  );
}
