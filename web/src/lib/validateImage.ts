import { MAX_IMAGE_BYTES } from "./types";

const MIN_SIDE = 64;

// Même règle que l'API d'inférence (configs/*.yaml : max_color_fraction, chroma_threshold) : une échographie
// est quasi en niveaux de gris (le Doppler couleur n'occupe qu'une petite zone). Le serveur revalide.
const MAX_COLOR_FRACTION = 0.5;
const CHROMA_THRESHOLD = 40;
const SAMPLE_SIDE = 128;

/** Part des pixels (RGBA, 4 octets chacun) dont l'écart max-min entre canaux dépasse le seuil. */
export function colorfulFraction(rgba: Uint8ClampedArray, threshold = CHROMA_THRESHOLD): number {
  const pixels = rgba.length / 4;
  if (pixels === 0) return 0;
  let colorful = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > threshold) colorful++;
  }
  return colorful / pixels;
}

/** Vrai si l'image est nettement en couleur (photo, capture d'écran…). Faux si le contrôle est impossible. */
function looksColorful(bitmap: ImageBitmap): boolean {
  try {
    const scale = Math.min(1, SAMPLE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return colorfulFraction(ctx.getImageData(0, 0, canvas.width, canvas.height).data) > MAX_COLOR_FRACTION;
  } catch {
    return false; // le serveur fera le contrôle
  }
}

async function startsWith(file: File, signature: number[]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  return signature.every((byte, i) => head[i] === byte);
}

/** Contrôles côté navigateur (le serveur revalide tout). Renvoie un code d'erreur ou null. */
export async function validateImageFile(file: File): Promise<string | null> {
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_IMAGE_BYTES) return "image_too_large";

  const isPng = await startsWith(file, [0x89, 0x50, 0x4e, 0x47]);
  const isJpeg = await startsWith(file, [0xff, 0xd8, 0xff]);
  if (!isPng && !isJpeg) return "unsupported_format";

  try {
    const bitmap = await createImageBitmap(file);
    const tooSmall = Math.min(bitmap.width, bitmap.height) < MIN_SIDE;
    const colorful = !tooSmall && looksColorful(bitmap);
    bitmap.close();
    if (tooSmall) return "unreadable_image";
    if (colorful) return "not_ultrasound";
  } catch {
    return "unreadable_image";
  }
  return null;
}

/** Type MIME déduit des octets (le `file.type` fourni par le navigateur n'est pas fiable). */
export async function detectMime(file: File): Promise<"image/png" | "image/jpeg"> {
  return (await startsWith(file, [0x89, 0x50, 0x4e, 0x47])) ? "image/png" : "image/jpeg";
}
