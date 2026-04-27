# Auth setup (Supabase) – Login + Forgot Password (SMTP)

## Required environment variables

Create `apps/web/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required only if you want login by User ID, i.e. resolve `ACM-M-001` → email)

Restart `npm run dev` after changing env vars.

## Supabase Auth settings

In Supabase Dashboard → **Authentication**:

1. **URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs (allow list):
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/reset-password`

2. **Email (SMTP)**
   - Configure SMTP so password reset emails deliver from your domain.
   - The app uses `resetPasswordForEmail()` which sends the email through Supabase.

## Local dev

Run:

`npm run dev`

Login pages:
- `/login/owner`
- `/login/manager`
- `/login/employee`

Forgot password:
- From the login screen, click “Forgot password?” → sends reset email.
- The email link lands on `/auth/callback` then redirects to `/reset-password`.
