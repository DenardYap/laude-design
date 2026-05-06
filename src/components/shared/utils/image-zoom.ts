export const IMG_ZOOM_STEP = 0.25;
export const IMG_ZOOM_MIN = 0.25;
export const IMG_ZOOM_MAX = 4;

/** Natural image heights taller than this trigger vertical scrolling. */
export const IMG_MAX_HEIGHT = 800;

export const clampZoom = (z: number) =>
  Math.min(IMG_ZOOM_MAX, Math.max(IMG_ZOOM_MIN, z));
