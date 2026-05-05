// src/components/generate/PromptForm.jsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import { listAspectRatios } from "@/lib/db/aspects";
import { listBannerStyles } from "@/lib/db/styles";
import { listEnabledTextModels } from "@/lib/db/models";
import { useCachedQuery } from "@/lib/cache";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PromptInput from "./PromptInput";
import AspectSelector from "./AspectSelector";
import StyleSelector from "./StyleSelector";
import ReferenceUpload from "./ReferenceUpload";
import ModelPicker from "./ModelPicker";

// HTML banner studio. Pulls aspects + styles + enabled text models from DB
// (with stale-while-revalidate caching so opening the page is instant
// after the first visit) and submits to /api/banners.
export default function PromptForm({ onSubmit, isGenerating }) {
  const { supabase } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState(null);
  const [style, setStyle] = useState(null);
  // ChatGPT-style model picker. "auto" → run every enabled model in
  // parallel and keep the best (legacy behavior). A specific slug →
  // generate with that model only.
  const [modelSlug, setModelSlug] = useState("auto");
  // Optional reference image — { name, dataUrl } or null. Sent to the
  // server as `referenceImage` and used as the bg_image in every variant.
  const [reference, setReference] = useState(null);

  // Catalog data is admin-managed and rarely changes. Cache for 5 minutes
  // and revalidate in the background — the form re-renders if a new
  // aspect / style / model is added between visits.
  const aspectsQ = useCachedQuery(
    ["catalog", "aspects"],
    () => listAspectRatios(supabase),
    { ttlMs: 5 * 60_000, tags: ["aspects"] },
  );
  const stylesQ = useCachedQuery(
    ["catalog", "styles"],
    () => listBannerStyles(supabase),
    { ttlMs: 5 * 60_000, tags: ["styles"] },
  );
  const modelsQ = useCachedQuery(
    ["catalog", "text-models"],
    () => listEnabledTextModels(supabase),
    { ttlMs: 5 * 60_000, tags: ["models"] },
  );

  const aspects   = aspectsQ.data;
  const styles    = stylesQ.data;
  const textModels = modelsQ.data;
  const loadError = aspectsQ.error || stylesQ.error || modelsQ.error;

  // Default the aspect ratio once the catalog loads (16:9 is a sensible
  // physical default — the canvas needs SOME shape). Style is intentionally
  // left empty: we don't want to bias the model toward a theme the user
  // never asked for. The user can still pick one explicitly.
  useEffect(() => {
    if (aspect == null && aspects?.length) {
      // schedule to avoid synchronous setState inside effect
      Promise.resolve().then(() => setAspect(aspects[0].ratio));
    }
  }, [aspect, aspects]);

  const ready = aspects && styles;
  // Style is OPTIONAL — submit is allowed without one.
  const canSubmit =
    !isGenerating && prompt.trim() && aspect && ready;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      prompt: prompt.trim(),
      aspect,
      // null when the user didn't pick anything — the API treats that as
      // "no preference" and lets the model choose freely.
      style: style || null,
      // "auto" → fan-out across every enabled model. Otherwise the slug
      // of the single model the user picked.
      model: modelSlug && modelSlug !== "auto" ? modelSlug : null,
      referenceImage: reference?.dataUrl || null,
    });
  };

  return (
    <Card elevated as="form" className="p-5 md:p-6 space-y-6">
      <PromptInput value={prompt} onChange={setPrompt} />

      {!ready ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading catalog…
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {loadError}
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <AspectSelector
              options={aspects}
              value={aspect}
              onChange={setAspect}
            />
            <StyleSelector
              options={styles}
              value={style}
              onChange={setStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Model
            </label>
            <ModelPicker
              models={textModels}
              value={modelSlug}
              onChange={setModelSlug}
              loading={modelsQ.isLoading && !textModels}
            />
          </div>

          <ReferenceUpload value={reference} onChange={setReference} />
        </>
      )}

      <div className="divider-soft" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">
          Saves directly to your banners. Edit further in the builder.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          rightIcon={
            isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            )
          }
        >
          {isGenerating ? "Generating" : "Generate banner"}
        </Button>
      </div>
    </Card>
  );
}
