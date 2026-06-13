# Nanozen

**AI-powered banner generation and editing platform.** Generate production-ready marketing banners with AI, edit them visually, customize with a drag-and-drop builder, and manage your entire catalog via an admin dashboard.

Nanozen automates the banner workflow: describe your banner → AI generates HTML/CSS → edit styling and content → publish. All banners are scored for quality, stored in a Postgres database, and support version history and regeneration workflows.

## ✨ Features

### User Workflows
- **Banner Generation** — Describe a banner, choose a text model (or auto-select), get instant HTML/CSS output with quality scoring
- **Banner Editing** — Refine text, colors, alignment, image placement in a live preview editor
- **Banner Builder** — Drag-and-drop visual builder to add custom elements (text, shapes, buttons, images) on top of AI-generated banners
- **Download & Export** — Export as HTML, PNG, JPEG, PDF, or SVG with all custom elements preserved

### Admin Features
- **Model Management** — Register and manage AI providers (OpenRouter, OpenAI-compatible endpoints, etc.)
- **Connection Diagnostics** — Test database, model, and provider connectivity from one admin screen
- **Aspect Ratio Catalog** — Define reusable banner dimensions (16:9, 4:3, 1:1, custom)
- **Style Templates** — Manage predefined banner styles and visual guidelines
- **User & Output Management** — View user activity, monitor all generated banners, track scores and performance
- **Scoring Dashboard** — Real-time metrics on model performance, generation success rates, quality distribution

### Architecture
- **Multi-model fan-out** — Run multiple text or image models in parallel with automatic scoring
- **Quality threshold** — Auto-threshold at score ≥ 80, fallback to top candidate if needed
- **Reference + Subject images** — Inspiration images + hero images, both analyzed by vision models for context injection
- **Sequential generation flow** — Validate images, analyze context, find background images, fan out models in parallel, then score and save
- **Version control** — Track banner history and regenerate from previous versions
- **Role-based access** — Admin dashboard restricted to administrators; public generation for all users

## Tech Stack

| Layer            | Tech                                         |
| ---------------- | -------------------------------------------- |
| **Framework**     | Next.js 16 (App Router, React 19)            |
| **UI/Styling**   | Tailwind CSS v4, Lucide icons, Motion        |
| **Database**     | Supabase (Postgres + RLS + Auth)             |
| **Export**       | html-to-image (PNG/JPEG/PDF rasterization)   |
| **Charts**       | Recharts (admin dashboard)                   |
| **AI Providers** | OpenRouter, OpenAI-compatible endpoints      |
| **Build**        | ESLint, PostCSS, Next.js built-in compiler   |

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- OpenRouter API key (or your preferred AI provider)

### Installation

```bash
# Clone and install dependencies
git clone https://github.com/sylus-ai/nanozen.git
cd nanozen
npm install

# Set up environment variables
cp .env.example .env.local

# Fill in your credentials:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - Any AI provider keys (OpenRouter, OpenAI, etc.)
```

### Database Setup

```bash
# Navigate to supabase folder
cd supabase

# Apply migrations to your Supabase instance
# (Instructions in supabase/README.md)

# Then return and run dev server
cd ..
npm run dev
```

Open **<http://localhost:3000>** to see the landing page.

## Project Structure

