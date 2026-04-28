// src/app/dashboard/builder/[id]/page.js
"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Code,
  Download,
  Layers,
  Loader2,
  Save,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import Tabs from "@/components/ui/Tabs";
import { getBanner, updateBanner } from "@/lib/db/banners";
import Canvas from "@/components/builder/Canvas";
import Toolbar from "@/components/builder/Toolbar";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import LayersPanel from "@/components/builder/LayersPanel";

// ── Helpers ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultsFor(type) {
  switch (type) {
    case "text":
      return {
        content: "Edit this text",
        w: 40,
        h: null,
        style: { color: "#ffffff", fontSize: "24px", fontWeight: "600", textAlign: "left", lineHeight: "1.3" },
      };
    case "rect":
      return {
        content: null,
        w: 30,
        h: 20,
        style: { background: "#a78bfa", borderRadius: "8px", opacity: 1 },
      };
    case "button":
      return {
        content: "Click me",
        w: 20,
        h: 8,
        style: { background: "#a78bfa", color: "#ffffff", borderRadius: "999px", fontSize: "14px", fontWeight: "600" },
      };
    case "image":
      return {
        content: "",
        w: 40,
        h: 30,
        style: { borderRadius: "8px" },
      };
    case "divider":
      return {
        content: null,
        w: 80,
        h: 2,
        style: { color: "rgba(255,255,255,0.2)", thickness: "2px" },
      };
    default:
      return { content: null, w: 20, h: 10, style: {} };
  }
}

