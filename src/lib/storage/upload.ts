import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/model/limits";

/**
 * Validates and reads an uploaded image `File` into a data URL. Rejects
 * disallowed types and oversized files so nothing unexpected reaches the store
 * or the canvas.
 */
export function fileToDataUrl(file: File): Promise<string> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return Promise.reject(new Error(`Unsupported image type: ${file.type}`));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("Image is too large (max 10 MB)"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Reads several files, skipping any that fail. Returns the successful ones. */
export async function filesToDataUrls(files: Iterable<File>): Promise<{
  images: string[];
  failed: number;
}> {
  const results = await Promise.allSettled(
    [...files].map((f) => fileToDataUrl(f)),
  );
  const images: string[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") images.push(r.value);
    else failed += 1;
  }
  return { images, failed };
}
