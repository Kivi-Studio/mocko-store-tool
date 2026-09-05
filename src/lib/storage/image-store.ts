import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";

/**
 * Content-addressed storage for screenshots.
 *
 * Images live here keyed by the SHA-256 of their bytes, instead of inline in
 * the persisted project state. Two consequences, both of which start to matter
 * once every release of an app is kept:
 *
 * - The persisted state stays small. The debounced autosave rewrites project
 *   metadata rather than every screenshot in the library on each change.
 * - A release that reuses a screenshot costs nothing — identical bytes collapse
 *   onto one entry. In practice the repeats are exactly the shots that did not
 *   change between two versions.
 *
 * Entries hold raw bytes plus their mime type, so images are stored as binary
 * rather than paying the ~33% base64 tax an inline data URL costs. An
 * `ArrayBuffer` is used rather than a `Blob` because structured-clone support
 * for blobs is uneven across IndexedDB implementations.
 *
 * The store lives in its own IndexedDB database, deliberately separate from the
 * Zustand `persist` blob: image writes must not force a rewrite of the state,
 * and a state rollback must not silently orphan images.
 */

const DB_NAME = "mocko-images";
const STORE_NAME = "images";

/** What one entry holds: the image's bytes and the mime type to serve them as. */
type StoredImage = { mime: string; bytes: ArrayBuffer };

let store: UseStore | null = null;

/** Lazily created so importing this module is safe during SSR. */
function imageStore(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  store ??= createStore(DB_NAME, STORE_NAME);
  return store;
}

/** Hex SHA-256 of the given bytes — the content id an image is stored under. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  // `bytes.buffer` may be a slice of a larger ArrayBuffer, so pass the view.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Splits a `data:` URL into its mime type and raw bytes, or `null`. */
export function parseDataUrl(
  dataUrl: string,
): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mime: match[1], bytes };
  } catch {
    return null;
  }
}

/**
 * Stores raw image bytes and returns their content id. Bytes already present
 * are not rewritten — that is where the deduplication happens.
 */
export async function putImageBytes(
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const id = await hashBytes(bytes);
  const s = imageStore();
  if (!s) return id;
  if ((await get(id, s)) === undefined) {
    const copy = new Uint8Array(bytes);
    await set(id, { mime, bytes: copy.buffer } satisfies StoredImage, s);
  }
  return id;
}

/** Stores an image given as a data URL. Returns its content id, or `null`. */
export async function putImageDataUrl(
  dataUrl: string | null,
): Promise<string | null> {
  if (!dataUrl) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  return putImageBytes(parsed.bytes, parsed.mime);
}

/** The stored bytes for a content id, or `null` when they are no longer there. */
export async function getImageBlob(id: string | null): Promise<Blob | null> {
  const s = imageStore();
  if (!id || !s) return null;
  const record = await get<StoredImage>(id, s);
  if (!record) return null;
  return new Blob([record.bytes], { type: record.mime });
}

/**
 * Object URLs handed to `<img>`/`loadImage`, cached per content id.
 *
 * They are intentionally never revoked: a URL stays valid for the session, and
 * the cache is bounded by the number of distinct images actually rendered —
 * far less than the whole library, which is what used to sit in memory as data
 * URLs regardless.
 */
const urlCache = new Map<string, Promise<string | null>>();

/** Resolves a content id to a URL usable as an image source. */
export function getImageUrl(id: string | null): Promise<string | null> {
  if (!id) return Promise.resolve(null);
  const cached = urlCache.get(id);
  if (cached) return cached;
  const promise = getImageBlob(id).then((blob) =>
    blob ? URL.createObjectURL(blob) : null,
  );
  urlCache.set(id, promise);
  return promise;
}

/** True when an id is present in the store. */
export async function hasImage(id: string): Promise<boolean> {
  const s = imageStore();
  if (!s) return false;
  return (await get(id, s)) !== undefined;
}

/**
 * Deletes every stored image whose id is not in `referenced`, and returns how
 * many went. Call it with the ids reachable from the whole state — an image is
 * shared across releases, so it may only go once the last one lets go.
 */
export async function sweep(referenced: Iterable<string>): Promise<number> {
  const s = imageStore();
  if (!s) return 0;
  const keep = new Set(referenced);
  const stored = await keys(s);
  let removed = 0;
  for (const key of stored) {
    const id = String(key);
    if (keep.has(id)) continue;
    await del(id, s);
    urlCache.delete(id);
    removed += 1;
  }
  return removed;
}
