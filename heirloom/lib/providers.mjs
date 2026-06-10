import Jimp from "jimp";

const MAX_DIM = 2400;

async function readBounded(buffer) {
  const image = await Jimp.read(buffer);
  if (image.bitmap.width > MAX_DIM || image.bitmap.height > MAX_DIM) {
    image.scaleToFit(MAX_DIM, MAX_DIM);
  }
  return image;
}

// Demo provider: a deterministic local enhancement (auto-levels, contrast,
// gentle sharpen). It will not repair tears or colorize — it exists so the
// whole flow can be exercised end-to-end with no API key. Swap to the
// `replicate` provider for real restoration.
async function demoRestore(buffer) {
  const image = await readBounded(buffer);
  image.normalize();
  image.contrast(0.16);
  image.color([{ apply: "saturate", params: [14] }]);
  image.convolute([
    [0, -0.35, 0],
    [-0.35, 2.4, -0.35],
    [0, -0.35, 0],
  ]);
  return image.quality(90).getBufferAsync(Jimp.MIME_JPEG);
}

// Replicate provider. Defaults to a FLUX Kontext restoration app; both the
// model and its image input key are configurable because hosted models come
// and go. NOTE: written against Replicate's HTTP API but not yet exercised
// with a live token — run one real job before launch.
async function replicateRestore(buffer) {
  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_MODEL || "flux-kontext-apps/restore-image";
  const inputKey = process.env.REPLICATE_INPUT_KEY || "input_image";
  const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({ input: { [inputKey]: dataUri } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const prediction = await res.json();
  if (prediction.status === "failed" || prediction.error) {
    throw new Error(`Restoration failed: ${prediction.error || "unknown error"}`);
  }
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string") throw new Error("Model returned no image URL.");
  const imgRes = await fetch(output);
  if (!imgRes.ok) throw new Error(`Could not download result (${imgRes.status}).`);
  const out = Buffer.from(await imgRes.arrayBuffer());
  // Normalize to bounded JPEG so previews/storage behave identically per provider.
  const image = await readBounded(out);
  return image.quality(92).getBufferAsync(Jimp.MIME_JPEG);
}

export function providerName() {
  if (process.env.RESTORE_PROVIDER) return process.env.RESTORE_PROVIDER;
  return process.env.REPLICATE_API_TOKEN ? "replicate" : "demo";
}

export async function restore(buffer) {
  const name = providerName();
  if (name === "replicate") return replicateRestore(buffer);
  return demoRestore(buffer);
}
