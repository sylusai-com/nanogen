// src/app/dashboard/builder/[id]/page.js
"use client";

import { use, useCallback, useEffect, useRef, useState, startTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Save,
  Settings2,
  Type,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";
import EmptyData from "@/components/ui/EmptyData";
import Tabs from "@/components/ui/Tabs";
import { getBanner, updateBanner } from "@/lib/db/banners";
import Canvas from "@/components/builder/Canvas";
import Toolbar from "@/components/builder/Toolbar";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import LayersPanel from "@/components/builder/LayersPanel";
import EditorPanel from "@/components/editor/EditorPanel";

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
  { id: "fields",     label: <span className="inline-flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Fields</span> },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BuilderPage({ params }) {
  const { id } = use(params);
  const { user, supabase } = useAuth();

  const [banner,    setBanner]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef(null);
  const [error,     setError]     = useState(null);

  // Canvas state (for visual elements)
  const [background,  setBackground]  = useState("#0c0c10");
  const [elements,    setElements]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [rightTab,    setRightTab]    = useState("properties");
  const [mobilePanel, setMobilePanel] = useState(null); // null | "tools" | "props"

  // Template state (for field editing)
  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [alignment, setAlignment] = useState("left");

  const initialElementsRef = useRef([]);
  const initialBackgroundRef = useRef("#0c0c10");
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [, setHistoryTick] = useState(0);
  const templateSeededRef = useRef(false);

  const captureState = useCallback(() => ({
    elements: JSON.parse(JSON.stringify(elements)),
    background,
    selectedId,
    fields: JSON.parse(JSON.stringify(fields)),
    alignment,
  }), [elements, background, selectedId, fields, alignment]);

  const applyState = useCallback((state) => {
    if (!state) return;
    setElements(state.elements || []);
    setBackground(state.background || "#0c0c10");
    setSelectedId(state.selectedId ?? null);
    setFields(state.fields || []);
    setAlignment(state.alignment || "left");
  }, []);

  const recordHistory = useCallback(() => {
    undoStackRef.current.push(captureState());
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setHistoryTick((n) => n + 1);
  }, [captureState]);

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(captureState());
    applyState(prev);
    setHistoryTick((n) => n + 1);
  }, [applyState, captureState]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(captureState());
    applyState(next);
    setHistoryTick((n) => n + 1);
  }, [applyState, captureState]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  useEffect(() => {
    const onKeyDown = (event) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  // ── Load banner ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    getBanner(supabase, id)
      .then((b) => {
        if (cancelled) return;
        startTransition(() => setBanner(b));

        const stored      = b?.canvas;
        const hasElements = Array.isArray(stored?.elements) && stored.elements.length > 0;
        const fieldsBg    = (b?.fields || []).find((f) => f.id === "bg")?.value;
        const initialBg   = stored?.background || fieldsBg || "#0c0c10";

        initialBackgroundRef.current = initialBg;
        initialElementsRef.current = hasElements ? stored.elements : [];
        templateSeededRef.current = hasElements;

        startTransition(() => {
          setBackground(initialBg);
          setElements(hasElements ? stored.elements : []);
          // Load template fields and HTML/CSS
          setTemplate({ html: b?.html, css: b?.css });
          setFields(b?.fields || []);
          setAlignment(b?.alignment || "left");
        });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && startTransition(() => setLoading(false)));
    return () => { cancelled = true; };
  }, [id, user, supabase]);

  // ── Fetch template if not present ────────────────────────────────────────
  useEffect(() => {
    if (!banner) return;
    // If template already loaded, skip
    if (template?.html && template?.css) return;
    if (!banner.html || !banner.css) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch("/api/banners/html", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: banner.prompt || banner.title,
              style: banner.style,
              aspect: banner.aspect,
            }),
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          const data = await res.json();
          if (cancelled) return;
          startTransition(() => {
            setTemplate({ html: data.html, css: data.css });
            setFields(data.fields);
            setAlignment(data.alignment || "left");
          });
        } catch (e) {
          if (!cancelled) setError(e.message || "Failed to load template");
        }
      })();
      return () => { cancelled = true; };
    }
  }, [banner, template?.html, template?.css]);

  // ── Canvas mutations ─────────────────────────────────────────────────────
  const addElement = useCallback((type) => {
    recordHistory();
    const newEl = {
      id: uid(),
      type,
      x: 10 + Math.random() * 20,
      y: 10 + Math.random() * 20,
      ...defaultsFor(type),
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  }, [recordHistory]);

  const updateElement = useCallback((updated) => {
    recordHistory();
    setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)));
  }, [recordHistory]);

  const duplicateSelected = useCallback(() => {
    recordHistory();
    const src = elements.find((el) => el.id === selectedId);
    if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), x: src.x + 3, y: src.y + 3 };
    setElements((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }, [elements, selectedId, recordHistory]);

  const deleteSelected = useCallback(() => {
    recordHistory();
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, recordHistory]);

  const alignSelected = useCallback((align) => {
    recordHistory();
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedId) return el;
        const xMap = { left: 5, center: (100 - el.w) / 2, right: 95 - el.w };
        return { ...el, x: xMap[align] ?? el.x };
      })
    );
  }, [selectedId, recordHistory]);

  const moveLayer = useCallback((idx, dir) => {
    recordHistory();
    setElements((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, [recordHistory]);

  const changeBackground = useCallback((value) => {
    recordHistory();
    setBackground(value);
  }, [recordHistory]);

  // ── Field editing (for template fields) ─────────────────────────────────
  const onFieldChange = useCallback((fieldId, value) => {
    recordHistory();
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, value } : f)));
  }, [recordHistory]);

  const onAlignmentChange = useCallback((a) => {
    recordHistory();
    setAlignment(a);
  }, [recordHistory]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!banner) return;
    setSaving(true);
    setError(null);
    try {
      const canvas = { background, elements };
      const patch = {
        canvas,
        fields,
        alignment,
        html: template?.html,
        css: template?.css,
      };

      const updated = await updateBanner(supabase, banner.id, patch);
      if (updated) setBanner(updated);
      setSavedAt(Date.now());
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      setJustSaved(true);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 1500);
      initialElementsRef.current = JSON.parse(JSON.stringify(elements));
      initialBackgroundRef.current = background;
      undoStackRef.current = [];
      redoStackRef.current = [];
      setHistoryTick((n) => n + 1);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TopBar title="Builder" />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8">
          <div className="h-96 rounded-lg bg-surface-2 animate-pulse" />
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


  const selectedEl = elements.find((el) => el.id === selectedId) || null;

  return (
    <>
      <TopBar
        title="Builder"
        action={
          <div className="flex items-center gap-2">
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
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
        {/* Sub-header */}
        <div className="flex items-center gap-3 border-b border-border bg-surface/60 px-3 py-2 backdrop-blur md:px-4">
          <Link
            href={`/dashboard/banners/${banner.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="max-w-[40vw] truncate md:max-w-none">{banner.title}</span>
          </Link>
          {error && (
            <span className="ml-auto truncate text-xs text-red-400">{error}</span>
          )}
          {/* Mobile-only toggles for the side panels */}
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel((p) => (p === "tools" ? null : "tools"))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] text-muted-strong hover:text-foreground"
            >
              <Layers className="h-3 w-3" /> Tools
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel((p) => (p === "props" ? null : "props"))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] text-muted-strong hover:text-foreground"
            >
              <Settings2 className="h-3 w-3" /> Edit
            </button>
          </div>
        </div>

        {/* Three-panel layout */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Left: Toolbar */}
          <div
            className={
              "absolute inset-y-0 left-0 z-20 transition-transform duration-200 md:static md:translate-x-0 " +
              (mobilePanel === "tools" ? "translate-x-0" : "-translate-x-full md:translate-x-0")
            }
          >
            <Toolbar
              onAddElement={(t) => { addElement(t); setMobilePanel(null); }}
              selectedId={selectedId}
              selectedElement={selectedEl}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onAlignElement={alignSelected}
              background={background}
              onBackgroundChange={changeBackground}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>

          {/* Backdrop to close mobile panels by tapping outside */}
          {mobilePanel && (
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setMobilePanel(null)}
              className="absolute inset-0 z-10 bg-black/40 md:hidden"
            />
          )}

          {/* Center: Canvas */}
          <Canvas
            elements={elements}
            selectedId={selectedId}
            background={background}
            aspect={banner.aspect || "16:9"}
            html={template?.html}
            css={template?.css}
            fields={fields}
            alignment={alignment}
            onSelectElement={setSelectedId}
            onUpdateElement={updateElement}
            onDeselectAll={() => setSelectedId(null)}
          />

          {/* Right: Properties / Layers / Fields */}
          <aside
            className={
              "absolute inset-y-0 right-0 z-20 flex w-72 max-w-[85vw] shrink-0 flex-col border-l border-border bg-surface/95 backdrop-blur transition-transform duration-200 md:static md:max-w-none md:translate-x-0 md:bg-surface/60 " +
              (mobilePanel === "props" ? "translate-x-0" : "translate-x-full md:translate-x-0")
            }
          >
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
              ) : rightTab === "layers" ? (
                <LayersPanel
                  elements={elements}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMoveUp={(idx) => moveLayer(idx, 1)}
                  onMoveDown={(idx) => moveLayer(idx, -1)}
                />
              ) : (
                <EditorPanel
                  fields={fields}
                  alignment={alignment}
                  onFieldChange={onFieldChange}
                  onAlignmentChange={onAlignmentChange}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}