```
nanozen/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth pages (login, signup)
│   │   ├── (marketing)/              # Public pages (landing, generate)
│   │   ├── admin/                    # Admin dashboard (restricted)
│   │   ├── dashboard/                # User dashboard (banners, create, builder, editor)
│   │   ├── api/                      # API routes
│   │   │   ├── banners/              # Banner CRUD, download export
│   │   │   ├── admin/                # Admin endpoints (models, styles, aspects)
│   │   │   ├── generate/             # Text model generation + scoring
│   │   │   └── score/                # Vision-based scoring endpoint
│   │   └── layout.js                 # Root layout, auth/theme providers
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # Reusable UI primitives (Button, Card, Input, etc.)
│   │   ├── layout/                   # Layout components (Navbar, Sidebar, AuthProvider, ThemeProvider)
│   │   ├── dashboard/                # Dashboard UI (BannerFilters, BannerThumb, StatCard, TopBar)
│   │   ├── banner/                   # Banner display & controls (BannerPreview, DownloadMenu, ReferencePanel)
│   │   ├── builder/                  # Canvas builder (Canvas, Toolbar, LeftPanel, RightPanel, ElementRenderer)
│   │   ├── editor/                   # Field editors (EditorPanel, TextField, ColorField, ImageField, etc.)
│   │   ├── generate/                 # Generation flow (PromptForm, ResultsPanel, BannerCard, ModelSelector)
│   │   ├── admin/                    # Admin modals & forms (ModelFormModal, StyleFormModal, AspectFormModal)
│   │   ├── auth/                     # Auth components (AuthCard, SocialAuth)
│   │   └── landing/                  # Landing page sections (Hero, Features, Showcase, CTA)
│   │
│   ├── lib/                          # Utilities & helpers
│   │   ├── bannerDownload.js         # Export pipeline (PNG/JPEG/PDF/SVG/HTML rendering)
│   │   ├── bannerTemplate.js         # Template generation & field normalization
│   │   ├── scoreBanner.js            # Quality scoring logic
│   │   ├── referenceImage.js         # Reference image context extraction (vision model)
│   │   ├── imageGen.js               # Image generation (if using image models)
│   │   ├── imageUpload.js            # Image compression & validation
│   │   ├── cache.js                  # Request caching layer
│   │   ├── cn.js                     # Tailwind classname utility
│   │   ├── color.js                  # Color manipulation utilities
│   │   ├── models.js                 # Model catalog & constants
│   │   ├── prompts.js                # Prompt templates & system messages
│   │   ├── useApiCache.js            # React hook for cached API queries
│   │   ├── db/                       # Database helpers
│   │   │   ├── banners.js            # Banner CRUD operations
│   │   │   ├── models.js             # Model registry queries
│   │   │   ├── styles.js             # Style template queries
│   │   │   ├── aspects.js            # Aspect ratio queries
│   │   │   ├── admin.js              # User & analytics queries
│   │   │   └── settings.js           # App settings
│   │   ├── server/                   # Server-only utilities
│   │   │   └── security.js           # Request validation & auth checks
│   │   ├── supabase/                 # Supabase clients
│   │   │   ├── server.js             # Server-side Supabase client
│   │   │   ├── client.js             # Client-side Supabase client
│   │   │   └── admin.js              # Admin client with service role
│   │   └── banner-template/          # Template builders (CSS, markup)
│   │
│   └── proxy.js                      # Proxy configuration (placeholder)
│
├── supabase/
│   ├── migrations/                   # Database schema & RLS policies
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_banners_profiles_fk.sql
│   │   ├── 0003_models.sql
│   │   ├── 0004_canvas_and_catalog.sql
│   │   ├── 0005_banner_editor_columns.sql
│   │   ├── 0006_builder_and_admin_catalog.sql
│   │   ├── 0007_banners_run_id.sql
│   │   ├── 0008_oauth_profile_metadata.sql
│   │   ├── 0009_app_settings.sql
│   │   ├── 0010_banner_reference_image.sql
│   │   └── 0011_banner_subject_image.sql
│   └── README.md
│
├── docs/                             # Technical documentation
│   └── banner-generation-flow.md     # Complete flow diagrams & API details
│
├── public/                           # Static assets (logos, favicons)
├── package.json                      # Dependencies
├── next.config.mjs                   # Next.js config
├── postcss.config.mjs                # PostCSS config
├── eslint.config.mjs                 # ESLint config
├── jsconfig.json                     # Path aliases (@/ → src/)
├── .env.example                      # Environment template
└── PROJECT.md                        # Detailed project reference

```

## Core Workflows

### 1. Banner Generation (`/dashboard/create` or `/generate`)
1. User enters banner brief, selects style/aspect ratio and optionally uploads reference + subject images
2. Frontend sends `POST /api/banners` with prompt, images, and optional model selection; the endpoint returns a `jobId` immediately
3. Background job runs in this order:
   - Validate and store image metadata
   - Analyze reference and subject images in parallel
   - Find a background image from configured providers using the prompt and analysis context
   - Fan out across all enabled text models in parallel
   - Score every model result and pick the best one
   - Persist the banner, run record, and model variants
4. `/api/generation-status/[jobId]` is polled from `/dashboard/create` and `/dashboard/banners` so the user can see step-by-step progress
5. User lands in editor or banner detail view

### 2. Banner Editing (`/dashboard/banners/[id]/edit`)
1. User edits text fields, colors, alignment, image placement
2. Changes sync to the `fields` JSON array (styled field values)
3. Live preview updates in real-time
4. On save, `updateBanner()` persists fields, html, css, alignment

