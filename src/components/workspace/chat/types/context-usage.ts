export interface ContextUsageIndicatorProps {
  projectId: string;
  sessionId: string;
}

export interface UsageRingProps {
  ratio: number;
  className?: string;
}

export interface UsageRowProps {
  label: string;
  value: string;
}
