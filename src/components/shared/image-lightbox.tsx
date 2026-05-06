"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";

import {
  IMG_ZOOM_STEP,
  IMG_ZOOM_MIN,
  IMG_ZOOM_MAX,
  IMG_MAX_HEIGHT,
  clampZoom as clamp,
} from "@/components/shared/utils/image-zoom";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const setZoomRef = useRef(setZoom);

  useEffect(() => {
    setZoomRef.current = setZoom;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomRef.current((z) => clamp(z - e.deltaY * 0.001));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const isTall = naturalHeight !== null && naturalHeight > IMG_MAX_HEIGHT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`Image preview: ${alt}`}
    >
      <div
        className="flex max-w-[90vw] flex-col overflow-hidden rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={viewportRef}
          className="overflow-auto bg-black"
          style={isTall ? { maxHeight: IMG_MAX_HEIGHT } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onLoad={(e) =>
              setNaturalHeight(
                (e.currentTarget as HTMLImageElement).naturalHeight,
              )
            }
            style={{
              display: "block",
              width: `${zoom * 100}%`,
              maxWidth: "none",
              height: "auto",
            }}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border bg-background px-3 py-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= IMG_ZOOM_MIN}
              onClick={() => setZoom(clamp(zoom - IMG_ZOOM_STEP))}
              className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => setZoom(1)}
              className="min-w-[3rem] text-center text-[11px] font-medium tabular-nums text-ink-muted hover:text-ink"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= IMG_ZOOM_MAX}
              onClick={() => setZoom(clamp(zoom + IMG_ZOOM_STEP))}
              className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
