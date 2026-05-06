interface SkillContentPreviewProps {
  name: string;
  content: string;
}

export function SkillContentPreview({ name, content }: SkillContentPreviewProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-xs text-ink-muted">
        <span className="font-mono">{name}</span>
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-ink">
        {content}
      </pre>
    </div>
  );
}
