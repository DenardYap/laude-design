import type { UIMessagePart, UIDataTypes, UITools } from "ai";
import type { ApiKeySummary } from "@/lib/workspace/types";

export type ComposerSendParts = UIMessagePart<UIDataTypes, UITools>[];

export interface ComposerProps {
  projectId: string;
  sessionId: string;
  apiKeys: ApiKeySummary[];
  /** True while a turn is in flight (submitted or streaming). Disables Send / Enter. */
  streaming: boolean;
  onSend: (parts: ComposerSendParts) => void;
  /** Abort the in-flight turn. Required when `streaming` is true. */
  onStop: () => void;
  /** Upload handler provided by the parent panel. */
  uploadFiles: (files: File[]) => void;
  /** True while any upload is in flight. */
  uploadPending: boolean;
}

export interface ComposerHandle {
  focus: () => void;
}
