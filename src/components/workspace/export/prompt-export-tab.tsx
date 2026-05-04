"use client";

import { useMemo, useState } from 'react';
import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";

import type { DesignDTO } from "@/lib/workspace/types";
import { Button, Textarea } from "@/components/ui";
import { buildExportPrompt } from "@/components/workspace/export/build-export-prompt";

interface PromptExportTabProps {
  design: DesignDTO;
}

export function PromptExportTab({ design }: PromptExportTabProps) {
  const text = useMemo(() => buildExportPrompt({ design }), [design]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied prompt to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadFile() {
    const blob = new Blob([text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${design.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-muted">
          Give you coding agents like Cursor a pointer on how to recreate this
          design.
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadFile}
            className="gap-1 text-xs"
          >
            <Download className="size-3.5" />
            .md
          </Button>
          <Button variant="primary" size="sm" onClick={copy} className="gap-1">
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      </div>
      <Textarea
        readOnly
        value={text}
        className="h-[420px] resize-none font-mono text-xs"
      />
    </div>
  );
}
