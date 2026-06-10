import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { saveJob, loadPart, jobExists, sweepExpired, TTL_MINUTES } from "./lib/store.mjs";
import { restore, providerName } from "./lib/providers.mjs";
import { makePreview } from "./lib/preview.mjs";
import { makeKey, verifyKey, checkoutUrls, paymentsConfigured, redeemLicense } from "./lib/license.mjs";

const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 12);
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

async function handleRestore(req, res) {
  // Base64 inflates ~4/3, plus JSON envelope headroom.
  const maxBytes = Math.ceil(MAX_UPLOAD_MB * 1024 * 1024 * 1.5);
  let body;
  try {
    body = JSON.parse((await readBody(req, maxBytes)).toString("utf8"));
  } catch (err) {
    return json(res, err.status || 400, { error: err.status === 413 ? `Photos must be under ${MAX_UPLOAD_MB} MB.` : "Invalid request body." });
  }
  const original = decodeDataUrl(body.image);
  if (!original) return json(res, 400, { error: "Please upload a JPEG or PNG image." });

  const id = crypto.randomBytes(10).toString("hex");
  let restored;
  try {
    restored = await restore(original);
  } catch (err) {
    console.error(`[restore ${id}]`, err.message);
    return json(res, 502, { error: "Restoration failed. Your photo was not charged — please try again." });
  }

  const [preview, beforePreview] = await Promise.all([
    makePreview(restored, { watermark: true }),
    makePreview(original, { watermark: false }),
  ]);
  await saveJob(id, { orig: original, full: restored, prev: preview, bprev: beforePreview });

  json(res, 200, {
    id,
    mode: providerName(),
    demo: !paymentsConfigured(),
    preview: `/api/preview/${id}`,
    beforePreview: `/api/preview/${id}?side=before`,
    checkout: checkoutUrls(),
    expiresMinutes: TTL_MINUTES,
  });
}

async function handleUnlock(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8"));
  } catch {
    return json(res, 400, { error: "Invalid request body." });
  }
  const { id, licenseKey } = body || {};
  if (!id || !(await jobExists(id))) {
    return json(res, 404, { error: "This photo has expired. Photos are deleted after an hour — please upload it again." });
  }

  if (paymentsConfigured()) {
    if (!licenseKey) return json(res, 402, { error: "Enter the license key from your purchase email." });
    const result = await redeemLicense(licenseKey.trim(), id);
    if (!result.ok) return json(res, 402, { error: result.error });
  }
  // No payments configured -> demo unlock so the flow can be tested end to end.

  json(res, 200, { key: makeKey(id), resultUrl: `/api/result/${id}?key=${makeKey(id)}` });
}

async function handlePreview(req, res, id, url) {
  const side = url.searchParams.get("side") === "before" ? "bprev" : "prev";
  const buf = await loadPart(id, side);
  if (!buf) return json(res, 404, { error: "Expired." });
  res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" });
  res.end(buf);
}

async function handleResult(req, res, id, url) {
  if (!verifyKey(id, url.searchParams.get("key"))) {
    return json(res, 403, { error: "Invalid or missing unlock key." });
  }
  const buf = await loadPart(id, "full");
  if (!buf) return json(res, 404, { error: "Expired." });
  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="heirloom-restored-${id.slice(0, 6)}.jpg"`;
  }
  res.writeHead(200, headers);
  res.end(buf);
}

async function serveStatic(res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 404, { error: "Not found." });
  try {
    const buf = await readFile(file);
    const type = MIME[path.extname(file)] || "application/octet-stream";
    const cache = path.extname(file) === ".html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
    res.end(buf);
  } catch {
    json(res, 404, { error: "Not found." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;
  try {
    if (req.method === "POST" && pathname === "/api/restore") return await handleRestore(req, res);
    if (req.method === "POST" && pathname === "/api/unlock") return await handleUnlock(req, res);

    const preview = pathname.match(/^\/api\/preview\/([a-f0-9]{20})$/);
    if (req.method === "GET" && preview) return await handlePreview(req, res, preview[1], url);

    const result = pathname.match(/^\/api\/result\/([a-f0-9]{20})$/);
    if (req.method === "GET" && result) return await handleResult(req, res, result[1], url);

    if (req.method === "GET" && pathname === "/api/health") {
      return json(res, 200, { ok: true, provider: providerName(), payments: paymentsConfigured() });
    }
    if (req.method === "GET" || req.method === "HEAD") return await serveStatic(res, pathname);
    json(res, 405, { error: "Method not allowed." });
  } catch (err) {
    console.error("[server]", err);
    json(res, 500, { error: "Something went wrong on our end." });
  }
});

setInterval(() => {
  sweepExpired().then((n) => n && console.log(`[sweep] removed ${n} expired files`));
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Heirloom listening on http://localhost:${PORT}`);
  console.log(`  provider: ${providerName()}  payments: ${paymentsConfigured() ? "lemon squeezy" : "DEMO UNLOCK (configure before launch)"}  ttl: ${TTL_MINUTES}m`);
});
