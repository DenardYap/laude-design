export type AttachmentKind = "screenshot" | "upload" | "sketch";

export interface UploadedFile {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind?: AttachmentKind;
}
