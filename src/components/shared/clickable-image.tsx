"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/shared/image-lightbox";

/** Thumbnail that opens a full-size lightbox on click. */
export function ClickableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="View full-size image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn("transition-opacity hover:opacity-90", className)}
        />
      </button>
      {open ? (
        <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
