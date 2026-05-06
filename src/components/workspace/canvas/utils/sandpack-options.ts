export const SCREENSHOT_FRAME_WIDTH = 1280;
export const SCREENSHOT_FRAME_HEIGHT = 800;

export const SANDPACK_CUSTOM_SETUP = { entry: "/index.tsx" } as const;
export const SANDPACK_OPTIONS = {
  classes: { "sp-preview-iframe": "sp-preview-iframe" },
  recompileMode: "delayed" as const,
  recompileDelay: 250,
  externalResources: ["https://cdn.tailwindcss.com"],
};
