"use client";

import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { toast } from "sonner";

/**
 * Mirrors the server-side MIME allowlist in upload/route.ts.
 * Validated here for instant, offline feedback before the upload even starts.
 */
const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

interface UseFileDropOptions {
  onValidFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Tracks drag-over state for a region and validates dropped files against the
 * supported MIME allowlist. Valid files are forwarded to `onValidFiles`;
 * unsupported files surface a toast with the list of accepted types.
 *
 * Uses a counter-based approach to avoid false `dragLeave` events that fire
 * when the cursor moves from the parent element to a child element.
 */
export function useFileDrop({ onValidFiles, disabled = false }: UseFileDropOptions) {
  const [dragOver, setDragOver] = useState(false);
  const counterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      counterRef.current += 1;
      if (counterRef.current === 1) setDragOver(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      counterRef.current -= 1;
      if (counterRef.current <= 0) {
        counterRef.current = 0;
        setDragOver(false);
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      counterRef.current = 0;
      setDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const valid: File[] = [];
      const invalid: File[] = [];

      for (const file of files) {
        const mime = (file.type || "").toLowerCase();
        if (SUPPORTED_MIME_TYPES.has(mime)) {
          valid.push(file);
        } else {
          invalid.push(file);
        }
      }

      if (invalid.length > 0) {
        const description = "Supported types: images (PNG, JPEG, GIF, WebP), PDF, TXT, Markdown, CSV";
        if (invalid.length === 1) {
          toast.error(`"${invalid[0].name}" is not a supported file type`, { description });
        } else {
          toast.error(
            `${invalid.length} files are not a supported type`,
            {
              description: `${invalid.map((f) => f.name).join(", ")} — ${description}`,
            },
          );
        }
      }

      if (valid.length > 0) {
        onValidFiles(valid);
      }
    },
    [disabled, onValidFiles],
  );

  return {
    dragOver,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
