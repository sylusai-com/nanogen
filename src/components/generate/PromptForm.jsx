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

// HTML banner studio. Pulls aspects + styles + enabled text models from DB
// (with stale-while-revalidate caching so opening the page is instant
// after the first visit) and submits to /api/banners. Aspect ratio and
// style now live inline with the prompt (next to the reference / model /
// subject pills) so the whole composer reads as one surface.
export default function PromptForm({
  onSubmit,
  isGenerating,
  initialPrompt = "",
  initialAspect = null,
  initialStyle = null,
  initialModel = "auto",
  initialReference = null,
  initialSubject = null,
  submitLabel = "Generate banner",
  busyLabel = "Generating",
}) {
  const { supabase } = useAuth();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState(initialAspect);
  const [style, setStyle] = useState(initialStyle);
  // ChatGPT-style model picker. "auto" → run every enabled model in
  // parallel and keep the best (legacy behavior). A specific slug →
  // generate with that model only.
  const [modelSlug, setModelSlug] = useState(initialModel || "auto");
  // Optional reference image — { name, dataUrl } or null. Sent to the
  // server as `referenceImage`; the AI extracts subject/palette/mood.
  const [reference, setReference] = useState(initialReference);
  // Optional subject image — { name, dataUrl } or null. Sent to the
  // server as `subjectImage`; lands as the bg_image so the user's photo
  // / product / person actually appears IN the rendered banner.
  const [subject, setSubject] = useState(initialSubject);

  // Catalogs change rarely (admins toggle them through /admin). 30 min
  // TTL + sessionStorage persistence means a returning user hydrates
  // pickers instantly on first paint; mutations invalidate by tag.
  const aspectsQ = useCachedQuery(
    ["catalog", "aspects"],
    () => listAspectRatios(supabase),
    { ttlMs: 30 * 60_000, tags: ["aspects"] },
  );
  const stylesQ = useCachedQuery(
    ["catalog", "styles"],
    () => listBannerStyles(supabase),
    { ttlMs: 30 * 60_000, tags: ["styles"] },
  );
  const modelsQ = useCachedQuery(
    ["catalog", "text-models"],
    () => listEnabledTextModels(supabase),
    { ttlMs: 30 * 60_000, tags: ["models"] },
  );

  const aspects   = aspectsQ.data;
  const styles    = stylesQ.data;
  const textModels = modelsQ.data;
  const loadError = aspectsQ.error || stylesQ.error || modelsQ.error;
  const catalogLoading = (aspectsQ.isLoading && !aspects) || (stylesQ.isLoading && !styles);

  useEffect(() => {
    if (aspect == null && aspects?.length) {
      Promise.resolve().then(() => setAspect(aspects[0].ratio));
    }
  }, [aspect, aspects]);

  const ready = aspects && styles;
  const canSubmit =
    !isGenerating && prompt.trim() && aspect && ready;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      prompt: prompt.trim(),
      aspect,
      style: style || null,
      model: modelSlug && modelSlug !== "auto" ? modelSlug : null,
      referenceImage: reference?.dataUrl || null,
      subjectImage: subject?.dataUrl || null,
    });
  };

  return (
    <Card elevated as="form" className="p-5 md:p-6 space-y-5">
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        reference={reference}
        onReferenceChange={setReference}
        subject={subject}
        onSubjectChange={setSubject}
        models={textModels}
        modelsLoading={modelsQ.isLoading && !textModels}
        modelSlug={modelSlug}
        onModelChange={setModelSlug}
        aspects={aspects}
        aspect={aspect}
        onAspectChange={setAspect}
        styles={styles}
        style={style}
        onStyleChange={setStyle}
        catalogLoading={catalogLoading}
      />

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {loadError}
        </div>
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
          {isGenerating ? busyLabel : submitLabel}
        </Button>
      </div>
    </Card>
  );
}
