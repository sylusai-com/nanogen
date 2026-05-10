# Canva-style banner editor

This document explains how the editor at `dashboard/builder/[id]` turns the
AI-generated HTML/CSS banner into editable layers, how new elements are
added, and how everything is persisted so the same banner renders
identically in the editor, the preview, and every download.

## The two halves of a banner

Every saved banner in Supabase has two layers stored side by side:

| Field           | What it holds                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| `html` + `css`  | The AI-generated banner template (decorations, layout, background image).    |
| `fields`        | Structured field values: colors, range sliders, text content, image URLs.   |
| `canvas`        | `{ background, elements[] }` — the editable overlay produced by the builder. |
| `alignment`     | `left` / `center` / `right` — applied via the `data-align` attribute.        |

The **template** (`html` + `css` + `fields`) is what the model created. It
is rendered inside an iframe so its CSS is fully isolated.

The **canvas** is the editor's own coordinate space. It stores plain JSON
elements that float on top of the iframe and are positioned in
percentages of the banner's dimensions.

## The single design size

The editor, the `BannerPreview` component, and every export (PNG, JPG,
PDF, HTML, SVG) share one logical canvas size returned by
`exportRenderSize(aspect)` — for `16:9` that's **900×506 px**. Because the
iframe always lays out at this size and is *visually* scaled with a CSS
transform, viewport-relative units inside the template (`vw`, `clamp`,
`%`) resolve to the same value at every zoom level. That's why text
no longer jumps around when you zoom.

```
┌───────────────────────────────────────────────────┐
│ editor canvas at zoom 0.5                          │
│ ┌─────────────────────────────┐                    │
│ │ outer wrapper: 450×253 px    │ ← real screen px  │
│ │ ┌─────────────────────────┐ │                    │
│ │ │ inner: 900×506 px         │ │ ← logical px       │
│ │ │ transform: scale(0.5)     │ │   (iframe lives    │
│ │ │ ┌─────────────────────┐ │ │    here, never      │
│ │ │ │ iframe srcDoc        │ │ │    resizes)         │
│ │ │ └─────────────────────┘ │ │                    │
│ │ └─────────────────────────┘ │                    │
│ └─────────────────────────────┘                    │
└───────────────────────────────────────────────────┘
```

## How template slots become layers

The AI template peppers the markup with `data-slot="…"` attributes on
every editable text node — for example:

```html
<h1 class="banner__headline" data-slot="headline">…</h1>
<span data-slot="eyebrow">…</span>
<button data-slot="cta_primary">…</button>
```

When a banner is opened in the builder for the first time and the saved
canvas is empty, the iframe is rendered, and on its `load` event the
page calls `extractEditableComponentsFromDocument()` (see
[src/lib/bannerDownload.js](../src/lib/bannerDownload.js)). That helper
walks every `[data-slot]` node, reads its `getBoundingClientRect()` and
computed styles, and emits a canvas element per slot:

```js
{
  id: "template:headline",   // prefixed → recognizable as hydrated
  type: "text",              // or "button" for cta_*
  slot: "headline",          // back-pointer to the original slot
  x, y, w, h,                // % of the banner (left, top, width, height)
  rotation: 0,
  content: "Where Elegance Meets Tradition",
  style: {                   // computed from the iframe document
    color, fontFamily, fontSize, fontWeight,
    textAlign, lineHeight, letterSpacing,
    background, borderRadius, // for buttons
  },
}
```

Those elements are stored in `elements[]` and rendered by the React
`ElementRenderer` on top of the iframe. They show up in the **Layers**
panel with a small **T** badge so you can tell them apart from elements
you added yourself.

To avoid double-rendering the same headline (once inside the iframe and
once in the canvas overlay), the builder passes a `hiddenSlots` list to
`buildStandaloneHtml`. The slots that became canvas elements are hidden
in the iframe via:

```css
[data-slot="headline"] { visibility: hidden !important; }
```

Decorative chrome around the slot — chips, stars, gradients, orbs — is
*not* hidden, so it stays visible.

## How new elements are added

The **Elements** tab in the left panel exposes a small palette: heading,
subheading, body text, rectangle / circle / line shapes, primary /
outline buttons, and image upload. Each preset declares a `defaults`
object with `w`, `h`, and `style`. Adding one calls `addElement(type,
defaults)` in [src/app/dashboard/builder/[id]/page.js](../src/app/dashboard/builder/[id]/page.js):

