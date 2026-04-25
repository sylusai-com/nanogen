# Nanogen

AI-powered banner generation platform. Describe a banner, run multiple image
models in parallel, score every output, and surface the best one.

This repo currently implements **Phase 1 (MVP)**:

- Prompt-based generation UI (text + optional reference image)
- Multi-model fan-out (configurable in `src/lib/models.js`)
- Automated scoring with a configurable quality threshold (default 80)
- Modern dark-first interface with light/dark toggle
- API route stubs ready for real provider integration

## Tech stack

- Next.js (App Router) + JSX
- Tailwind CSS v4
- Supabase (Postgres) — client placeholder in `src/lib/supabase.js`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys as you wire providers
npm run dev
```

Open <http://localhost:3000>.

## Project layout

```
src/
  app/
    layout.js              # Root layout, theme bootstrap, Navbar/Footer
    page.js                # Landing page
    generate/page.js       # Generation studio
    api/
      generate/route.js    # Multi-model fan-out + scoring (stub)
      score/route.js       # Standalone scoring endpoint (stub)
  components/              # UI components (JSX)
  lib/
    models.js              # Model catalog, aspect ratios, score threshold
    supabase.js            # Supabase client placeholder
```

## Wiring real providers

Replace `runModel` and `scoreImage` in
[src/app/api/generate/route.js](src/app/api/generate/route.js) with calls to
your provider of choice (Replicate, Fal, Stability, OpenAI Images, Imagen,
etc.) and a vision-based quality evaluator. Each model returned needs:

```js
{
  id, modelId, modelLabel, provider,
  imageUrl,            // hosted URL or data: URL
  prompt, aspect, style,
  score,               // 0-100, attached after scoring
}
```

## Roadmap

- **Phase 2** — HTML banner generation, basic editor, admin dashboard
- **Phase 3** — Drag-and-drop builder, performance & scaling
