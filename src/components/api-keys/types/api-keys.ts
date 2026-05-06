import type { ReactNode, SVGProps } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { AiProvider, ApiKeyInput, ApiKeyLifetime } from "@/lib/validators";

export type IconProps = SVGProps<SVGSVGElement>;

export interface ProviderConfig {
  provider: AiProvider;
  name: string;
  placeholder: string;
  docsUrl: string;
  dashboardLabel: string;
  icon: ReactNode;
}

export interface ExistingKey {
  lastFour: string;
  /** ISO timestamp of auto-expiry, or null when "never". */
  expiresAt: string | null;
}

export interface ApiKeyRowProps {
  config: ProviderConfig;
  existing: ExistingKey | undefined;
}

export interface ApiKeysListProps {
  providers: ProviderConfig[];
  existingByProvider: Map<AiProvider, ExistingKey>;
}

export interface LifetimePickerProps {
  value: ApiKeyLifetime;
  onChange: (next: ApiKeyLifetime) => void;
  providerName: string;
}

export type ApiKeyRowHeaderProps = {
  config: ProviderConfig;
  existing: ExistingKey | undefined;
  editing: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onDeleteClick: () => void;
};

export type ApiKeyEditFormProps = {
  config: ProviderConfig;
  form: UseFormReturn<ApiKeyInput>;
  showSecret: boolean;
  onToggleSecret: () => void;
  onSubmit: (values: ApiKeyInput) => void;
};
