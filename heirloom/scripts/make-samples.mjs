// Generates the landing-page sample pair: a painted "restored" scene and a
// degraded "before" version (sepia, fade, scratches, dust, vignette).
// Placeholder art — swap in a real public-domain restoration pair before
// launch (see README). Run: npm run samples
import Jimp from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1200;
const H = 900;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function px(img, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  const i = (img.bitmap.width * y + x) << 2;
  img.bitmap.data[i] = clamp(r);
  img.bitmap.data[i + 1] = clamp(g);
  img.bitmap.data[i + 2] = clamp(b);
  img.bitmap.data[i + 3] = 255;
}

function rect(img, x0, y0, x1, y1, [r, g, b]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(img, x, y, r, g, b);
}

function circle(img, cx, cy, rad, [r, g, b]) {
  for (let y = cy - rad; y <= cy + rad; y++)
    for (let x = cx - rad; x <= cx + rad; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) px(img, x, y, r, g, b);
}

function paintScene() {
  const img = new Jimp(W, H, 0xffffffff);
  const HORIZON = 560;

  // sky gradient
  for (let y = 0; y < HORIZON; y++) {
    const t = y / HORIZON;
    const r = 159 + (240 - 159) * t;
    const g = 195 + (227 - 195) * t;
    const b = 216 + (192 - 216) * t;
    for (let x = 0; x < W; x++) px(img, x, y, r, g, b);
  }
  circle(img, 930, 150, 55, [247, 232, 176]); // sun

  // far hills
  for (let x = 0; x < W; x++) {
    const ridge = 470 + 40 * Math.sin(x / 170) + 18 * Math.sin(x / 53 + 2);
    for (let y = Math.round(ridge); y < HORIZON; y++) px(img, x, y, 143, 168, 118);
  }

  // foreground field with gentle row texture
  for (let y = HORIZON; y < H; y++) {
    const tone = y % 14 < 7 ? 0 : -6;
    for (let x = 0; x < W; x++) px(img, x, y, 169 + tone, 189 + tone, 126 + tone);
  }

  // path
  for (let y = HORIZON + 30; y < H; y++) {
    const t = (y - (HORIZON + 30)) / (H - HORIZON - 30);
    const half = 8 + 62 * t;
    for (let x = Math.round(610 - half); x < 610 + half; x++) px(img, x, y, 203, 179, 138);
  }

  // cottage
  rect(img, 290, 430, 510, 580, [236, 225, 200]); // walls
  for (let y = 330; y < 430; y++) {
    // roof triangle
    const t = (y - 330) / 100;
    const half = 130 * t + 10;
    for (let x = Math.round(400 - half); x < 400 + half; x++) px(img, x, y, 122, 74, 50);
  }
  rect(img, 378, 492, 428, 580, [93, 70, 50]); // door
  rect(img, 312, 462, 352, 502, [143, 182, 201]); // window L
  rect(img, 452, 462, 492, 502, [143, 182, 201]); // window R
  rect(img, 330, 462, 334, 502, [236, 225, 200]); // window L mullion
  rect(img, 470, 462, 474, 502, [236, 225, 200]); // window R mullion
  rect(img, 470, 350, 492, 410, [155, 120, 96]); // chimney

  // tree
  rect(img, 878, 470, 904, 640, [110, 79, 51]);
  circle(img, 890, 420, 88, [111, 143, 84]);
  circle(img, 835, 455, 58, [124, 158, 95]);
  circle(img, 948, 452, 56, [104, 134, 79]);

  // fence
  for (let fx = 60; fx <= 250; fx += 58) rect(img, fx, 560, fx + 10, 626, [176, 154, 118]);
  rect(img, 56, 576, 264, 586, [176, 154, 118]);

  img.contrast(0.06);
  return img;
}

function degrade(after) {
  const img = after.clone();
  img.sepia();
  img.brightness(0.1);
  img.contrast(-0.3);
  img.blur(1);

  const { width, height, data } = img.bitmap;
  const cx = width / 2;
  const cy = height / 2;
  const dmax = Math.sqrt(cx * cx + cy * cy);

  // vignette + film grain
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / dmax;
      const v = 1 - 0.42 * d * d;
      const noise = (Math.random() - 0.5) * 30;
      data[i] = clamp(data[i] * v + noise);
      data[i + 1] = clamp(data[i + 1] * v + noise);
      data[i + 2] = clamp(data[i + 2] * v + noise * 0.8);
    }
  }

  // scratches
  for (let s = 0; s < 11; s++) {
    const x0 = Math.random() * width;
    const y0 = Math.random() * height * 0.7;
    const len = 220 + Math.random() * 480;
    const slope = (Math.random() - 0.5) * 0.35;
    const light = Math.random() > 0.4 ? 70 : -55;
    const wpx = Math.random() > 0.6 ? 2 : 1;
    for (let t = 0; t < len; t++) {
      const x = Math.round(x0 + t * slope);
      const y = Math.round(y0 + t);
      for (let w = 0; w < wpx; w++) {
        const i = (width * y + (x + w)) << 2;
        if (y >= 0 && y < height && x + w >= 0 && x + w < width) {
          data[i] = clamp(data[i] + light);
          data[i + 1] = clamp(data[i + 1] + light);
          data[i + 2] = clamp(data[i + 2] + light);
        }
      }
    }
  }

  // dust specks
  for (let s = 0; s < 150; s++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const light = Math.random() > 0.5 ? 80 : -60;
    const rad = Math.random() > 0.85 ? 2 : 1;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const i = (width * yy + xx) << 2;
        data[i] = clamp(data[i] + light);
        data[i + 1] = clamp(data[i + 1] + light);
        data[i + 2] = clamp(data[i + 2] + light);
      }
  }

  // water blotches: pale irregular spots
  for (let s = 0; s < 4; s++) {
    const bx = 100 + Math.random() * (width - 200);
    const by = 100 + Math.random() * (height - 200);
    const rad = 26 + Math.random() * 34;
    for (let y = by - rad; y < by + rad; y++)
      for (let x = bx - rad; x < bx + rad; x++) {
        const d = Math.sqrt((x - bx) ** 2 + (y - by) ** 2) / rad;
        if (d > 1) continue;
        const mix = 0.4 * (1 - d);
        const i = (width * Math.round(y) + Math.round(x)) << 2;
        data[i] = clamp(data[i] * (1 - mix) + 232 * mix);
        data[i + 1] = clamp(data[i + 1] * (1 - mix) + 220 * mix);
        data[i + 2] = clamp(data[i + 2] * (1 - mix) + 192 * mix);
      }
  }

  // one diagonal crease across the top-left corner
  for (let t = 0; t < 420; t++) {
    const x = Math.round(40 + t * 0.9);
    const y = Math.round(300 - t * 0.62);
    for (let w = -1; w <= 1; w++) {
      if (x + w < 0 || x + w >= width || y < 0 || y >= height) continue;
      const i = (width * y + (x + w)) << 2;
      const lift = w === 0 ? 64 : 30;
      data[i] = clamp(data[i] + lift);
      data[i + 1] = clamp(data[i + 1] + lift);
      data[i + 2] = clamp(data[i + 2] + lift);
    }
  }

  return img;
}

const after = paintScene();
const before = degrade(after);
await after.quality(88).writeAsync(path.join(OUT, "sample-after.jpg"));
await before.quality(88).writeAsync(path.join(OUT, "sample-before.jpg"));
console.log("Wrote public/sample-before.jpg and public/sample-after.jpg");
