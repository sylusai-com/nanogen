# Banner Generation Flow

## 1. When the user clicks Generate Banner
- The UI sends `POST /api/banners` with the prompt, style, aspect, selected model, reference image, and subject image.
- If the model picker is set to Auto, the server runs every enabled text model that has an API key.
- If a specific model is selected, only that model is used.

## 2. How images are handled
- The reference image is inspiration only.
- The server analyzes the reference image and the subject image in parallel.
- Both image analyses use the same admin-configured default text model with secrets.
- Reference output becomes design guidance like mood, palette, and composition.
- Subject output becomes placement and treatment guidance for the hero image.

### 2a. How images are sent to text models
- The server converts images to data URIs (base64 encoded `data:image/...` strings).
- The image is sent via OpenRouter API using the multimodal message format:
  ```
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this image..." },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ]
  ```
- The text model (Claude, GPT, etc.) receives the image as a vision/multimodal input.
- The model returns structured JSON with extracted properties: placement, treatment, dominant colors, etc.
- This happens in `extractReferenceImageContext()` and `extractSubjectImageContext()` helper functions.

## 3. How the banner is generated
- The server builds one prompt per model variant with the brief plus the extracted reference/subject context.
- `generateBannerTemplate()` returns the HTML, CSS, and fields for the banner.
- The subject image is treated as the banner hero and is written into the `bg_image` field at render time.
- If no subject image is provided, the server may generate a fallback background image.

## 4. What gets stored
- The banner row stores `html`, `css`, `fields`, `alignment`, and the canvas state.
- Canvas state stores the builder elements and background used in the editor.
- The subject image is stored separately in `subject_image_url`.

## 5. How the banner is shown later (with subject image rendering)
- `BannerPreview` and the export helpers normalize `subject_image_url` back into `bg_image` at render time.
- That keeps the dashboard detail page, the edit page, the builder, and downloads consistent.
- **Subject image rendering flow:**
  - `BannerPreview.jsx` receives `banner.subjectImageUrl` and passes it to `buildCompositeStandaloneHtml()`
  - `EditorPreview.jsx` (used in `/dashboard/banners/[id]/edit`) receives `subjectImageUrl` prop from the banner and passes it to `BannerPreview`
  - `Canvas.jsx` (used in `/dashboard/builder/[id]`) receives `subjectImageUrl` prop and passes it to `buildStandaloneHtml()` for the iframe render
  - `normalizeRenderFields()` function in `bannerDownload.js` injects the base64 data URI into the `bg_image` field if present
  - The subject image displays identically across: dashboard thumbnails → detail preview → editor preview → builder canvas → all downloads
- The reference image is still shown only in the side panel and is never embedded in the banner.

## 6. The Builder: Adding and storing HTML/CSS elements
- From `/dashboard/builder/[id]`, users can add custom elements (text, rectangles, buttons, images, dividers) on top of the AI-generated banner.
- Each element is stored in the `canvas.elements` array with type, position (x%, y%), size (w%, h%), styling, and content.
- Elements are positioned absolutely (% units) so they scale with the banner aspect ratio.

### 6a. How elements are added
- The Canvas UI provides tools to add/delete/reorder/resize elements.
- Each element type renders differently:
  - `text`: renders as a `<div>` with font-size, font-weight, color, text-align, line-height
  - `rect`: renders as a `<div>` with background, border-radius, opacity
  - `button`: renders as a `<div>` with background, color, border-radius, font-size, font-weight
  - `image`: renders as an `<img>` inside a container with border-radius
  - `divider`: renders as a `<div>` with height, background, border-radius
- Users can edit styling via the properties panel.
- The element is added to the undo/redo stack on each change.

### 6b. What gets stored in the banner row
- When saved, the entire `canvas` object is stored: `{ background: "#...", elements: [...] }`
- The `elements` array is serialized as JSON in the `canvas` column.
- The banner's `html` and `css` are NOT rewritten — they stay as the AI-generated template.

### 6c. How elements are rendered and viewed
- In the builder, the canvas displays in an iframe with the banner template + subject image, then canvas elements render as an overlay.
- Canvas renders in stages:
  1. **Banner base layer:** `<iframe>` renders the AI-generated HTML/CSS template with the subject image normalized into the `bg_image` field
  2. **Elements overlay:** Canvas elements layer on top at z-index 5
- When exported or viewed on the dashboard, the elements are rendered as additional HTML markup with z-index layering.
- `renderCanvasElementsMarkup()` converts each element to HTML with inline styles.
- All canvas elements render at z-index 5, sitting above the template (z-index -1, -2).
- The export process merges the template HTML + CSS + subject image + canvas element markup so downloads include all layers.