"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getImageUrl } from "@/lib/storage/image-store";

/**
 * The raw screenshot behind a shot, small. Deliberately not the composed
 * canvas: here it answers "which screenshot am I writing copy for?", and the
 * bare screenshot says that faster than the finished store image would.
 */
export function ShotThumb({ imageId }: { imageId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  // Clear the previous image the moment the id changes, so a row never shows
  // a stale screenshot while the new one resolves (adjust-state-during-render
  // rather than an effect).
  const [prevId, setPrevId] = useState(imageId);
  if (prevId !== imageId) {
    setPrevId(imageId);
    setUrl(null);
  }

  useEffect(() => {
    let cancelled = false;
    void getImageUrl(imageId).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  if (!url) {
    return (
      <div className="bg-muted/60 text-muted-foreground flex h-14 w-8 shrink-0 items-center justify-center rounded">
        <ImageOff className="size-3.5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB, nothing to optimize
    <img
      src={url}
      alt=""
      className="bg-muted h-14 w-8 shrink-0 rounded object-cover"
    />
  );
}
