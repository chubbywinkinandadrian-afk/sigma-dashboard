// Renders a 9:16 TikTok/Reels/Shorts clip from a before/after pair:
// blurred backdrop, centered photo, hold BEFORE -> wipe reveal -> hold AFTER,
// then a CTA card. Silent on purpose — add a trending sound in the app.
//
//   node scripts/make-clip.mjs before.jpg after.jpg out.mp4 \
//     [--hook "Restoring my grandma's photo from 1962"] \
//     [--cta "Restore yours — $9"] [--brand "heirloom"]
//
// Requires ffmpeg on PATH.
import Jimp from "jimp";
import { execFileSync } from "node:child_process";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const W = 1080;
const H = 1920;
const PHOTO_W = 960;
const FPS = 30;

const HOLD_BEFORE = 1.6;
const WIPE = 3.5;
const HOLD_AFTER = 2.2;
const CTA = 2.4;
const TOTAL = HOLD_BEFORE + WIPE + HOLD_AFTER + CTA;
const WIPE_END = HOLD_BEFORE + WIPE;
const CTA_START = WIPE_END + HOLD_AFTER;

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const [before, after, out] = process.argv.slice(2);
if (!before || !after || !out) {
  console.error("usage: node scripts/make-clip.mjs <before> <after> <out.mp4> [--hook ...] [--cta ...] [--brand ...]");
  process.exit(1);
}
const hook = arg("--hook", "Restoring a 60-year-old family photo");
const cta = arg("--cta", "Restore yours — $9 · free preview");
const brand = arg("--brand", "heirloom");

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\\\\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");

const meta = await Jimp.read(before);
const photoH = Math.round(((PHOTO_W * meta.bitmap.height) / meta.bitmap.width) / 2) * 2;
const photoY = Math.round((H - photoH) / 2);
const photoX = Math.round((W - PHOTO_W) / 2);
const labelY = photoY + photoH - 110;

const filter = [
  // backdrop: the after image blown up, blurred, dimmed
  `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=26,eq=brightness=-0.1[bg]`,
  // photo layers + wipe
  `[0:v]scale=${PHOTO_W}:${photoH}[b]`,
  `[1:v]scale=${PHOTO_W}:${photoH}[a]`,
  `[b][a]xfade=transition=wipeleft:duration=${WIPE}:offset=${HOLD_BEFORE}[photo]`,
  `[bg][photo]overlay=${photoX}:${photoY}[v1]`,
  // moving divider line during the wipe
  `color=c=white:s=6x${photoH}:d=${TOTAL}[bar]`,
  `[v1][bar]overlay=x='${photoX}+${PHOTO_W}*(t-${HOLD_BEFORE})/${WIPE}':y=${photoY}:enable='between(t,${HOLD_BEFORE},${WIPE_END})'[v2]`,
  // hook text, top
  `[v2]drawtext=fontfile=${FONT}:text='${esc(hook)}':fontsize=44:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=20:x=(w-text_w)/2:y=170[v3]`,
  // BEFORE / AFTER chips
  `[v3]drawtext=fontfile=${FONT}:text='BEFORE':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=14:x=${photoX + 28}:y=${labelY}:enable='lt(t,${HOLD_BEFORE})'[v4]`,
  `[v4]drawtext=fontfile=${FONT}:text='AFTER':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=14:x=${photoX + PHOTO_W - 200}:y=${labelY}:enable='gt(t,${WIPE_END})'[v5]`,
  // CTA card
  `[v5]drawtext=fontfile=${FONT}:text='${esc(cta)}':fontsize=50:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=24:x=(w-text_w)/2:y=${H - 460}:enable='gt(t,${CTA_START})'[v6]`,
  `[v6]drawtext=fontfile=${FONT}:text='${esc(brand)}':fontsize=44:fontcolor=white@0.92:box=1:boxcolor=black@0.5:boxborderw=18:x=(w-text_w)/2:y=${H - 330}:enable='gt(t,${CTA_START})',fps=${FPS},format=yuv420p[vout]`,
].join(";");

execFileSync(
  "ffmpeg",
  [
    "-y", "-loglevel", "error",
    "-loop", "1", "-t", String(TOTAL), "-i", before,
    "-loop", "1", "-t", String(TOTAL), "-i", after,
    "-filter_complex", filter,
    "-map", "[vout]",
    "-t", String(TOTAL),
    "-c:v", "libx264", "-preset", "medium", "-crf", "21",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" }
);
console.log(`Wrote ${out} (${TOTAL}s, ${W}x${H})`);
