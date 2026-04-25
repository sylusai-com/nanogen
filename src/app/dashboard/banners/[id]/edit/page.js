"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Save } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";
import EditorPreview from "@/components/editor/EditorPreview";
import EditorPanel from "@/components/editor/EditorPanel";
import { getBanner } from "@/lib/mockData";

export default function BannerEditor({ params }) {
  const { id } = use(params);
  const [banner, setBanner] = useState(null);
  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [alignment, setAlignment] = useState("left");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBanner(getBanner(id));
  }, [id]);

  useEffect(() => {
    if (!banner) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/banners/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: banner.title,
            style: banner.style,
            aspect: banner.aspect,
          }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setTemplate({ html: data.html, css: data.css });
        setFields(data.fields);
        setAlignment(data.alignment || "left");
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load template");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [banner]);

  const onFieldChange = (id, value) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
    setSaved(false);
  };

  const onAlignmentChange = (a) => {
    setAlignment(a);
    setSaved(false);
  };

  const onSave = () => {
    // TODO: POST to /api/banners/[id] with { fields, alignment }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!banner) {
    return (
      <>
        <TopBar />
        <div className="px-5 py-10 text-sm text-muted">Banner not found.</div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Editor"
        action={
          <Button
            onClick={onSave}
            leftIcon={saved ? <Save className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          >
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/banners/${banner.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to banner
          </Link>
          <div className="text-xs text-muted">{banner.title}</div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              onClick={() => setBanner({ ...banner })}
              className="ml-3 inline-flex items-center gap-1 text-xs text-red-300 underline-offset-2 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            {loading && !template ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating HTML banner template…
              </div>
            ) : (
              <EditorPreview
                template={template}
                fields={fields}
                alignment={alignment}
                aspect={banner.aspect}
              />
            )}
          </div>
          <div className="space-y-4">
            {fields.length > 0 ? (
              <EditorPanel
                fields={fields}
                alignment={alignment}
                onFieldChange={onFieldChange}
                onAlignmentChange={onAlignmentChange}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-5 text-xs text-muted">
                Loading editor…
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
