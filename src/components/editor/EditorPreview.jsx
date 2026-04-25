"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";

function aspectRatio(a) {
  if (a === "1:1") return "1 / 1";
  if (a === "4:5") return "4 / 5";
  if (a === "9:16") return "9 / 16";
  return "16 / 9";
}

// Build the iframe srcDoc once. Field updates (text + colors + alignment) are
// pushed via postMessage so the iframe doesn't reload between edits.
function buildSrcDoc(template) {
  if (!template) return "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${template.css}</style>
  </head>
  <body>
    ${template.html}
    <script>
      window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'patch') {
          const root = document.querySelector('.banner');
          if (e.data.alignment) root && root.setAttribute('data-align', e.data.alignment);
          if (e.data.fields) {
            for (const f of e.data.fields) {
              if (f.type === 'text' && f.slot) {
                const el = document.querySelector('[data-slot="' + f.slot + '"]');
                if (el) el.textContent = f.value;
              } else if (f.type === 'color' && f.cssVar) {
                document.documentElement.style.setProperty(f.cssVar, f.value);
              }
            }
          }
        }
      });
    </script>
  </body>
</html>`;
}

export default function EditorPreview({ template, fields, alignment, aspect = "16:9", className }) {
  const ref = useRef(null);
  const srcDoc = useMemo(() => buildSrcDoc(template), [template]);

  useEffect(() => {
    const win = ref.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "patch", fields, alignment }, "*");
  }, [fields, alignment]);

  if (!template) {
    return (
      <div className={cn("rounded-2xl border border-border bg-surface skeleton", className)} style={{ aspectRatio: aspectRatio(aspect) }} />
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-border bg-surface-2 p-3", className)}
    >
      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: aspectRatio(aspect) }}>
        <iframe
          ref={ref}
          title="Banner preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          className="h-full w-full border-0 bg-white"
          onLoad={() => {
            const win = ref.current?.contentWindow;
            win?.postMessage({ type: "patch", fields, alignment }, "*");
          }}
        />
      </div>
    </div>
  );
}
