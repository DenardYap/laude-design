export type ChatError =
  | { type: "api-key-missing"; provider: string }
  | { type: "api-key-invalid"; provider: string }
  | { type: "rate-limit"; provider: string | null }
  | { type: "model-not-found"; modelId: string | null }
  | { type: "network" }
  | { type: "generic"; message: string };
