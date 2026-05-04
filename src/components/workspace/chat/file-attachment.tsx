import { ClickableImage } from "@/components/shared/clickable-image";

export function FileAttachment({
  mediaType,
  url,
  filename,
}: {
  mediaType: string;
  url: string;
  filename?: string;
}) {
  if (mediaType.startsWith("image/")) {
    return (
      <ClickableImage
        src={url}
        alt={filename ?? "attachment"}
        className="my-1 max-h-48 rounded-md border border-border"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="my-1 inline-block rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-sunken"
    >
      {filename ?? mediaType}
    </a>
  );
}
