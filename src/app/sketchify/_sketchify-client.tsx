"use client";

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Download, RefreshCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Pixel-level image processing ─────────────────────────────────────────────

function boxBlur(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // Gaussian 3×3 (sum = 16)
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, wt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          const ki = (dy + 1) * 3 + (dx + 1);
          const i = (ny * w + nx) * 4;
          r += src[i] * k[ki];
          g += src[i + 1] * k[ki];
          b += src[i + 2] * k[ki];
          a += src[i + 3] * k[ki];
          wt += k[ki];
        }
      }
      const i = (y * w + x) * 4;
      dst[i] = r / wt;
      dst[i + 1] = g / wt;
      dst[i + 2] = b / wt;
      dst[i + 3] = a / wt;
    }
  }
  return dst;
}

function sobelMagnitude(src: Uint8ClampedArray, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let maxMag = 0;
      // Run Sobel across all 4 channels so colour + transparency boundaries are both caught
      for (let c = 0; c < 4; c++) {
        let gx = 0, gy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ki = (dy + 1) * 3 + (dx + 1);
            const v = src[((y + dy) * w + (x + dx)) * 4 + c] / 255;
            gx += v * kx[ki];
            gy += v * ky[ki];
          }
        }
        maxMag = Math.max(maxMag, Math.hypot(gx, gy));
      }
      mag[y * w + x] = maxMag;
    }
  }
  return mag;
}

type SketchParams = {
  threshold: number;   // edge sensitivity  0–1
  strokeWidth: number; // ink blob radius   1–4
  jitter: number;      // hand-drawn wobble 0–5
  seed: number;        // LCG seed for jitter
};

function sketchify(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  p: SketchParams,
): Uint8ClampedArray {
  const blurred = boxBlur(src, w, h);
  const edges = sobelMagnitude(blurred, w, h);

  // Normalise
  let maxE = 0;
  for (let i = 0; i < edges.length; i++) if (edges[i] > maxE) maxE = edges[i];
  if (maxE === 0) maxE = 1;
  for (let i = 0; i < edges.length; i++) edges[i] /= maxE;

  // Warm-cream background
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = 255;
    out[i * 4 + 1] = 253;
    out[i * 4 + 2] = 247;
    out[i * 4 + 3] = 255;
  }

  // Deterministic LCG so the same seed → same jitter pattern
  let s = p.seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const sw = Math.max(0, Math.ceil(p.strokeWidth) - 1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = edges[y * w + x];
      if (e < p.threshold) continue;

      // Number of ink dabs scales with edge strength → stronger edges are denser
      const passes = 1 + Math.round(e * 3);

      for (let pass = 0; pass < passes; pass++) {
        const jx = Math.round((rand() * 2 - 1) * p.jitter);
        const jy = Math.round((rand() * 2 - 1) * p.jitter);
        const alpha = e * (0.65 + rand() * 0.35);

        // Splat a small disc at the jittered position
        for (let dy = -sw; dy <= sw; dy++) {
          for (let dx = -sw; dx <= sw; dx++) {
            if (dx * dx + dy * dy > (sw + 0.5) * (sw + 0.5)) continue; // circular clip
            const nx = x + dx + jx;
            const ny = y + dy + jy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const idx = (ny * w + nx) * 4;
            // Blend warm-dark ink onto background
            out[idx]     = Math.round(out[idx]     * (1 - alpha) + 28  * alpha);
            out[idx + 1] = Math.round(out[idx + 1] * (1 - alpha) + 18  * alpha);
            out[idx + 2] = Math.round(out[idx + 2] * (1 - alpha) + 10  * alpha);
          }
        }
      }
    }
  }

  return out;
}

// ── React component ───────────────────────────────────────────────────────────

const MAX_DIM = 640; // scale down large images for speed

function scaleToFit(w: number, h: number): [number, number] {
  if (w <= MAX_DIM && h <= MAX_DIM) return [w, h];
  const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
  return [Math.round(w * ratio), Math.round(h * ratio)];
}

type Params = Omit<SketchParams, "seed">;

export function SketchifyClient() {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState("/figma-logo.png");
  const [params, setParams] = useState<Params>({
    threshold: 0.12,
    strokeWidth: 2,
    jitter: 1.5,
  });
  const [seed, setSeed] = useState(42);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const run = useCallback(
    (src: string, p: Params, sd: number) => {
      const canvas = outputRef.current;
      if (!canvas) return;

      setProcessing(true);
      setDone(false);

      const img = new window.Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        // Slight delay so the loading indicator renders before we block the thread
        setTimeout(() => {
          const [sw, sh] = scaleToFit(img.naturalWidth, img.naturalHeight);
          canvas.width = sw;
          canvas.height = sh;

          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, sw, sh);
          const raw = ctx.getImageData(0, 0, sw, sh);

          const out = sketchify(raw.data, sw, sh, { ...p, seed: sd });

          const result = ctx.createImageData(sw, sh);
          result.data.set(out);
          ctx.putImageData(result, 0, 0);

          setProcessing(false);
          setDone(true);
        }, 20);
      };

      img.onerror = () => setProcessing(false);
      img.src = src;
    },
    [],
  );

  const handleGenerate = () => run(imageSrc, params, seed);

  const handleReseed = () => {
    const next = Math.floor(Math.random() * 0xffffff);
    setSeed(next);
    run(imageSrc, params, next);
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    run(url, params, seed);
  };

  const handleDownload = () => {
    const canvas = outputRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "sketch.png";
    a.click();
  };

  const update = (key: keyof Params, val: number) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-sketch text-4xl font-bold text-ink">Sketchify</h1>
          <p className="text-sm text-ink-muted">
            Converts any image into a hand-drawn outline in the spirit of{" "}
            <span className="font-sketch font-bold">Cabin Sketch</span>.
          </p>
        </div>

        {/* Canvas area */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Original */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-muted">
              Original
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Source"
              className="w-full rounded-lg border border-border bg-surface object-contain"
              style={{ minHeight: 200 }}
            />
          </div>

          {/* Sketch output */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-muted">
              Sketch
            </span>
            <div className="relative min-h-[200px] overflow-hidden rounded-lg border border-border bg-[#fffdf7]">
              {processing && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#fffdf7]/80 text-sm text-ink-muted">
                  <span className="animate-pulse">Processing…</span>
                </div>
              )}
              <canvas
                ref={outputRef}
                className="w-full"
                style={{ display: done || processing ? "block" : "none" }}
              />
              {!done && !processing && (
                <div className="flex h-[200px] items-center justify-center text-sm text-ink-subtle">
                  Hit{" "}
                  <kbd className="mx-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs">
                    Generate
                  </kbd>{" "}
                  to sketch
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <label className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Edge sensitivity</span>
                <span className="font-mono text-ink">{params.threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.03"
                max="0.40"
                step="0.01"
                value={params.threshold}
                onChange={(e) => update("threshold", parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Stroke width</span>
                <span className="font-mono text-ink">{params.strokeWidth.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={params.strokeWidth}
                onChange={(e) => update("strokeWidth", parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Hand-drawn jitter</span>
                <span className="font-mono text-ink">{params.jitter.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={params.jitter}
                onChange={(e) => update("jitter", parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} disabled={processing}>
            Generate sketch
          </Button>
          <Button variant="outline" onClick={handleReseed} disabled={processing}>
            <RefreshCcw className="size-4" />
            Re-jitter
          </Button>
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={processing}>
            <Upload className="size-4" />
            Upload image
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!done}>
            <Download className="size-4" />
            Download PNG
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
    </main>
  );
}
