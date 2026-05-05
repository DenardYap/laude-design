import type { RefObject } from "react";
import type { UIMessagePart, UIDataTypes, UITools } from "ai";

export type ComposerSendParts = UIMessagePart<UIDataTypes, UITools>[];

export interface ComposerProps {
  projectId: string;
  sessionId: string;
  onSend: (parts: ComposerSendParts) => void;
  /** Upload handler provided by the parent panel. */
  uploadFiles: (files: File[]) => void;
  /** True while any upload is in flight. */
  uploadPending: boolean;
}

export interface ComposerHandle {
  focus: () => void;
}

// ---------------------------------------------------------------------------
// ComposerToolbar — reads streaming/canSend/stop directly from store
// ---------------------------------------------------------------------------

export interface ComposerToolbarProps {
  projectId: string;
  sessionId: string;
  uploadPending: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSend: () => void;
}
