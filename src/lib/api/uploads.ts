export type AttachmentKind = "screenshot" | "upload" | "sketch";

export interface UploadedFile {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind?: AttachmentKind;
}

export async function uploadAttachment(projectId: string, file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/projects/${projectId}/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadedFile;
}
