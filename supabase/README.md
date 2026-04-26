# Supabase

Database schema, migrations, and operational notes for Nanogen.

## Migrations

Numbered SQL files under [migrations/](migrations/). Apply in order.

| File | Purpose |
| --- | --- |
| `0001_initial_schema.sql` | profiles, generations, banners, RLS, triggers |
| `0002_banners_profiles_fk.sql` | re-points user_id FKs to profiles so admin embeds work |

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
4. (Optional) Enable Google / GitHub OAuth: **Authentication → Providers**,
   add the OAuth client ID/secret, and add `<your-site>/auth/callback` to the
   "Redirect URLs" allowlist.
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
