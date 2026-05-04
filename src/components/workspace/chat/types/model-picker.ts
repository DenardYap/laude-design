import type { ApiKeySummary, ModelOption, ModelProvider } from "@/lib/workspace/types";

export interface ModelPickerProps {
  projectId: string;
  sessionId: string;
  apiKeys: ApiKeySummary[];
}

export type ProviderFilter = ModelProvider | "ALL";

export interface ProviderFilterRowProps {
  value: ProviderFilter;
  onChange: (value: ProviderFilter) => void;
}

export interface ProviderHeadingProps {
  provider: ModelProvider;
  configured: boolean;
  lastFour?: string;
}

export interface ModelRowProps {
  model: ModelOption;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}
