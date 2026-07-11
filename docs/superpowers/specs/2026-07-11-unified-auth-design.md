# Unified Auth Rebuild (Password-Only) — Design

**Date:** 2026-07-11
**Status:** Awaiting owner approval

## Problem (observed, confirmed)

Three conflicting auth flows across the site:
- **viewer** Upload → email+password (`signInWithPassword`)
- **creator** → magic-link email ("Email me a sign-in link")
- **manager** → magic-link email (`renderModSignIn` → `sendMagicLink`)

Symptoms the owner hit:
1. Sign in on one app, another still asks → inconsistent *experience* (session
   is technically shared in localStorage, but the two login *methods* differ and
   the magic-link capture is unreliable).
2. Magic-link "asks again and again" → `captureSessionFromUrl()` races the SPA
   render/age-gate and drops the token (the code comments admit this race).
3. Wrong-password dead-end ("User already registered").

## Decision (owner-approved, refined)

**One auth system. Register once with username + password. Stay signed in until
you actively sign out. One identity for ALL services (viewer, creator, manager) —
no re-auth to upload or do any creator action.** No email/magic-link anywhere.

Refinements from owner:
- **Email + password** at registration (owner chose email over a username-lookup
  table for reliability). One credential, shown as "Email".
- **Never auto-expires.** Session persists indefinitely; token auto-refreshes in
  the background. Only `signOut()` ends it. (Removes the 1-hour `expires_at`
  logout that contributed to "asks again and again".)
- **One registration = one identity everywhere.** Signed in once → upload,
  creator studio, manager all recognize you with zero extra prompts.

## Design

### One session (unchanged storage, now the ONLY writer)
- `localStorage["sh_session"]` = `{access_token, refresh_token, expires_at(ms), user?}`.
- Same domain → viewer/creator/manager already read the same key. Sign in once → signed in everywhere.
- `ShAuth.session()` returns it if `expires_at > Date.now()`, else null. (Verified correct: stored and checked both in ms.)

### One sign-in UI (`renderAuthForm`) reused by all three apps
- Fields: email, password. Button: "Sign in / Create account".
- New email → `signup` (auto-creates + returns session; email confirmation is OFF — verified).
- Existing email + right password → `token?grant_type=password` → session.
- Existing email + wrong password → clear message "Wrong password for this account." (already fixed).
- Link: "Forgot password?" → `POST /recover` (sends reset email via Supabase). This is the ONLY email path, and only on explicit user action, so no delivery dependency for normal sign-in.

### Remove entirely
- `sendMagicLink()`, `captureSessionFromUrl()` and every call site (viewer line 11, creator ~1073, manager ~274). No URL-token capture → the render race disappears.
- Creator's `renderSignIn`/magic-link screen and manager's `renderModSignIn` magic-link → replaced with the shared password form.

### Per-app wiring
- **viewer**: `promptUploadSignIn` already password — keep, point at shared `renderAuthForm`.
- **creator**: on load, if `ShAuth.isSignedIn()` → show studio; else show shared password form. No magic-link, no re-prompt when already signed in.
- **manager**: same — shared password form; if signed in, show moderation console.

### Sign-out
- Single `ShAuth.signOut()` clears `sh_session`; a "Sign out" control in each app's header.

## Acceptance criteria
- [ ] Sign in on viewer Upload → go to /creator → NOT asked to sign in again.
- [ ] Sign in on /creator → go to /manager → NOT asked again.
- [ ] New email creates account + signs in in one step.
- [ ] Existing email + wrong password → "Wrong password" (not a dead-end).
- [ ] No magic-link UI anywhere; no `captureSessionFromUrl` calls remain.
- [ ] Refresh the page while signed in → still signed in (no re-prompt).
- [ ] Sign out → all three apps show signed-out.

## Explicitly NOT in scope
- Custom SMTP (only needed if magic-link were used; it isn't).
- Migrating to Supabase's hosted auth widget.
- The pre-existing `manifest.json` "sync error" badge (separate bug).
