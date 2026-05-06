"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { PROVIDER_LABEL } from "@/lib/workspace/utils/models";
import type { ProviderHeadingProps } from "@/components/workspace/chat/types/model-picker";

export function ProviderHeading({ provider, configured, lastFour }: ProviderHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{PROVIDER_LABEL[provider]}</span>
      {configured ? (
        <span className="font-mono text-[10px] text-ink-subtle">
          •••• {lastFour}
        </span>
      ) : (
        <Link
          href={`/api-keys?provider=${provider}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-warning hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3" />
          Configure
          <ExternalLink className="size-2.5 opacity-70" />
        </Link>
      )}
    </div>
  );
}
