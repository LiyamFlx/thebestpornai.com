# Third-Party Review Roadmap — Design

Source: agreed third-party review feedback on `thebestpornai.com` (2026-07-04).
Goal: turn that feedback into a phased, executable roadmap covering everything
agreed — code, design, legal/compliance, and growth — in the order that
protects the business first, then improves it.

Note on scope: the review's "weaknesses" (Start.command tip, "Enter StreamHub"
dead-feeling nav, dev-dashboard look) describe `choose.html`, the old
persona-picker page — not the current homepage, which is already the video
viewer app since the recent restructure. `choose.html` is still public
(linked from the viewer sidebar as "Creator / Manager"), so its issues are
still real, just lower-stakes than "this is our front door."

## Phases

### Phase 1 — Compliance-critical (code, buildable now)
**Why first:** zero age verification on a live adult site is the single
highest legal-exposure gap. Everything else is optimization; this is risk.

- Add an 18+ age-gate interstitial in front of the viewer app (and
  `choose.html`) — a full-screen confirmation ("I am 18+ / Exit") that must
  be accepted before any content loads, persisted via localStorage/cookie so
  it doesn't re-prompt every visit.
- Add a basic legal footer: Terms of Service, Privacy Policy, DMCA policy,
  2257 statement links (pages can start as simple static text; content itself
  is a legal-review task, not something I draft as binding legal language).
- HTTPS is already in place (Bunny Pull Zone) — confirm and document.

**Not in this phase (business/legal, not code):** actually retaining a lawyer
to draft 2257/DMCA policy text, forming an LLC, or signing with a paid age
verification vendor (e.g. AgeChecker.net) — those are your calls to make;
Phase 1 ships the *mechanism* (gate + policy page slots) so it's ready the
moment you have real policy text and, if you choose, a real verification
vendor to plug in.

### Phase 2 — Quick fixes (code, small, fast)
- Remove/relocate the `Start.command` / `Start.bat` local-dev tip from
  `choose.html` (it's fine in `CLAUDE.md` for developers, not on a public page).
- Add proper `<meta name="description">`, Open Graph tags (`og:title`,
  `og:image`, `og:description`), and a real favicon (replace the placeholder
  SVG) across `index.html`, `choose.html`, `viewer/index.html`.
- Audit every nav link on `choose.html` and the viewer sidebar for dead links
  or `localhost` references baked into copy.
- SEO title/description pass targeting the keywords the review named
  ("AI generated porn videos", "StreamHub AI", etc.) — copy only, no backend
  changes.

### Phase 3 — Visual redesign (design + code, larger)
- Dark/seductive theme pass: this needs its own brainstorming session once
  Phases 1–2 ship, because "cinematic hero visuals," "AI character imagery,"
  and "card-based mockup layout" are genuine design decisions (asset sourcing,
  brand identity) that deserve dedicated design time, not a bullet point here.
- Scope for that follow-up session: hero treatment for `choose.html` (or
  retire it if the viewer-first homepage makes the picker unnecessary),
  visual identity system (colors/type/imagery), mobile responsiveness audit.

### Phase 4 — Legal & compliance setup (not code — your workstream)
LLC formation, DMCA agent registration, 2257 record-keeping process, and a
paid age-verification vendor integration (if you choose one) all require
legal/business decisions I can't make or execute. I can implement whatever
policy text and integration you bring back from that work (Phase 1 leaves
the slots ready for it).

### Phase 5 — Growth & monetization (not code — your workstream)
Traffic strategy (Reddit/X/forums, Instagram funnel), subscription/PPV/token
monetization model, and paid ad accounts on adult-friendly networks are
business decisions and external account setup, not something built into this
codebase directly — though once a monetization model is chosen, the actual
payment/subscription *code* would become its own Phase 6 spec.

## What I'm asking you to confirm

1. Phase 1 (age gate) is next up for a real implementation plan — is that
   the right immediate priority given "everything, in order"?
2. For the age gate: simple self-certification click-through (no ID upload,
   just "I am 18+"), or do you already have a specific verification vendor in
   mind that Phase 1 should integrate against instead of building a placeholder?
