/**
 * Tiny utilities the export dialog uses to convert a captured PNG data URL
 * into a downloadable PNG, downloadable PDF, or a `Blob` placed on the
 * system clipboard. Pulled out so the dialog component itself stays focused
 * on layout + state.
 */

function safeFileBase(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "design";
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadPngFromDataUrl(dataUrl: string, designName: string) {
  triggerDownload(dataUrl, `${safeFileBase(designName)}.png`);
}

export async function copyImageToClipboard(dataUrl: string) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Image clipboard isn't supported in this browser. Right-click the image instead.");
  }
  const blob = await dataUrlToBlob(dataUrl);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

export async function downloadPdfFromDataUrl(dataUrl: string, designName: string) {
  // jspdf is ~250kB; lazy-load it so it never lands in the main bundle.
  const { jsPDF } = await import("jspdf");

  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read captured image"));
    img.src = dataUrl;
  });

  // Page is sized to the image's aspect ratio so the design fills the page
  // edge-to-edge with no awkward whitespace.
  const pdf = new jsPDF({
    unit: "px",
    format: [dims.w, dims.h],
    orientation: dims.w >= dims.h ? "landscape" : "portrait",
    hotfixes: ["px_scaling"],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, dims.w, dims.h, undefined, "FAST");
  pdf.save(`${safeFileBase(designName)}.pdf`);
}
