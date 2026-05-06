"use client";

import { Loader2 } from "lucide-react";

import type { UploadedFile } from "@/lib/api/uploads";
import {
  EMPTY_ATTACHMENTS,
  EMPTY_TAGS,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import { TagChip } from "@/components/workspace/chat/tag-chip";
import { AttachmentChip } from "@/components/workspace/chat/attachment-chip";

interface ComposerAttachmentsStripProps {
  sessionId: string;
  uploadPending: boolean;
}

export function ComposerAttachmentsStrip({
  sessionId,
  uploadPending,
}: ComposerAttachmentsStripProps) {
  const pending = useWorkspaceStore(
    (s) => s.pendingAttachmentsBySession[sessionId] ?? EMPTY_ATTACHMENTS,
  );
  const pendingTags = useWorkspaceStore(
    (s) => s.pendingTagsBySession[sessionId] ?? EMPTY_TAGS,
  );
  const removeAttachment = useWorkspaceStore((s) => s.removePendingAttachment);
  const removeTag = useWorkspaceStore((s) => s.removePendingTag);

  if (pending.length === 0 && pendingTags.length === 0 && !uploadPending)
    return null;

  return (
    <div className="scrollbar-hide max-h-[120px] overflow-y-auto px-2 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {pendingTags.map((t) => (
          <TagChip
            key={t.id}
            tag={t}
            onRemove={() => removeTag(sessionId, t.id)}
          />
        ))}
        {pending.map((a: UploadedFile) => (
          <AttachmentChip
            key={a.url}
            file={a}
            onRemove={() => removeAttachment(sessionId, a.url)}
          />
        ))}
        {uploadPending && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-ink-muted">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Uploading…</span>
          </div>
        )}
      </div>
    </div>
  );
}