```js
const el = {
  id: uid(),                      // 8-char random id (no "template:" prefix)
  type,                           // "text" | "rect" | "button" | "image" | "divider"
  x: 10 + Math.random() * 30,     // dropped roughly into the canvas
  y: 10 + Math.random() * 30,
  rotation: 0,
  ...defaultsFor(type, overrides),
};
setElements((prev) => [...prev, el]);
```

The element is appended to `elements[]`, which is the source of truth
for both the Layers panel and the on-canvas rendering.

## How edits flow

### Selection, drag, resize, rotate
All wired up through `ElementRenderer`. Mouse deltas are in **screen
px**; we divide by `zoom` and the canvas dimension to convert to a
percentage delta on the logical canvas:

```js
const canvasDeltaX = (clientDeltaX / zoom / canvasW) * 100;
```

The selection ring and 8 resize handles are counter-scaled by `1/zoom`
so they stay at constant on-screen size at any zoom level.

### Inline text editing
Double-click a text or button element to switch it to a `<textarea>`.
The element stays the same; only its `content` changes. Esc commits
and exits edit mode.

### Properties panel (right)
Selecting an element exposes its position/size/rotation, font,
fill/border, image, divider, or effects sections — depending on the
element type. Every change goes through `onChange` which records an
undo entry then updates `elements[]`.

### Fields panel (right)
The **Fields** tab edits the *template's* color / range / image fields
(things like `--accent`, `--bg-zoom`). Those values are written into
`fields[]` and the iframe re-renders with the new CSS variables — they
affect the iframe content only, not the canvas overlay.

## Persistence

`Save` (⌘S) calls `updateBanner()` with:

```js
{
  canvas:    { background, elements },
  fields,
  alignment,
  html, css,
}
```

So the canvas overlay, every field value, and the original template
HTML/CSS are written back to the same Supabase row. On reload:

- If `canvas.elements` already has hydrated entries (`id`s starting with
  `template:`), the iframe hides those same slots immediately — no
  re-hydration runs.
- If `canvas.elements` is empty, the iframe loads, the slot hydrator
  walks `[data-slot]` nodes again, and the canvas is populated.
- If `canvas.elements` only has user-added entries (no `template:`
  prefix), nothing is hydrated — the user explicitly chose what to keep.

## Cross-context consistency

| Context                              | What it renders                                                |
| ------------------------------------ | -------------------------------------------------------------- |
| `dashboard/builder/[id]` (this file) | iframe + ElementRenderer overlays.                            |
| `dashboard/banners/[id]` (`BannerPreview`) | iframe with elements baked in via `renderCanvasElementMarkup`. |
| Export PNG / JPG / PDF               | Same iframe, rasterized via `html-to-image`.                  |
| Export HTML                          | Same iframe markup, served standalone.                        |
| Export SVG                           | Same markup, embedded in `<foreignObject>`.                   |

All five paths use:

1. **The same logical size** — `exportRenderSize(aspect)`.
2. **The same composing function** — `buildCompositeStandaloneHtml()`.
3. **The same element markup** — `renderCanvasElementMarkup()`, which
   mirrors `ElementRenderer.jsx` style-for-style.

That's why what you see in the editor is what gets saved, previewed,
and downloaded — pixel for pixel.

## Keyboard / mouse cheat sheet

| Action                     | Input                                  |
| -------------------------- | -------------------------------------- |
| Pan canvas                 | Two-finger trackpad scroll             |
| Pan canvas                 | Hold **Space** + drag                  |
| Pan canvas                 | Alt/Option + drag                      |
| Pan canvas                 | Middle-mouse drag                      |
| Zoom in/out (cursor-anchored) | ⌘/Ctrl + scroll                     |
| Zoom 100% / fit-to-screen  | Toolbar buttons                        |
| Select element             | Click                                  |
| Edit text inline           | Double-click a text / button element   |
| Nudge selected element     | Arrow keys (Shift = larger step)       |
| Duplicate                  | ⌘D / Ctrl-D                            |
| Delete selected            | Backspace / Delete                     |
| Undo / Redo                | ⌘Z / ⌘⇧Z                               |
| Save                       | ⌘S                                     |
| Deselect                   | Esc, or click empty canvas             |

Horizontal trackpad swipes that would normally trigger
back/forward browser navigation are suppressed inside the canvas via
`overscroll-behavior: contain` and `touch-action: none`, so panning
works without leaving the page.
