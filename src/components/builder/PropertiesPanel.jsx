// src/components/builder/PropertiesPanel.jsx
"use client";

import { useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Loader2, Upload } from "lucide-react";
import { Label, Input } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { compressImage, isImageFile } from "@/lib/imageUpload";

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <Input
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
        />
      </div>
    </Row>
  );
}

function NumberRow({ label, value, onChange, min, max, unit = "px" }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={parseFloat(value) || 0}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value + (unit !== "raw" ? unit : ""))}
          className="w-20 font-mono text-xs"
        />
        {unit !== "raw" && (
          <span className="text-[11px] text-muted">{unit}</span>
        )}
      </div>
    </Row>
  );
}

function AlignRow({ value, onChange }) {
  const opts = [
    { v: "left", icon: AlignLeft },
    { v: "center", icon: AlignCenter },
    { v: "right", icon: AlignRight },
  ];
  return (
    <Row label="Text align">
      <div className="flex gap-1">
        {opts.map(({ v, icon: Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors ${
              value === v
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </Row>
  );
}

// Position + size controls — edit the layout of the element on the canvas.
function LayoutSection({ element, onChange }) {
  const update = (key, val) =>
    onChange({ ...element, [key]: parseFloat(val) || 0 });

  return (
    <Section title="Position & size">
      <div className="grid grid-cols-2 gap-2">
        <Row label="X (%)">
          <Input
            type="number"
            value={element.x?.toFixed(1) ?? 0}
            min={0}
            max={100}
            step={0.1}
            onChange={(e) => update("x", e.target.value)}
            className="font-mono text-xs"
          />
        </Row>
        <Row label="Y (%)">
          <Input
            type="number"
            value={element.y?.toFixed(1) ?? 0}
            min={0}
            max={100}
            step={0.1}
            onChange={(e) => update("y", e.target.value)}
            className="font-mono text-xs"
          />
        </Row>
        <Row label="W (%)">
          <Input
            type="number"
            value={element.w?.toFixed(1) ?? 10}
            min={1}
            max={100}
            step={0.1}
            onChange={(e) => update("w", e.target.value)}
            className="font-mono text-xs"
          />
        </Row>
        {element.type !== "text" && element.type !== "divider" && (
          <Row label="H (%)">
            <Input
              type="number"
              value={element.h?.toFixed(1) ?? 10}
              min={1}
              max={100}
              step={0.1}
              onChange={(e) => update("h", e.target.value)}
              className="font-mono text-xs"
            />
          </Row>
        )}
      </div>
    </Section>
  );
}

function updateStyle(element, stylePatch) {
  return { ...element, style: { ...element.style, ...stylePatch } };
}

function ImageUploadRow({ element, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setErr(null);
    if (!isImageFile(file)) {
      setErr("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onChange({ ...element, content: dataUrl });
    } catch (e) {
      setErr(e?.message || "Failed to process image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Row label="Upload">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {busy ? "Processing…" : "Upload image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {err && <div className="text-[11px] text-red-400">{err}</div>}
    </Row>
  );
}

export default function PropertiesPanel({ element, onChange }) {
  if (!element) {
    return (
      <Card elevated className="p-5">
        <div className="flex h-32 items-center justify-center text-xs text-muted">
          Select an element to edit its properties.
        </div>
      </Card>
    );
  }

  const s = element.style || {};
  const upd = (patch) => onChange(updateStyle(element, patch));

  return (
    <Card elevated className="divide-y divide-border p-0 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            {element.type}
          </span>
          <span className="text-[11px] text-muted font-mono">{element.id.slice(0, 8)}</span>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <LayoutSection element={element} onChange={onChange} />
      </div>

      {/* Content */}
      {(element.type === "text" || element.type === "button") && (
        <div className="space-y-3 p-4">
          <Section title="Content">
            <Row label="Text">
              <textarea
                rows={3}
                value={element.content || ""}
                onChange={(e) => onChange({ ...element, content: e.target.value })}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </Row>
          </Section>
        </div>
      )}

      {element.type === "image" && (
        <div className="space-y-3 p-4">
          <Section title="Image">
            <Row label="URL">
              <Input
                value={element.content?.startsWith("data:") ? "Uploaded image" : (element.content || "")}
                readOnly={element.content?.startsWith("data:")}
                onChange={(e) => onChange({ ...element, content: e.target.value })}
                placeholder="https://…"
                className="text-xs"
              />
            </Row>
            <ImageUploadRow element={element} onChange={onChange} />
          </Section>
        </div>
      )}

      {/* Typography (text + button) */}
      {(element.type === "text" || element.type === "button") && (
        <div className="space-y-3 p-4">
          <Section title="Typography">
            <ColorRow
              label="Color"
              value={s.color}
              onChange={(v) => upd({ color: v })}
            />
            <Row label="Font size">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={parseFloat(s.fontSize) || 16}
                  min={8}
                  max={200}
                  onChange={(e) => upd({ fontSize: `${e.target.value}px` })}
                  className="w-20 font-mono text-xs"
                />
                <span className="text-[11px] text-muted">px</span>
              </div>
            </Row>
            <Row label="Font weight">
              <select
                value={s.fontWeight || "400"}
                onChange={(e) => upd({ fontWeight: e.target.value })}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {["100", "200", "300", "400", "500", "600", "700", "800", "900"].map(
                  (w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  )
                )}
              </select>
            </Row>
            <Row label="Line height">
              <Input
                type="number"
                value={parseFloat(s.lineHeight) || 1.4}
                step={0.05}
                min={0.8}
                max={4}
                onChange={(e) => upd({ lineHeight: e.target.value })}
                className="font-mono text-xs"
              />
            </Row>
            <AlignRow
              value={s.textAlign || "left"}
              onChange={(v) => upd({ textAlign: v })}
            />
          </Section>
        </div>
      )}

      {/* Fill (rect, button, image) */}
      {(element.type === "rect" || element.type === "button" || element.type === "image") && (
        <div className="space-y-3 p-4">
          <Section title="Fill">
            <ColorRow
              label="Background"
              value={s.background}
              onChange={(v) => upd({ background: v })}
            />
            <Row label="Border radius">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={parseFloat(s.borderRadius) || 8}
                  min={0}
                  max={200}
                  onChange={(e) => upd({ borderRadius: `${e.target.value}px` })}
                  className="w-20 font-mono text-xs"
                />
                <span className="text-[11px] text-muted">px</span>
              </div>
            </Row>
            {element.type === "rect" && (
              <Row label="Opacity">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={s.opacity ?? 1}
                    onChange={(e) => upd({ opacity: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-10 text-right font-mono text-[11px] text-muted">
                    {Math.round((s.opacity ?? 1) * 100)}%
                  </span>
                </div>
              </Row>
            )}
          </Section>
        </div>
      )}

      {/* Divider style */}
      {element.type === "divider" && (
        <div className="space-y-3 p-4">
          <Section title="Divider">
            <ColorRow
              label="Color"
              value={s.color}
              onChange={(v) => upd({ color: v })}
            />
            <Row label="Thickness">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={parseFloat(s.thickness) || 2}
                  min={1}
                  max={24}
                  onChange={(e) => upd({ thickness: `${e.target.value}px` })}
                  className="w-20 font-mono text-xs"
                />
                <span className="text-[11px] text-muted">px</span>
              </div>
            </Row>
          </Section>
        </div>
      )}
    </Card>
  );
}