import type { ReactNode, SVGProps } from "react";

import type { AiProvider } from "@/lib/validators";

export type IconProps = SVGProps<SVGSVGElement>;

export interface ProviderConfig {
  provider: AiProvider;
  /** Display name — what users actually search for (e.g. "Anthropic"). */
  name: string;
  placeholder: string;
  /** Direct URL to the provider's API-key page. Opens in a new tab. */
  docsUrl: string;
  /** Friendly name of the destination dashboard ("Anthropic Console", etc). */
  dashboardLabel: string;
  /** Brand icon for the provider. */
  icon: ReactNode;
}

export interface ExistingKey {
  lastFour: string;
}

export interface ApiKeyRowProps {
  config: ProviderConfig;
}

export interface ApiKeysListProps {
  providers: ProviderConfig[];
}
