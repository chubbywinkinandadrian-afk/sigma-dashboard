# MEMORY — session handoff (2026-06-10)

Read this first. It is the handoff from the previous Claude Code session. The user
restarted chat due to WebSocket errors; continue from here, do not re-litigate decisions.

## The goal

Make ~$5K by **June 22, 2026** (amount may fluctuate; must be sustainable monthly after),
under hard constraints from the user:

- **No sales motion of any kind**: no calls, no emails, no lead management, no high-touch funnels
- **No customer service**, no community management, no moderation
- **No physical shipping, no custom/customization services, no freelancing/consulting**
- **No maintenance-heavy software**
- User starts with **zero audience and zero credibility** (they explicitly said to ignore
  the existing sigma-dashboard/week_ahead.json macro-brief project — a paid-commentary
  product was considered and rejected because commentary is a trust good and incumbents
  like Unusual Whales own that game)

## The strategy (decided)

1. Sell **inspection goods, not judgment goods** — products a buyer fully evaluates before
   paying (before/after demo, free preview). This neutralizes the zero-credibility problem.
2. **Borrow trust + payments from platforms** (Lemon Squeezy handles checkout/receipts/refunds)
   so there is genuinely no customer-service surface.
3. **Distribution = algorithmic short-form feeds** (TikTok/Reels/Shorts/X), 2–3 clips/day.
   They distribute per-video, not per-follower — the only channel where a nobody gets reach.
   ~30 clips × 4 platforms in the window = many independent lottery tickets.
4. Economics: $5K ≈ 350 sales at $14 avg. One semi-viral clip (500K views, 1% CTR, 5% conv)
   ≈ 250 sales. Median honest outcome: hundreds to ~$2K in-window, compounding after.

### The three concepts (ranked)

1. **CHOSEN — "Heirloom": one-click old photo restoration** ($9/photo, $19/five). Most
   reliable before/after content genre, faceless (no charisma needed), sentimental buyers
   who pay for one-click convenience, infinite free demo material in public-domain archives.
2. Fallback (day-7 reskin if no traction): **kid's drawing → real illustration** (parents
   share relentlessly; June = end of school year).
3. **Wedding speech generator** (June = wedding season; highest urgency, weakest share loop).

## What is built (this session)

`heirloom/` — complete working skeleton, **demo flow verified end-to-end** on 2026-06-10:

- Zero-framework Node 18+ server (`server.mjs`), vanilla JS front end, one dep (`jimp`)
- Flow: upload → restore → **480px watermarked preview** (the paywall) → unlock → full-res
  download. Full-res never reaches the browser before unlock (HMAC keys, verified 403 first)
- Jobs auto-delete after 60 min (privacy = marketing copy on the page)
- Providers: `demo` (local jimp enhance — works now) and `replicate` (FLUX Kontext
  restoration app, **code written but NOT tested with a live token**)
- Payments: Lemon Squeezy license activation (single = activation limit 1, pack = 5),
  **NOT yet tested against a real store**; with no checkout env vars it allows a free demo unlock
- Landing page: warm archival design, hero before/after slider, pricing, FAQ
- `npm run samples` generates a placeholder before/after pair (painted cottage scene,
  degraded vs clean) — **must be replaced with a real public-domain restoration pair before launch**
- See `heirloom/README.md` for env vars, Lemon Squeezy setup, deploy notes (Render/Railway/
  Fly/VPS; NOT Vercel-serverless without swapping `lib/store.mjs`), and the pre-launch checklist

Run it: `cd heirloom && npm install && npm run samples && npm start` → localhost:3000

## State / next steps (in order)

1. **Screenshots for the user** — they asked to "see how it is". Playwright/Chromium
   install FAILED in the old session's container (likely network policy or missing system
   deps — check). Alternative: user runs it locally, or try `npx playwright install chromium`
   again / system chromium via apt.
2. Replace placeholder samples with a real PD photo pair (run one through the real provider)
3. Replicate: set token, verify `REPLICATE_MODEL` (default `flux-kontext-apps/restore-image`)
   still exists/is best, test on 5–10 damaged photos
4. Lemon Squeezy: create store + 2 products, set checkout env vars, one real test purchase
5. Deploy (Render/Railway), domain, HTTPS
6. Content engine: 2–3 before/after clips/day from PD archive photos; day-7 traction gate →
   if dead, reskin same skeleton to concept 2 (kid's drawings)

## Repo facts

- Branch: `claude/sweet-fermi-e5uh9v` (work committed + pushed there)
- `week_ahead.json` at repo root is the user's separate macro-brief project — leave it alone
- Do not create a PR unless the user asks
