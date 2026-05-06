"use client";

import {
  use, useCallback, useEffect, useRef, useState, startTransition,
} from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, ChevronDown, Download,
  Loader2, Save, Maximize2, ZoomIn,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";
import EmptyData from "@/components/ui/EmptyData";
import { getBanner, updateBanner } from "@/lib/db/banners";
import { buildCompositeStandaloneHtml, rasterize, rasterizeToPdf, triggerDownload } from "@/lib/bannerDownload";

import Canvas      from "@/components/builder/Canvas";
import CanvaToolbar from "@/components/builder/Toolbar";
import LeftPanel   from "@/components/builder/LeftPanel";
import RightPanel  from "@/components/builder/RightPanel";

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultsFor(type, overrides = {}) {
  const base = (() => {
    switch (type) {
      case "text":    return { content: "Edit this text", w: 40, h: null, style: { color: "#ffffff", fontSize: "24px", fontWeight: "600", textAlign: "left", lineHeight: "1.3" } };
      case "rect":    return { content: null, w: 30, h: 20, style: { background: "#a78bfa", borderRadius: "8px", opacity: 1 } };
      case "button":  return { content: "Click me", w: 22, h: 8, style: { background: "#a78bfa", color: "#ffffff", borderRadius: "999px", fontSize: "14px", fontWeight: "600" } };
      case "image":   return { content: "", w: 40, h: 30, style: { borderRadius: "8px" } };
      case "divider": return { content: null, w: 80, h: 2, style: { color: "rgba(255,255,255,0.2)", thickness: "2px" } };
      default:        return { content: null, w: 20, h: 10, style: {} };
    }
  })();
  return {
    ...base,
    ...overrides,
    style: { ...base.style, ...(overrides.style || {}) },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BuilderPage({ params }) {
  const { id }              = use(params);
  const { user, supabase }  = useAuth();

  // ── Data state ────────────────────────────────────────────────────────────
  const [banner,    setBanner]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error,     setError]     = useState(null);
  const justSavedTimer            = useRef(null);

  // ── Canvas state ──────────────────────────────────────────────────────────
  const [background,  setBackground]  = useState("#0c0c10");
  const [elements,    setElements]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [editingId,   setEditingId]   = useState(null);   // inline text edit
  const [zoom,        setZoom]        = useState(0.6);

  // ── Template / fields state ───────────────────────────────────────────────
  const [template,   setTemplate]   = useState(null);
  const [fields,     setFields]     = useState([]);
  const [alignment,  setAlignment]  = useState("left");

  // ── Export menu ───────────────────────────────────────────────────────────
  const [exportOpen,  setExportOpen]  = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const exportRef                     = useRef(null);

  // ── History ───────────────────────────────────────────────────────────────
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  // Use proper state for canUndo/canRedo so they don't read refs during render
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const captureState = useCallback(() => ({
    elements:   JSON.parse(JSON.stringify(elements)),
    background,
    selectedId,
    fields:     JSON.parse(JSON.stringify(fields)),
    alignment,
  }), [elements, background, selectedId, fields, alignment]);

  const applyState = useCallback((s) => {
    if (!s) return;
    setElements(s.elements || []);
    setBackground(s.background || "#0c0c10");
    setSelectedId(s.selectedId ?? null);
    setFields(s.fields || []);
    setAlignment(s.alignment || "left");
  }, []);

  const recordHistory = useCallback(() => {
    undoStack.current.push(captureState());
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
    syncHistoryState();
  }, [captureState, syncHistoryState]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(captureState());
    applyState(prev);
    syncHistoryState();
  }, [applyState, captureState, syncHistoryState]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(captureState());
    applyState(next);
    syncHistoryState();
  }, [applyState, captureState, syncHistoryState]);

  // ── Canvas mutations (declared before keyboard effect) ───────────────────
  // Use refs to give the keydown handler always-fresh callbacks without
  // re-registering the listener on every render.
  const selectedIdRef = useRef(selectedId);
  const editingIdRef  = useRef(editingId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { editingIdRef.current  = editingId;  }, [editingId]);

  // duplicateSelected — no useCallback so React Compiler can optimize freely.
  // Uses functional setState to read latest elements without a dep on them.
  const duplicateSelected = () => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    setElements((prev) => {
      const src = prev.find((el) => el.id === sid);
      if (!src) return prev;
      recordHistory();
      const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), x: src.x + 3, y: src.y + 3 };
      setSelectedId(copy.id);
      return [...prev, copy];
    });
  };

  const deleteSelected = () => {
    const sid = selectedIdRef.current;
    if (!sid || editingIdRef.current) return;
    recordHistory();
    setElements((prev) => prev.filter((el) => el.id !== sid));
    setSelectedId(null);
    setEditingId(null);
  };

  // Stable refs so the keydown listener always calls the latest version
  const duplicateRef = useRef(duplicateSelected);
  const deleteRef    = useRef(deleteSelected);
  const onSaveRef    = useRef(null);

  useEffect(() => { duplicateRef.current = duplicateSelected; });
  useEffect(() => { deleteRef.current    = deleteSelected; });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod   = isMac ? e.metaKey : e.ctrlKey;
      const key   = e.key.toLowerCase();
      const tag   = document.activeElement?.tagName?.toLowerCase();

      // Don't intercept when typing in an input/textarea
      if (tag === "input" || tag === "textarea") return;

      if (mod && key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (mod && key === "d") { e.preventDefault(); duplicateRef.current(); }
      if (mod && key === "s") { e.preventDefault(); onSaveRef.current?.(); }
      if (key === "backspace" || key === "delete") {
        if (selectedIdRef.current && !editingIdRef.current) {
          e.preventDefault();
          deleteRef.current();
        }
      }
      if (key === "escape") {
        setEditingId(null);
        setSelectedId(null);
      }

      // Arrow nudge
      const sid = selectedIdRef.current;
      if (sid && !editingIdRef.current && ["arrowleft","arrowright","arrowup","arrowdown"].includes(key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.25;
        setElements((prev) => prev.map((el) => {
          if (el.id !== sid) return el;
          const dx = key === "arrowright" ? step : key === "arrowleft" ? -step : 0;
          const dy = key === "arrowdown"  ? step : key === "arrowup"   ? -step : 0;
          return { ...el, x: Math.max(0, el.x + dx), y: Math.max(0, el.y + dy) };
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]); // stable — everything else accessed via refs

  // Close export menu on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Load banner ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    getBanner(supabase, id)
      .then((b) => {
        if (cancelled) return;
        startTransition(() => setBanner(b));
        const stored  = b?.canvas;
        const hasEls  = Array.isArray(stored?.elements) && stored.elements.length > 0;
        const fieldBg = (b?.fields || []).find((f) => f.id === "bg")?.value;
        const initBg  = stored?.background || fieldBg || "#0c0c10";
        startTransition(() => {
          setBackground(initBg);
          setElements(hasEls ? stored.elements : []);
          setTemplate({ html: b?.html, css: b?.css });
          setFields(b?.fields || []);
          setAlignment(b?.alignment || "left");
        });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && startTransition(() => setLoading(false)));
    return () => { cancelled = true; };
  }, [id, user, supabase]);

  // Fetch template HTML/CSS if missing
  useEffect(() => {
    if (!banner || (template?.html && template?.css)) return;
    if (banner.html || banner.css) return;
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch("/api/banners/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: banner.prompt || banner.title, style: banner.style, aspect: banner.aspect }),
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
  }, [banner, template?.html, template?.css]);

  // ── Canvas mutations ──────────────────────────────────────────────────────
  const addElement = useCallback((type, overrides = {}) => {
    recordHistory();
    const el = {
      id: uid(), type,
      x: 10 + Math.random() * 30,
      y: 10 + Math.random() * 30,
      rotation: 0,
      ...defaultsFor(type, overrides),
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setEditingId(null);
  }, [recordHistory]);

  const updateElement = useCallback((updated) => {
    setElements((prev) => prev.map((el) => el.id === updated.id ? updated : el));
  }, []);

  const updateElementAndRecord = useCallback((updated) => {
    recordHistory();
    setElements((prev) => prev.map((el) => el.id === updated.id ? updated : el));
  }, [recordHistory]);

  const alignSelected = useCallback((align) => {
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    recordHistory();
    setElements((prev) => prev.map((e) => {
      if (e.id !== selectedId) return e;
      const xMap = { left: 2, center: (100 - e.w) / 2, right: 98 - e.w };
      const yMap = { top: 2, middle: (100 - (e.h ?? 10)) / 2 };
      return {
        ...e,
        ...(xMap[align] !== undefined ? { x: xMap[align] } : {}),
        ...(yMap[align] !== undefined ? { y: yMap[align] } : {}),
      };
    }));
  }, [elements, selectedId, recordHistory]);

  const moveLayer = useCallback((idx, dir) => {
    recordHistory();
    setElements((prev) => {
      const next   = [...prev];
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

  const onFieldChange = useCallback((fieldId, value) => {
    recordHistory();
    setFields((prev) => prev.map((f) => f.id === fieldId ? { ...f, value } : f));
  }, [recordHistory]);

  const onAlignmentChange = useCallback((a) => {
    recordHistory();
    setAlignment(a);
  }, [recordHistory]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    // Trigger Canvas internal fit by resetting zoom to sentinel
    setZoom((z) => z); // canvas re-centers on mount; trigger via key workaround
    // We re-trigger fit by briefly setting a special value then restoring
    setZoom(0.001);
    setTimeout(() => setZoom(0.001), 0);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!banner) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBanner(supabase, banner.id, {
        canvas:    { background, elements },
        fields,
        alignment,
        html:      template?.html,
        css:       template?.css,
      });
      if (updated) setBanner(updated);
      setSavedAt(Date.now());
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      setJustSaved(true);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 1800);
      undoStack.current = [];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };
  // Keep ref in sync so ⌘S in the keydown listener always calls latest onSave
  useEffect(() => { onSaveRef.current = onSave; });

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    setExportOpen(false);
    setExporting(true);
    try {
      const html = template?.html;
      const css  = template?.css;
      const slug = (banner?.title || "banner").toLowerCase().replace(/\s+/g, "-").slice(0, 40);

      const aspect = banner?.aspect || "16:9";
      const shared = { html, css, fields, alignment, aspect, elements, canvasBackground: background };
      if (format === "html") {
        const doc = buildCompositeStandaloneHtml({ html, css, fields, alignment, title: banner?.title || "banner", elements, aspect, background });
        triggerDownload(`${slug}.html`, doc, "text/html");
      } else if (format === "png") {
        const dataUrl = await rasterize({ ...shared, format: "image/png", scale: 2 });
        triggerDownload(`${slug}.png`, dataUrl);
      } else if (format === "jpg") {
        const dataUrl = await rasterize({ ...shared, format: "image/jpeg", scale: 2, background: "#ffffff" });
        triggerDownload(`${slug}.jpg`, dataUrl);
      } else if (format === "pdf") {
        const blob = await rasterizeToPdf(shared);
        triggerDownload(`${slug}.pdf`, URL.createObjectURL(blob), "application/pdf");
      }
    } catch (e) {
      setError(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TopBar title="Builder" />
        <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted">Loading banner…</p>
          </div>
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
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-3 backdrop-blur z-30">
        {/* Back */}
        <Link
          href={`/dashboard/banners/${banner.id}`}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden max-w-30 truncate sm:block">{banner.title}</span>
        </Link>

        {/* Title */}
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs font-medium text-foreground truncate max-w-50">{banner.title}</span>
          {banner.aspect && (
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
              {banner.aspect}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <span className="truncate text-xs text-red-400 max-w-50">{error}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Export */}
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-muted-strong transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-10 z-50 w-36 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
                {[
                  { fmt: "html", label: "HTML file" },
                  { fmt: "png",  label: "PNG image" },
                  { fmt: "jpg",  label: "JPEG image" },
                  { fmt: "pdf",  label: "PDF document" },
                ].map(({ fmt, label }) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleExport(fmt)}
                    className="flex w-full items-center px-4 py-2.5 text-left text-xs text-muted-strong transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save */}
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
            {saving ? "Saving…" : justSaved ? "Saved!" : "Save"}
          </Button>
        </div>
      </header>

      {/* ── Canva-style secondary toolbar ────────────────────────────────── */}
      <CanvaToolbar
        selectedId={selectedId}
        selectedElement={selectedEl}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onAlignElement={alignSelected}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToScreen={() => setZoom(0.001)}
        onZoom100={() => setZoom(1)}
      />

      {/* ── Three-column layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: elements/layers/upload panel */}
        <LeftPanel
          elements={elements}
          selectedId={selectedId}
          background={background}
          onAddElement={addElement}
          onSelectElement={(eid) => { setSelectedId(eid); setEditingId(null); }}
          onMoveUp={(idx) => moveLayer(idx, 1)}
          onMoveDown={(idx) => moveLayer(idx, -1)}
          onBackgroundChange={changeBackground}
        />

        {/* Center: infinite canvas */}
        <Canvas
          elements={elements}
          selectedId={selectedId}
          editingId={editingId}
          background={background}
          aspect={banner.aspect || "16:9"}
          html={template?.html}
          css={template?.css}
          fields={fields}
          alignment={alignment}
          zoom={zoom}
          onZoomChange={setZoom}
          onSelectElement={(eid) => { setSelectedId(eid); setEditingId(null); }}
          onUpdateElement={updateElement}
          onDeselectAll={() => { setSelectedId(null); setEditingId(null); }}
          onStartEdit={(eid) => { setSelectedId(eid); setEditingId(eid); }}
          onEndEdit={() => setEditingId(null)}
        />

        {/* Right: properties + fields */}
        <RightPanel
          element={selectedEl}
          onChange={updateElementAndRecord}
          fields={fields}
          alignment={alignment}
          onFieldChange={onFieldChange}
          onAlignmentChange={onAlignmentChange}
        />
      </div>
    </div>
  );
}