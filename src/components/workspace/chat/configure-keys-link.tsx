import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { ConfigureKeysLinkProps } from "@/components/workspace/chat/types/messages";

export function ConfigureKeysLink({
  label = "Configure API keys",
}: ConfigureKeysLinkProps) {
  return (
    <Link
      href="/api-keys"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-ink underline-offset-2 hover:underline"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}
