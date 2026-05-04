import type { SandpackFiles } from "@codesandbox/sandpack-react";
import type { DesignFileDTO } from "@/lib/workspace/types";

// The host iframe HTML. Tailwind itself is injected by Sandpack via
// `options.externalResources` (see design-renderer.tsx) so it loads reliably
// regardless of whether the runtime bundler picks up this file as the iframe
// document. We keep the file so we can pin a sensible base font + a full-
// height root, which Tailwind alone won't give us.
const TAILWIND_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Canvas preview</title>
    <style>
      html, body, #root { height: 100%; margin: 0; }
      body { font-family: ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

// Loaded inside the Sandpack iframe so the parent can request a same-origin
// screenshot of the rendered design (useful for the export dialog and any
// other "preview as image" feature). The iframe is cross-origin from the
// app, so we cannot capture it from outside — html-to-image runs *inside*
// the iframe and posts the resulting data URL back to the parent.
//
// Capture requests that arrive before html-to-image finishes loading are
// queued and flushed once the lib is ready, so callers can fire-and-await
// without any initialisation race.
const SCREENSHOT_SCRIPT = `
;(function () {
  if (window.__designScreenshotInstalled) return;
  window.__designScreenshotInstalled = true;

  var ready = false;
  var libError = null;
  var queue = [];
  // Track in-progress requestIds so duplicate retries don't trigger
  // redundant captures. The parent re-sends when it hasn't heard back yet
  // (bundle still compiling), so we discard any copy after the first.
  var inProgress = {};

  function reply(requestId, payload) {
    parent.postMessage(Object.assign({ requestId: requestId }, payload), '*');
  }

  // Hard ceiling on the captured PNG's longest edge (in device pixels).
  // 4096 fits cleanly inside Anthropic (8000² hard cap), OpenAI Responses
  // (tiles long edges ~2048 internally — anything bigger is downsampled
  // before charging), and Gemini (7680×4320). For pages taller than this
  // we drop pixelRatio so the output stays under the cap rather than
  // truncating the design.
  var MAX_LONGEST_EDGE_PX = 4096;

  function runCapture(req) {
    var requestId = req.requestId;
    if (inProgress[requestId]) return; // duplicate retry — already handling
    inProgress[requestId] = true;
    var pixelRatio = req.pixelRatio;
    var crop = req.crop;
    var fullPage = !!req.fullPage;

    var root = document.getElementById('root') || document.body;
    var bg = (window.getComputedStyle(document.body).backgroundColor || '').trim();
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ffffff';

    // Default capture options match the original behaviour (viewport-sized,
    // honours #root height:100%). Full-page mode swaps these out for explicit
    // width/height that span the entire scroll extent, plus a style override
    // so the cloned tree expands to full height instead of staying clipped at
    // the viewport.
    var captureOpts = { cacheBust: true, pixelRatio: pixelRatio, backgroundColor: bg };
    if (fullPage) {
      var docEl = document.documentElement;
      var body = document.body;
      var fullWidth = Math.max(
        root.scrollWidth, root.offsetWidth,
        docEl.scrollWidth, docEl.clientWidth,
        body.scrollWidth, body.offsetWidth
      ) || root.clientWidth || 1;
      var fullHeight = Math.max(
        root.scrollHeight, root.offsetHeight,
        docEl.scrollHeight, docEl.clientHeight,
        body.scrollHeight, body.offsetHeight
      ) || root.clientHeight || 1;
      // Clamp pixelRatio so width × pr (or height × pr) never exceeds the
      // provider-safe ceiling. Allows arbitrarily tall designs at the cost
      // of slightly fuzzier text — way better than truncating the page.
      var longestCss = Math.max(fullWidth, fullHeight);
      var maxRatio = MAX_LONGEST_EDGE_PX / Math.max(1, longestCss);
      captureOpts.pixelRatio = Math.min(pixelRatio || 2, maxRatio);
      captureOpts.width = fullWidth;
      captureOpts.height = fullHeight;
      captureOpts.style = {
        height: fullHeight + 'px',
        maxHeight: 'none',
        overflow: 'visible',
      };
    }

    window.htmlToImage
      .toPng(root, captureOpts)
      .then(function (dataUrl) {
        // Full-page captures cover the entire document; the crop region is
        // expressed in viewport CSS pixels so the math wouldn't line up.
        // Treat fullPage as authoritative and return the uncropped PNG.
        if (!crop || fullPage) {
          delete inProgress[requestId];
          reply(requestId, { type: 'design-screenshot:result', dataUrl: dataUrl });
          return;
        }
        var img = new Image();
        img.onload = function () {
          var rootRect = root.getBoundingClientRect();
          var scaleX = img.naturalWidth / Math.max(1, rootRect.width);
          var scaleY = img.naturalHeight / Math.max(1, rootRect.height);
          var rootLocalX = (crop.x + (window.scrollX || 0)) - rootRect.left;
          var rootLocalY = (crop.y + (window.scrollY || 0)) - rootRect.top;
          var sx = Math.max(0, rootLocalX * scaleX);
          var sy = Math.max(0, rootLocalY * scaleY);
          var sw = Math.min(img.naturalWidth - sx, Math.max(0, crop.width) * scaleX);
          var sh = Math.min(img.naturalHeight - sy, Math.max(0, crop.height) * scaleY);
          if (sw < 4 || sh < 4) {
            delete inProgress[requestId];
            reply(requestId, { type: 'design-screenshot:error', error: 'Selection too small' });
            return;
          }
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(sw);
          canvas.height = Math.round(sh);
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            delete inProgress[requestId];
            reply(requestId, { type: 'design-screenshot:error', error: 'Canvas unsupported' });
            return;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          delete inProgress[requestId];
          reply(requestId, { type: 'design-screenshot:result', dataUrl: canvas.toDataURL('image/png') });
        };
        img.onerror = function () {
          delete inProgress[requestId];
          reply(requestId, { type: 'design-screenshot:error', error: 'Image load failed' });
        };
        img.src = dataUrl;
      })
      .catch(function (err) {
        delete inProgress[requestId];
        reply(requestId, { type: 'design-screenshot:error', error: String(err && err.message ? err.message : err) });
      });
  }

  function onReady() {
    ready = true;
    parent.postMessage({ type: 'design-screenshot:ready' }, '*');
    var pending = queue.splice(0);
    for (var i = 0; i < pending.length; i++) runCapture(pending[i]);
  }

  function onLibError() {
    libError = 'Failed to load html-to-image from CDN';
    parent.postMessage({ type: 'design-screenshot:error', error: libError }, '*');
    var pending = queue.splice(0);
    for (var i = 0; i < pending.length; i++) reply(pending[i].requestId, { type: 'design-screenshot:error', error: libError });
  }

  function loadLib() {
    if (window.htmlToImage) { onReady(); return; }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js';
    s.async = true;
    s.onload = onReady;
    s.onerror = onLibError;
    document.head.appendChild(s);
  }

  if (document.readyState === 'complete') loadLib();
  else window.addEventListener('load', loadLib, { once: true });

  window.addEventListener('message', function (ev) {
    // Only accept capture requests from our parent (the workspace app).
    // The Sandpack iframe is cross-origin from the parent, so a sibling
    // iframe or a popup window has no business commanding it to render
    // a screenshot of the user's design and post it back.
    if (ev.source !== window.parent) return;
    var data = ev.data;
    if (!data || data.type !== 'design-screenshot:request') return;
    var req = {
      requestId: data.requestId,
      pixelRatio: typeof data.pixelRatio === 'number' ? data.pixelRatio : 2,
      // Optional: { x, y, width, height } in iframe-viewport CSS pixels. When
      // present, the iframe crops the captured PNG to that region before
      // replying — this is how the canvas "select area" tool works without
      // having to ship a blank parent-side capture across the postMessage gap.
      crop: data.crop && typeof data.crop === 'object' ? data.crop : null,
      // When true, capture the FULL scroll extent of the design instead of
      // just the visible iframe viewport. Used by the agent's self-critique
      // screenshot so it sees the whole page, not just the first screen.
      // Incompatible with crop (full-page capture is in document coords,
      // crop is in viewport coords) — we ignore crop when fullPage is set.
      fullPage: data.fullPage === true,
    };
    if (libError) { reply(req.requestId, { type: 'design-screenshot:error', error: libError }); return; }
    if (ready) runCapture(req);
    else {
      // Deduplicate: if this requestId is already queued, drop the retry.
      var alreadyQueued = false;
      for (var i = 0; i < queue.length; i++) {
        if (queue[i].requestId === req.requestId) { alreadyQueued = true; break; }
      }
      if (!alreadyQueued) queue.push(req);
    }
  });

  // Late subscribers (e.g. an export dialog that mounts after the iframe
  // already finished booting) can ask whether they missed the :ready ping.
  // Same parent-only restriction applies.
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) return;
    if (!ev.data || ev.data.type !== 'design-screenshot:are-you-ready') return;
    if (ready) parent.postMessage({ type: 'design-screenshot:ready' }, '*');
    else if (libError) parent.postMessage({ type: 'design-screenshot:error', error: libError }, '*');
  });
})();
`;

// While the drawing overlay covers the iframe with `pointer-events: auto`
// (so it can receive draws), wheel events fire on the SVG instead of the
// iframe — meaning the iframe's internal scroll never moves and the user is
// stuck. The overlay's onWheel handler forwards the delta here so we can
// scroll the iframe window manually. We accept a `target` selector for
// designs whose scrolling content lives in a non-window element, but fall
// back to the window itself which covers the common case.
const SCROLL_RELAY_SCRIPT = `
;(function () {
  if (window.__designScrollRelayInstalled) return;
  window.__designScrollRelayInstalled = true;

  function pickTarget() {
    // Prefer the document scroller when there's content to scroll;
    // otherwise look for the first descendant with overflow scroll/auto
    // that is actually scrollable. Most React apps just use the window.
    var el = document.scrollingElement || document.documentElement;
    if (el && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
      return el;
    }
    var candidates = document.querySelectorAll('*');
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var cs = window.getComputedStyle(c);
      var oy = cs.overflowY, ox = cs.overflowX;
      var canScroll =
        ((oy === 'auto' || oy === 'scroll') && c.scrollHeight > c.clientHeight) ||
        ((ox === 'auto' || ox === 'scroll') && c.scrollWidth > c.clientWidth);
      if (canScroll) return c;
    }
    return el;
  }

  window.addEventListener('message', function (ev) {
    var data = ev.data;
    if (!data || data.type !== 'design-scroll') return;
    var dx = Number(data.deltaX) || 0;
    var dy = Number(data.deltaY) || 0;
    if (!dx && !dy) return;
    var target = pickTarget();
    if (!target) return;
    if (typeof target.scrollBy === 'function') {
      target.scrollBy({ left: dx, top: dy, behavior: 'auto' });
    } else {
      target.scrollLeft += dx;
      target.scrollTop += dy;
    }
  });
})();
`;

const TAGGER_SCRIPT = `
;(function () {
  if (window.__designTaggerInstalled) return;
  window.__designTaggerInstalled = true;

  function pathOf(el) {
    if (!(el instanceof Element)) return '';
    const segs = [];
    while (el && el.nodeType === 1 && segs.length < 6) {
      let s = el.nodeName.toLowerCase();
      if (el.id) { s += '#' + el.id; segs.unshift(s); break; }
      const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const parent = el.parentElement;
      if (parent) {
        const idx = Array.prototype.indexOf.call(parent.children, el) + 1;
        s += ':nth-child(' + idx + ')';
      }
      segs.unshift(s);
      el = el.parentElement;
    }
    return segs.join(' > ');
  }

  // Map a few HTML tags to a friendlier word for the chip label. Anything
  // not in here just uses the lowercase tag name as-is ("div", "section", …).
  const TAG_LABEL = {
    img: 'image', svg: 'icon', a: 'link', hr: 'divider',
    ul: 'list', ol: 'list', li: 'list item',
    h1: 'heading', h2: 'heading', h3: 'heading',
    h4: 'heading', h5: 'heading', h6: 'heading',
  };

  function tagLabel(el) {
    const tag = el.nodeName.toLowerCase();
    return TAG_LABEL[tag] || tag;
  }

  // Pick a short, human-friendly label for a tagged element. We deliberately
  // do NOT use textContent on containers — that concatenates every
  // descendant's text and turns a tagged "Order summary" card into a
  // 200-character soup of "Order summary 🎧 Wireless Headphones Qty 1 …".
  //
  // Priority:
  //   1. aria-label / title (explicit accessible label)
  //   2. placeholder / value (form controls)
  //   3. The element's OWN text — if it has direct text-node children, we
  //      take its full textContent (this keeps small inline siblings like
  //      <strong> intact while excluding sub-containers).
  //   4. The first descendant element that satisfies (3), recursively.
  //      This naturally surfaces the heading of a card or the label of a
  //      pill of icons + text.
  //   5. The element's tag name (mapped to a friendlier word for a few
  //      common tags) — so a textless container still gets "div", "image",
  //      etc. instead of an empty chip.
  function labelOf(el, depth) {
    if (!(el instanceof Element)) return '';
    if (depth > 6) return tagLabel(el);

    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria.slice(0, 80);
    const title = (el.getAttribute('title') || '').trim();
    if (title) return title.slice(0, 80);

    const tag = el.nodeName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const v = (el.value || '').toString().trim();
      if (v) return v.slice(0, 80);
      const ph = (el.getAttribute('placeholder') || '').trim();
      if (ph) return ph.slice(0, 80);
    }
    if (tag === 'img') {
      const alt = (el.getAttribute('alt') || '').trim();
      if (alt) return alt.slice(0, 80);
    }

    let hasDirectText = false;
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i];
      if (n.nodeType === 3 && (n.nodeValue || '').trim()) {
        hasDirectText = true;
        break;
      }
    }
    if (hasDirectText) {
      return (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
    }

    for (let i = 0; i < el.children.length; i++) {
      const childLabel = labelOf(el.children[i], (depth || 0) + 1);
      if (childLabel) return childLabel;
    }

    return tagLabel(el);
  }

  function setHighlight(el) {
    document.querySelectorAll('[data-design-tag-hover]')
      .forEach((n) => n.removeAttribute('data-design-tag-hover'));
    if (el && el !== document.body && el !== document.documentElement) {
      el.setAttribute('data-design-tag-hover', '');
    }
  }

  let active = false;

  window.addEventListener('message', (ev) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'design-tagger:set') {
      active = !!data.active;
      if (!active) setHighlight(null);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!active) return;
    setHighlight(e.target);
  });

  document.addEventListener('click', (e) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    const selector = pathOf(target);
    const text = labelOf(target, 0);
    parent.postMessage({ type: 'design-tagger:click', selector, text }, '*');
    // Stay in highlight mode so the user can tag several elements in a row.
    // Toolbar button (or ⌘⇧H) exits the mode; mousemove will refresh the
    // hover outline on the next element they pass over.
    setHighlight(null);
  }, true);

  const style = document.createElement('style');
  style.textContent = '[data-design-tag-hover]{outline:2px solid rgba(59,130,246,.7) !important; outline-offset:2px;cursor:crosshair !important}';
  document.head.appendChild(style);
})();
`;

const INDEX_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
${TAGGER_SCRIPT}
${SCREENSHOT_SCRIPT}
${SCROLL_RELAY_SCRIPT}
`;

// Sandpack's `react-ts` template ships with a broken default package.json
// that pins react@19 alongside react-scripts@4 and typescript@4 — which
// don't resolve together and cause the bundler to hang silently. We
// replace it wholesale with a known-good React 18 stack.
const PACKAGE_JSON = JSON.stringify(
  {
    main: "/index.tsx",
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "lucide-react": "^0.469.0",
    },
    devDependencies: {
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      typescript: "^4.9.5",
    },
  },
  null,
  2,
);

/**
 * Paths Sandpack needs to boot the iframe but the user never edits — the
 * agent's `designFiles` should never delete or overwrite these. Exported so
 * `<DesignerInternals/>`'s file-sync effect can use the same allowlist when
 * deciding which files are safe to delete on a server push.
 *
 * We can't rely on `sandpack.files[path]?.hidden` for this: Sandpack's own
 * `addPackageJSONIfNeeded` rewrites `/package.json` during init and drops
 * the `hidden` flag in the process, which previously caused the cleanup
 * loop to delete it — and the next bundler refresh then threw
 * `"dependencies" was not specified - provide either a package.json or a
 * "dependencies" value`.
 */
export const SANDPACK_RUNTIME_PATHS: ReadonlySet<string> = new Set([
  "/public/index.html",
  "/index.tsx",
  "/package.json",
]);

export function buildSandpackFiles(designFiles: DesignFileDTO[]): SandpackFiles {
  const files: SandpackFiles = {
    "/public/index.html": { code: TAILWIND_INDEX_HTML, hidden: true },
    "/index.tsx": { code: INDEX_TSX, hidden: true },
    "/package.json": { code: PACKAGE_JSON, hidden: true },
  };
  for (const f of designFiles) {
    if (SANDPACK_RUNTIME_PATHS.has(f.path)) continue;
    files[f.path] = { code: f.content };
  }
  if (!files["/App.tsx"]) {
    files["/App.tsx"] = {
      code: `export default function App() { return <div className="p-8 text-neutral-500">Empty design</div>; }\n`,
    };
  }
  return files;
}
