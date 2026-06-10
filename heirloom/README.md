# Heirloom

One-click restoration for old family photos. Upload a photo (or a phone snap of a print), get a free watermarked preview, pay $9/$19 to download full resolution. No accounts, no subscriptions, no customer service surface.

**Status: working skeleton.** The full flow (upload → restore → watermarked preview → paywall → unlock → download) runs end-to-end in demo mode. Before launch, complete the checklist at the bottom.

## Quickstart

```bash
npm install
npm run samples   # generates the landing-page before/after pair
npm start         # http://localhost:3000
```

With no environment variables set, the app runs in **demo mode**: restoration is a local enhancement (auto-levels/contrast/sharpen via jimp — it will not mend tears or colorize) and the paywall offers a free demo unlock so the whole flow can be tested.

## Architecture

Deliberately thin: a single Node `http` server (no framework), vanilla JS front end (no build step), one dependency (`jimp`).

```
server.mjs            HTTP server: static files + 4 API routes
lib/providers.mjs     restoration backends: demo (local) | replicate (AI)
lib/preview.mjs       480px watermarked previews (the paywall)
lib/store.mjs         job files on disk under .data/, TTL sweep
lib/license.mjs       HMAC unlock keys + Lemon Squeezy license activation
public/               landing page, app.js, sample pair
scripts/make-samples.mjs  placeholder sample generator
```

The paywall: full-resolution results never leave the server until `/api/unlock` issues an HMAC key. The browser only receives a 480px watermarked preview. All job files are deleted after `TTL_MINUTES` (default 60) — this is a privacy feature and the marketing copy says so.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | default 3000 |
| `REPLICATE_API_TOKEN` | setting it switches provider to `replicate` |
| `REPLICATE_MODEL` | default `flux-kontext-apps/restore-image` — verify the current best restoration model before launch |
| `REPLICATE_INPUT_KEY` | image input field name for the model, default `input_image` |
| `RESTORE_PROVIDER` | force `demo` or `replicate` |
| `LEMONSQUEEZY_CHECKOUT_URL_SINGLE` | checkout link for the $9 product |
| `LEMONSQUEEZY_CHECKOUT_URL_PACK` | checkout link for the $19 five-pack |
| `UNLOCK_SECRET` | HMAC secret; random per boot if unset (fine, jobs expire hourly) |
| `TTL_MINUTES` | job lifetime, default 60 |
| `MAX_UPLOAD_MB` | default 12 |

## Payments (Lemon Squeezy)

1. Create a store and two products: **One photo $9** (license keys ON, activation limit **1**) and **Five photos $19** (activation limit **5**).
2. Paste each product's checkout URL into the env vars above.
3. Done. The buyer pays, Lemon Squeezy emails them a license key, they paste it into the unlock box, the server redeems one activation via the public license API (`lib/license.mjs`). Lemon Squeezy handles receipts, VAT, refunds.

When the checkout env vars are unset, the unlock is free ("demo mode") — **do not deploy publicly like that.**

## Restoration provider (Replicate)

Set `REPLICATE_API_TOKEN`. The adapter calls `POST /v1/models/{model}/predictions` with `Prefer: wait`, downloads the output image, and re-encodes it. **Written but not yet exercised with a live token** — run one real job and eyeball quality before launch. Cost is cents per image; price is $9. If the default model has drifted, browse Replicate for current image-restoration / FLUX Kontext apps and set `REPLICATE_MODEL` + `REPLICATE_INPUT_KEY`.

## Deploying

Any host that runs a long-lived Node process with local disk: Render, Railway, Fly.io, or a small VPS. `node server.mjs` is the whole deal.

Vercel/serverless is **not** a fit as-is: jobs are files on local disk and lambdas don't share disks. If you ever want serverless, swap `lib/store.mjs` for Blob/S3 — it's the only file that touches storage.

## Pre-launch checklist

- [ ] Replace `public/sample-before.jpg` / `sample-after.jpg` with a real restoration pair (use a public-domain photo, e.g. Library of Congress, run through the real provider)
- [ ] Set up Replicate, verify model + output quality on 5–10 genuinely damaged photos
- [ ] Set up Lemon Squeezy products, do one real $9 test purchase end-to-end
- [ ] Domain + HTTPS (host-provided TLS is fine)
- [ ] Add a privacy page if required in your jurisdiction (the deletion policy is already stated on-page)
- [ ] Optional: analytics (a single Plausible/GoatCounter script tag — no cookies, no banner)
- [ ] Content engine: 2–3 before/after clips daily (TikTok/Reels/Shorts/X). The tool generates its own ad material from public-domain photos.
