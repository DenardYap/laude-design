import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface SkillClonedFromBannerProps {
  originalId: string;
}

export function SkillClonedFromBanner({ originalId }: SkillClonedFromBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken/40 px-3 py-2 text-xs text-ink-muted">
      <span>Added from the public library — your copy is independent of the original.</span>
      <Link
        href={`/skills/${originalId}`}
        className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
      >
        View original
        <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}
