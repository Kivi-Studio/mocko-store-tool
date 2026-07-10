/**
 * Decodes image data URLs into `HTMLImageElement`s, cached by source so the
 * same screenshot isn't decoded once per preview render. Used by the live
 * canvas preview and by export.
 */
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = cache.get(src);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
  cache.set(src, promise);
  return promise;
}

/** Resolves a source to a decoded image, or null if it is empty or fails. */
export async function loadImageOrNull(
  src: string | null,
): Promise<HTMLImageElement | null> {
  if (!src) return null;
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}
