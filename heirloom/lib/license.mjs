import crypto from "node:crypto";

// Unlock keys are HMACs of the job id. They are only honored while the job's
// files still exist (jobs expire after TTL_MINUTES), so a per-boot secret is
// acceptable when UNLOCK_SECRET is not configured.
const SECRET = process.env.UNLOCK_SECRET || crypto.randomBytes(32).toString("hex");

export function makeKey(id) {
  return crypto.createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 32);
}

export function verifyKey(id, key) {
  if (typeof key !== "string" || key.length !== 32) return false;
  const expected = makeKey(id);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(key));
  } catch {
    return false;
  }
}

export function checkoutUrls() {
  const single = process.env.LEMONSQUEEZY_CHECKOUT_URL_SINGLE || "";
  const pack = process.env.LEMONSQUEEZY_CHECKOUT_URL_PACK || "";
  return single || pack ? { single, pack } : null;
}

export function paymentsConfigured() {
  return checkoutUrls() !== null;
}

// Redeems one activation of a Lemon Squeezy license key. Products should be
// created with an activation limit (1 for the single, 5 for the five-pack) so
// the same key unlocks exactly that many photos. No API key is required for
// the public license endpoints.
export async function redeemLicense(licenseKey, jobId) {
  const body = new URLSearchParams({
    license_key: licenseKey,
    instance_name: `heirloom-${jobId}`,
  });
  let res;
  try {
    res = await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    return { ok: false, error: "Could not reach the license server. Please try again." };
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (res.ok && data.activated) return { ok: true };
  return { ok: false, error: data.error || "That license key could not be activated." };
}
