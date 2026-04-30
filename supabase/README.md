# Supabase

Database schema, migrations, and operational notes for Nanogen.

## Migrations

Numbered SQL files under [migrations/](migrations/). Apply in order.

| File | Purpose |
| --- | --- |
| `0001_initial_schema.sql` | profiles, generations, banners, RLS, triggers |
| `0002_banners_profiles_fk.sql` | re-points user_id FKs to profiles so admin embeds work |
| `0003_models.sql` | DB-driven model registry (image + text) + admin CRUD policies |
| `0004_canvas_and_catalog.sql` | adds `canvas` jsonb to banners; moves aspect ratios + styles into admin-managed tables |

When you add a new schema change, create the next file as `0002_<name>.sql`,
`0003_<name>.sql`, etc. Each file should be **append-only** — never edit a
migration that has already been applied.

### Applying a migration

**Option A — Supabase Dashboard (quick path)**

1. Open your project → **SQL editor** → **New query**
2. Paste the contents of the migration file
3. Run

**Option B — Supabase CLI (preferred for teams)**

```bash
# one-time setup
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>

# apply all migrations
supabase db push
```

The CLI tracks which migrations have been applied; re-running `db push` is
idempotent.

## First-time project setup

1. Create a Supabase project — copy the URL and keys into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
2. Apply `0001_initial_schema.sql` (option A or B above).
3. (Optional) Disable email confirmation while developing:
   **Authentication → Providers → Email** → turn off "Confirm email".
   With it on, users can't log in until they click the email link.
4. (Optional) Enable Google / GitHub OAuth — see [Google OAuth setup](#google-oauth-setup) below.
5. (Optional) Create a public storage bucket named `banners` if you'll upload
   reference images or store generated banner files.

## Creating an admin account

Admins aren't created from the sign-up form — that's intentional. Pick one of
these approaches:

### Approach 1 — pre-allowlist by email (recommended)

Insert your email into `admin_emails` **before** signing up. The
`handle_new_user` trigger reads this table when creating the profile and sets
the role automatically.

```sql
insert into public.admin_emails (email) values ('you@example.com');
```

Then sign up with that email at `/signup`. Your profile is created with
`role = 'admin'` and you'll be redirected to `/admin` after login.

## Google OAuth setup

The app already has the client-side wiring (`SocialAuth` button →
`signInWithOAuth("google")` → Supabase → `/auth/callback`). What you need
to do is configure the provider on both sides.

### 1. Create a Google OAuth client

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application**.
3. **Authorised JavaScript origins**: add the URLs the user starts the
   sign-in from. For local dev: `http://localhost:3000`. For prod: your
   public site URL.
4. **Authorised redirect URIs**: paste your Supabase project's auth callback
   URL — `https://<project-ref>.supabase.co/auth/v1/callback`. (You can
   find the exact URL in Supabase under Authentication → Providers → Google.)
5. Save and copy the **Client ID** and **Client secret**.

### 2. Configure Supabase

1. **Authentication → Providers → Google → Enable**.
2. Paste the Client ID and Client secret from the previous step.
3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (dev) or your prod URL.
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
     `https://<your-prod-domain>/auth/callback`. Wildcards (e.g.
     `https://*.vercel.app/auth/callback`) work for preview deploys.

### 3. Apply migration `0008_oauth_profile_metadata.sql`

The default `handle_new_user` trigger only saved `name`. Migration 0008
extends it to also capture the user's Google avatar URL so the dashboard
avatar shows their Google photo. Apply it the same way as any other
migration (Dashboard SQL editor or `supabase db push`).

### 4. Test the flow

1. Open `/login`, click **Google**.
2. You should be sent to Google's consent screen, then back to
   `<your-site>/auth/callback?code=…`, and finally to `/dashboard` (or
   `/admin` if your email is in `admin_emails`).
3. Errors during the round-trip surface on `/login` via `?error=…`.
4. Existing email/password users with the same Gmail address are
   automatically linked by Supabase (provided email confirmation was on);
   they end up with one `auth.users` row that has both a password and a
   Google identity.
