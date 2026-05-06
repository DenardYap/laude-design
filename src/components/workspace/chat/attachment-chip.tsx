"use client";

import type { AttachmentChipProps } from "@/components/workspace/chat/types/misc";
import { ImageAttachmentChip } from "@/components/workspace/chat/image-attachment-chip";
import { FileAttachmentChip } from "@/components/workspace/chat/file-attachment-chip";

export function AttachmentChip({ file, onRemove }: AttachmentChipProps) {
  if (file.mimeType.startsWith("image/")) {
    return <ImageAttachmentChip file={file} onRemove={onRemove} />;
  }
  return <FileAttachmentChip file={file} onRemove={onRemove} />;
}
