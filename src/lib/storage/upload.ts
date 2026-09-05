import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/model/limits";
import { putImageBytes } from "@/lib/storage/image-store";

/**
 * Validates an uploaded image `File` and puts its bytes into the image store,
 * returning the content id to reference it by. Disallowed types and oversized
 * files are rejected so nothing unexpected reaches the store or the canvas.
 *
 * The bytes go in as-is: reading the file as a data URL first would inflate it
 * by ~33% only to be decoded again on the way into storage.
 */
export async function fileToImageId(file: File): Promise<string> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 10 MB)");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return putImageBytes(bytes, file.type);
}

/** Reads several files, skipping any that fail. Returns the successful ids. */
export async function filesToImageIds(files: Iterable<File>): Promise<{
  imageIds: string[];
  failed: number;
}> {
  const results = await Promise.allSettled(
    [...files].map((f) => fileToImageId(f)),
  );
  const imageIds: string[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") imageIds.push(r.value);
    else failed += 1;
  }
  return { imageIds, failed };
}
