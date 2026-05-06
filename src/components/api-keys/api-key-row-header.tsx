"use client";

import { Check, Clock, ExternalLink, Trash2 } from "lucide-react";

import { Button, ButtonLink, IconBadge, IconButton, Pill } from "@/components/ui";
import { formatExpiry } from "@/lib/api-keys/expiry";
import type { ApiKeyRowHeaderProps } from "@/components/api-keys/types/api-keys";

export function ApiKeyRowHeader({
  config,
  existing,
  editing,
  onStartEditing,
  onCancelEditing,
  onDeleteClick,
}: ApiKeyRowHeaderProps) {
  const expiryLabel = existing ? formatExpiry(existing.expiresAt) : null;

  return (
    <div className="flex items-center gap-3">
      <IconBadge tone="neutral" size="md" icon={config.icon} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-ink">{config.name}</span>
        {existing ? (
          <Pill tone="success">
            <Check />
            Configured
          </Pill>
        ) : (
          <Pill tone="neutral">Not configured</Pill>
        )}
        {existing && !editing ? (
          <span className="font-mono text-xs text-ink-muted">••••{existing.lastFour}</span>
        ) : null}
        {existing && !editing && expiryLabel ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <Clock className="size-3" aria-hidden />
            {expiryLabel}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ButtonLink
          href={config.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          size="sm"
          aria-label={`Open ${config.dashboardLabel} (new tab)`}
        >
          <ExternalLink className="size-3.5" />
          Get key
        </ButtonLink>
        {!editing ? (
          <>
            <Button variant="outline" size="sm" onClick={onStartEditing}>
              {existing ? "Replace" : "Add key"}
            </Button>
            {existing ? (
              <IconButton
                aria-label={`Delete ${config.name} key`}
                onClick={onDeleteClick}
                icon={<Trash2 className="size-4 text-destructive" />}
              />
            ) : null}
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onCancelEditing}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
