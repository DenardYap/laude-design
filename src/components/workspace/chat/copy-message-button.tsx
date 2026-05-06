"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui";
import type { CopyMessageButtonProps } from "@/components/workspace/chat/types/messages";

export function CopyMessageButton({ text }: CopyMessageButtonProps) {
  return (
    <IconButton
      aria-label="Copy message"
      className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
      icon={<Copy className="size-3" />}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
    />
  );
}
