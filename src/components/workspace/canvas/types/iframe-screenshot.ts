export interface IframeScreenshotCrop {
  /** All in iframe-local CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IframeScreenshotReply {
  dataUrl?: string;
  error?: string;
}

export interface IframeScreenshotRequestOpts {
  pixelRatio?: number;
  crop?: IframeScreenshotCrop;
  /**
   * When true, capture the FULL scroll extent of the design rather than just
   * the visible iframe viewport. Used by the agent's self-critique screenshot
   * so a long landing page is reviewed end-to-end instead of one screen at a
   * time. The iframe automatically caps the longest device-pixel edge at
   * 4096 px (provider-safe across Anthropic / OpenAI / Gemini) by dialing
   * down `pixelRatio` for very tall pages. Ignores `crop` if also set.
   */
  fullPage?: boolean;
}