const RIGHT_TABS = [
  { id: "properties", label: <span className="inline-flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Properties</span> },
  { id: "layers",     label: <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Layers</span> },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BuilderPage({ params }) {
  const { id } = use(params);
  const { user, supabase } = useAuth();
  const router = useRouter();

  const [banner,    setBanner]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState(null);
  const [error,     setError]     = useState(null);

  // Canvas state
  const [background,  setBackground]  = useState("#0c0c10");
  const [elements,    setElements]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [rightTab,    setRightTab]    = useState("properties");

  // ── Load banner ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getBanner(supabase, id)
      .then((b) => {
        if (cancelled) return;
        setBanner(b);
        if (b?.canvas) {
          setBackground(b.canvas.background || "#0c0c10");
          setElements(b.canvas.elements || []);
        } else {
          // Seed from HTML fields if canvas is empty and fields exist
          const seeded = seedFromFields(b?.fields || []);
          setElements(seeded);
          setBackground(
            (b?.fields || []).find((f) => f.id === "bg")?.value || "#0c0c10"
          );
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, user, supabase]);

  // ── Seed canvas from HTML editor fields when first opening builder ────────
  function seedFromFields(fields) {
    const els = [];
    let y = 8;
    for (const f of fields) {
      if (f.type !== "text") continue;
      const isHeadline  = f.id === "headline";
      const isEyebrow   = f.id === "eyebrow";
      const isCta       = f.id === "cta";
      const fontSize    = isHeadline ? "48px" : isEyebrow ? "12px" : isCta ? "14px" : "18px";
      const fontWeight  = isHeadline ? "700" : isCta ? "600" : "400";
      const color       =
        (fields.find((f2) => f2.id === "fg")?.value) || "#ffffff";
      els.push({
        id: uid(),
        type: isCta ? "button" : "text",
        x: 7,
        y,
        w: isCta ? 18 : 86,
        h: null,
        content: f.value || f.label,
        style: {
          color,
          fontSize,
          fontWeight,
          textAlign: "left",
          lineHeight: isHeadline ? "1.1" : "1.4",
        },
      });
      y += isHeadline ? 22 : isEyebrow ? 6 : 10;
    }
    return els;
  }

  // ── Canvas mutations ─────────────────────────────────────────────────────
  const addElement = useCallback((type) => {
    const newEl = {
      id: uid(),
      type,
      x: 10 + Math.random() * 20,
      y: 10 + Math.random() * 20,
      ...defaultsFor(type),
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  }, []);

  const updateElement = useCallback((updated) => {
    setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)));
  }, []);

  const duplicateSelected = useCallback(() => {
    const src = elements.find((el) => el.id === selectedId);
    if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), x: src.x + 3, y: src.y + 3 };
    setElements((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }, [elements, selectedId]);

  const deleteSelected = useCallback(() => {
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const alignSelected = useCallback((align) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedId) return el;
        const xMap = { left: 5, center: (100 - el.w) / 2, right: 95 - el.w };
        return { ...el, x: xMap[align] ?? el.x };
      })
    );
  }, [selectedId]);

  const moveLayer = useCallback((idx, dir) => {
    setElements((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!banner) return;
    setSaving(true);
    setError(null);
    try {
      const canvas = { background, elements };
      const updated = await updateBanner(supabase, banner.id, { canvas });
      if (updated) setBanner(updated);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Export to HTML ────────────────────────────────────────────────────────
  const exportHtml = () => {
    const aspect = banner?.aspect || "16:9";
    const [w, h] = aspect.split(":").map(Number);
    const pct = (h / w) * 100;
    const innerHtml = elements
      .map((el) => {
        const posStyle = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;${el.h ? `height:${el.h}%;` : ""}`;
        switch (el.type) {
          case "text":
            return `<div style="${posStyle}font-size:${el.style.fontSize||"16px"};font-weight:${el.style.fontWeight||"400"};color:${el.style.color||"#fff"};text-align:${el.style.textAlign||"left"};line-height:${el.style.lineHeight||1.4}">${el.content||""}</div>`;
          case "rect":
            return `<div style="${posStyle}background:${el.style.background||"#a78bfa"};border-radius:${el.style.borderRadius||"8px"};opacity:${el.style.opacity??1}"></div>`;
          case "button":
            return `<div style="${posStyle}display:inline-flex;align-items:center;justify-content:center;background:${el.style.background||"#a78bfa"};color:${el.style.color||"#fff"};border-radius:${el.style.borderRadius||"999px"};font-size:${el.style.fontSize||"14px"};font-weight:${el.style.fontWeight||"600"}">${el.content||"Button"}</div>`;
          case "image":
            return `<div style="${posStyle}overflow:hidden;border-radius:${el.style.borderRadius||"8px"}"><img src="${el.content||""}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`;
          case "divider":
            return `<div style="${posStyle}height:${el.style.thickness||"2px"};background:${el.style.color||"rgba(255,255,255,0.2)"};border-radius:999px"></div>`;
          default:
            return "";
        }
      })
      .join("\n");
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif}.canvas{position:relative;width:100%;padding-bottom:${pct.toFixed(2)}%;background:${background}}.canvas-inner{position:absolute;inset:0}</style></head><body><div class="canvas"><div class="canvas-inner">${innerHtml}</div></div></body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${banner?.title || "banner"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TopBar title="Builder" />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8">
          <Skeleton className="h-[480px]" />
        </div>
      </>
    );
  }

  if (!banner) {
    return (
      <>
        <TopBar title="Builder" />
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <EmptyData
            title="Banner not found"
            body="It may have been deleted or you don't have access."
            action={<Button href="/dashboard/banners">Back to banners</Button>}
          />
        </div>
      </>
    );
  }

  const justSaved     = savedAt && Date.now() - savedAt < 1500;
  const selectedEl    = elements.find((el) => el.id === selectedId) || null;

  return (
    <>
      <TopBar
        title="Builder"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Code className="h-3.5 w-3.5" />}
              onClick={exportHtml}
            >
              Export HTML
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving}
              leftIcon={
                saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : justSaved ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )
              }
            >
              {saving ? "Saving" : justSaved ? "Saved" : "Save"}
            </Button>
          </div>
        }
      />

      {/* Full-height builder layout */}
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
        {/* Sub-header */}
        <div className="flex items-center gap-3 border-b border-border bg-surface/60 px-4 py-2 backdrop-blur">
          <Link
            href={`/dashboard/banners/${banner.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {banner.title}
          </Link>
          {error && (
            <span className="ml-auto text-xs text-red-400">{error}</span>
          )}
        </div>

        {/* Three-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Toolbar */}
          <Toolbar
            onAddElement={addElement}
            selectedId={selectedId}
            selectedElement={selectedEl}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onAlignElement={alignSelected}
            background={background}
            onBackgroundChange={setBackground}
          />

          {/* Center: Canvas */}
          <Canvas
            elements={elements}
            selectedId={selectedId}
            background={background}
            aspect={banner.aspect || "16:9"}
            onSelectElement={setSelectedId}
            onUpdateElement={updateElement}
            onDeselectAll={() => setSelectedId(null)}
          />

          {/* Right: Properties / Layers */}
          <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface/60 backdrop-blur overflow-hidden">
            <div className="border-b border-border px-3 py-2">
              <Tabs
                size="sm"
                value={rightTab}
                onChange={setRightTab}
                tabs={RIGHT_TABS}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {rightTab === "properties" ? (
                <PropertiesPanel element={selectedEl} onChange={updateElement} />
              ) : (
                <LayersPanel
                  elements={elements}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMoveUp={(idx) => moveLayer(idx, 1)}
                  onMoveDown={(idx) => moveLayer(idx, -1)}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}