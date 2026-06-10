import Jimp from "jimp";

const PREVIEW_DIM = 480;

let fontPromise;
function getFont() {
  fontPromise ||= Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  return fontPromise;
}

// Low-res, watermarked previews are the paywall: the improvement is visible,
// the keepsake-quality file is not. Full resolution never leaves the server
// until /api/unlock issues a key.
export async function makePreview(buffer, { watermark }) {
  const image = await Jimp.read(buffer);
  image.scaleToFit(PREVIEW_DIM, PREVIEW_DIM);

  if (watermark) {
    const font = await getFont();
    const text = "HEIRLOOM PREVIEW";
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const textW = Jimp.measureText(font, text);
    const textH = Jimp.measureTextHeight(font, text, textW);
    const stamp = new Jimp(w, h, 0x00000000);
    stamp.print(font, Math.max(0, (w - textW) / 2), Math.max(0, (h - textH) / 2), text);
    stamp.print(font, Math.max(0, w - textW - 12), Math.max(0, h - textH - 8), text);
    image.composite(stamp, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.4,
      opacityDest: 1,
    });
  }

  return image.quality(70).getBufferAsync(Jimp.MIME_JPEG);
}
