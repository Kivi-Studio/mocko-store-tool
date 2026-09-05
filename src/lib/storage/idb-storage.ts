import { del, get, set } from "idb-keyval";
import { toast } from "sonner";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { createId } from "@/lib/utils";

/**
 * A Zustand `persist` storage backed by IndexedDB (via idb-keyval).
 *
 * We use IndexedDB rather than localStorage because even without the
 * screenshots themselves — those live in `image-store` — a library of projects
 * exceeds the ~5 MB localStorage quota.
 *
 * This implements `PersistStorage` (not the string-based `StateStorage`), so
 * state is stored via structured clone without a JSON.stringify pass — with
 * multi-megabyte screenshots inline, serializing on every store change is the
 * difference between instant edits and visible jank. Writes are additionally
 * debounced and flushed when the tab is hidden or closed.
 *
 * All operations are async; reads/writes only execute in the browser, so this
 * is safe to import during SSR.
 */
const WRITE_DEBOUNCE_MS = 500;
const SYNC_CHANNEL = "screenshot-creator-sync";

/** Identifies this tab so it can ignore its own sync broadcasts. */
const TAB_ID = createId();

const hasIndexedDb = (): boolean => typeof indexedDB !== "undefined";

let channel: BroadcastChannel | null | undefined;
function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(SYNC_CHANNEL)
        : null;
  }
  return channel;
}

/**
 * Registers a listener for writes made by other tabs. Used to rehydrate the
 * store so two open tabs don't silently overwrite each other's changes.
 */
export function onExternalWrite(listener: () => void): void {
  getChannel()?.addEventListener("message", (event) => {
    if (event.data?.tabId !== TAB_ID) listener();
  });
}

type PendingWrite = {
  timer: ReturnType<typeof setTimeout>;
  write: () => Promise<void>;
};

const pending = new Map<string, PendingWrite>();
let lastWriteFailed = false;

async function performWrite(name: string, value: unknown): Promise<void> {
  try {
    await set(name, value);
    getChannel()?.postMessage({ tabId: TAB_ID, name });
    if (lastWriteFailed) {
      lastWriteFailed = false;
      toast.success("Saving works again");
    }
  } catch (error) {
    console.error("IndexedDB write failed", error);
    if (!lastWriteFailed) {
      lastWriteFailed = true;
      toast.error(
        "Saving failed — changes may be lost when you close the tab (check available storage)",
      );
    }
  }
}

/** Writes all debounced pending values immediately. */
export function flushPendingWrites(): Promise<void> {
  const writes = [...pending.values()].map((p) => {
    clearTimeout(p.timer);
    return p.write();
  });
  pending.clear();
  return Promise.all(writes).then(() => undefined);
}

if (typeof window !== "undefined") {
  // Best effort: an async IndexedDB write started in pagehide usually
  // completes even though the page can't await it.
  window.addEventListener("pagehide", () => void flushPendingWrites());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingWrites();
  });
}

export function createIdbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      if (!hasIndexedDb()) return null;
      const value = await get(name);
      if (value == null) return null;
      // Earlier versions stored a JSON string (createJSONStorage); parse it
      // so existing data survives the switch to structured clone.
      if (typeof value === "string") {
        return JSON.parse(value) as StorageValue<S>;
      }
      return value as StorageValue<S>;
    },
    setItem: (name, value) => {
      if (!hasIndexedDb()) return;
      const existing = pending.get(name);
      if (existing) clearTimeout(existing.timer);
      const write = () => {
        pending.delete(name);
        return performWrite(name, value);
      };
      pending.set(name, {
        timer: setTimeout(() => void write(), WRITE_DEBOUNCE_MS),
        write,
      });
    },
    removeItem: async (name) => {
      if (!hasIndexedDb()) return;
      const existing = pending.get(name);
      if (existing) {
        clearTimeout(existing.timer);
        pending.delete(name);
      }
      await del(name);
    },
  };
}

/**
 * Where the pre-migration state is parked while images move into the image
 * store. Screenshots used to live inline in the state; moving them out is the
 * one moment the whole library passes through a rewrite, so the untouched
 * original is kept until a later session proves the new shape loads.
 */
const LEGACY_BACKUP_KEY = "screenshot-studio.pre-image-store";

/** Parks the untouched pre-migration state. Never overwrites an existing one. */
export async function backupLegacyState(value: unknown): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    if ((await get(LEGACY_BACKUP_KEY)) === undefined) {
      await set(LEGACY_BACKUP_KEY, value);
    }
  } catch (error) {
    // A backup that cannot be written must not block the migration; the
    // original key is still there until the migrated state is written.
    console.error("Could not back up pre-migration state", error);
  }
}

/** The parked pre-migration state, if one is still around. */
export function readLegacyBackup(): Promise<unknown> {
  if (!hasIndexedDb()) return Promise.resolve(undefined);
  return get(LEGACY_BACKUP_KEY);
}

/** Drops the parked state once a later session has loaded the new shape. */
export async function discardLegacyBackup(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await del(LEGACY_BACKUP_KEY);
  } catch (error) {
    console.error("Could not discard pre-migration backup", error);
  }
}