### 3. Builder Mode (`/dashboard/builder/[id]`)
1. User adds custom elements (text, shapes, buttons, images) via toolbar
2. Each element is positioned absolutely (% units) and styled via properties panel
3. Canvas state `{ background, elements: [...] }` is maintained in-memory
4. On save, `canvas` object is serialized to DB
5. On export/view, canvas elements are rendered as overlay on banner template

### 4. Downloading (`/dashboard/banners/[id]`)
1. User clicks download → `DownloadMenu` shows format options (HTML, PNG, JPEG, PDF, SVG)
2. For each format:
   - `buildCompositeStandaloneHtml()` merges banner HTML/CSS + canvas elements + subject image
   - `rasterize()` uses html-to-image to convert to PNG/JPEG
   - `rasterizeToPdf()` creates PDF with proper scaling
   - `buildSvgString()` creates SVG markup
3. File is downloaded with correct MIME type

## Database Schema (Summary)

### Key Tables
- **profiles** — User accounts (Supabase Auth linked)
- **banners** — Generated banners with html, css, fields (JSON), canvas (JSON), alignment, subject_image_url, reference_image_url
- **models** — AI provider registry (model_id, provider, endpoint, api_key_hint, enabled)
- **styles** — Banner style templates (css, demo_html, name, category)
- **aspects** — Banner aspect ratios (label, width, height, enabled)
- **app_settings** — App config (admin-managed)

See [supabase/README.md](supabase/README.md) for full schema + RLS policies.

## API Endpoints

### Banner Management
- `POST /api/banners` — Generate new banner
- `GET /api/banners` — List user's banners (paginated)
- `GET /api/banners/[id]` — Fetch banner details
- `PATCH /api/banners/[id]` — Update banner (fields, canvas, etc.)
- `DELETE /api/banners/[id]` — Delete banner
- `GET /api/banners/[id]/download/html|png|jpeg|pdf|svg` — Export banner

### Admin Only
- `POST /api/admin/models` — Register AI provider
- `PATCH /api/admin/models/[id]` — Update model settings
- `DELETE /api/admin/models/[id]` — Disable model
- `GET /api/admin/connections` — Read connection health summary
- `POST /api/admin/connections` — Run diagnostics against a model, background provider, or the full flow
- `POST /api/admin/styles` — Add style template
- `PATCH /api/admin/aspects` — Update aspect ratios

### Generation & Scoring
- `POST /api/generate` — Fan-out generate + score (image models)
- `POST /api/score` — Score a single banner or image
- `POST /api/banners/html` — Pure template generation (no scoring)

See [docs/banner-generation-flow.md](docs/banner-generation-flow.md) for the complete sequential workflow, progress states, and admin diagnostics coverage.

## Development Notes

### Adding a New AI Provider
1. Create a row in the `models` table with endpoint, api_key, enabled=true
2. The `callOpenRouter()` or provider-specific handler in `/api/banners` will use it
3. Models are loaded at generation time from the DB

### Customizing Banner Scoring
- Edit `scoreBannerTemplate()` in [src/lib/scoreBanner.js](src/lib/scoreBanner.js)
- Adjust `SCORE_THRESHOLD` in [src/lib/models.js](src/lib/models.js)
- Scoring system: 0-100 (higher = better quality)

### Extending the Builder
- Add new element type in `Canvas.jsx` (currently: text, rect, button, image, divider)
- Update `PropertiesPanel.jsx` to show type-specific editing controls
- Ensure `renderCanvasElementsMarkup()` in `bannerDownload.js` handles the new type on export

### Migrating Database Changes
- Create new migration file in `supabase/migrations/`
- Apply via Supabase dashboard or CLI
- Test against production data shapes

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (examples)
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...

# Optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For OAuth redirects
```

## Roadmap & Future Work

- **v2.0** — Performance optimizations, webhook support for long-running generations
- **v2.1** — Template library, brand kit management, collaboration features
- **v3.0** — Real-time collaboration, advanced analytics, multi-language support

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally with `npm run dev`
4. Build locally with `npm run build` to catch errors
5. Submit a pull request

## License

MIT

---

**For detailed technical information, see [PROJECT.md](PROJECT.md) and [docs/banner-generation-flow.md](docs/banner-generation-flow.md).**
