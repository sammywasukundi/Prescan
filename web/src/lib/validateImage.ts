import { MAX_IMAGE_BYTES } from "./types";

const MIN_SIDE = 64;

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
    bitmap.close();
    if (tooSmall) return "unreadable_image";
  } catch {
    return "unreadable_image";
  }
  return null;
}

/** Type MIME déduit des octets (le `file.type` fourni par le navigateur n'est pas fiable). */
export async function detectMime(file: File): Promise<"image/png" | "image/jpeg"> {
  return (await startsWith(file, [0x89, 0x50, 0x4e, 0x47])) ? "image/png" : "image/jpeg";
}
