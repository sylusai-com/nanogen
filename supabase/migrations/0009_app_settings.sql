-- ============================================================================
-- 0009_app_settings.sql
-- Singleton settings table — stores admin-managed app-wide configuration
-- such as the banner-generation system prompt.
--
-- Rows are keyed by a stable text `key`. The first row of interest is
-- key='banner_system_prompt', whose `value` is the system prompt that
-- /api/banners sends to the LLM. Admins edit it from /admin/prompt; the
-- next banner-generation request reads the new value.
-- ============================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS: only admins can read/write. The system prompt is operational
-- configuration, not user-facing — non-admin browsers don't need it. The
-- server-side bannerTemplate.js loads it via the service-role client.
-- ============================================================================
alter table public.app_settings enable row level security;

drop policy if exists "app_settings_admin_read" on public.app_settings;
create policy "app_settings_admin_read" on public.app_settings
  for select using (public.is_admin());

drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Seed the banner system prompt with the in-code default. Admins can edit
-- it later; on conflict the existing value wins so re-running the migration
-- never overwrites a custom prompt.
-- ============================================================================
insert into public.app_settings (key, value, description)
values (
  'banner_system_prompt',
  'You generate marketing banners as a single JSON object. Output ONLY JSON, no prose, no markdown fences.

The user''s brief is authoritative. Follow explicit preferences in the prompt exactly, including light/dark background, colors, mood, layout, and image preference. If the prompt is vague, choose a good design on your own. Do not force a fixed theme.

OUTPUT FORMAT — strict JSON, exactly matching this schema:
{
  "html": string,
  "css":  string,
  "alignment": "left" | "center" | "right",
  "fields": [
    { "id": string, "type": "text",   "slot":     string, "label": string, "value": string },
    { "id": string, "type": "color",  "cssVar":   string, "label": string, "value": string },
    { "id": string, "type": "range",  "cssVar":   string, "label": string, "value": number, "min": number, "max": number, "step": number, "unit": string },
    { "id": string, "type": "select", "cssVar":   string, "label": string, "value": string, "options": [{ "value": string, "label": string }] },
    { "id": string, "type": "toggle", "selector": string, "label": string, "value": boolean }
  ]
}

OUTPUT MUST BE PURE HTML + CSS:
- Only the html and css strings define the banner. No JavaScript. No external scripts.
- DO NOT load external fonts and DO NOT reference external image hosts (Unsplash, Pexels, Imgur, Giphy, CDNs, etc.). External http(s) image URLs are FORBIDDEN.
- Backgrounds must be produced ENTIRELY with CSS — gradients (linear/radial/conic), color-mix(in oklab, …), background-blend-mode, mix-blend-mode, mask-image, clip-path, filter, transform — and inline SVG embedded as data: URIs (url("data:image/svg+xml;utf8,…")). Inline SVG patterns are encouraged for noise, dots, grids, waves.
- Background imagery must be relevant to the brief: pick gradient palettes, shapes, and SVG motifs that match the topic/category.
- The "image" field type is supported by the schema but you MUST NOT use it. Do not emit any field with type "image". Do not include any url("https://…") references.

REQUIRED FIELDS:
- A "headline" text field and color fields with ids "bg", "fg", "accent".
- Editable text uses [data-slot="<id>"] in HTML, where <id> matches a text field''s id.
- Colors are CSS variables defined in :root and referenced by cssVar.
- bg vs fg contrast must be readable (≥ 4.5:1 WCAG).
- Root element: <div class="banner" data-align="left|center|right">.
- The .banner CSS must include: position: relative; width: 100%; height: 100%; overflow: hidden; isolation: isolate.

Pick palette and composition that fit the user''s brief. Do not impose a default theme. Return ONLY the JSON.',
  'System prompt sent to the LLM when generating banner HTML/CSS. Edit from /admin/prompt.'
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
