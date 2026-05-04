"use client";

import { useMemo, useState } from 'react';
import { match } from "ts-pattern";

import { Button, EmptyState, SkillMark } from "@/components/ui";
import { SortMenu, type SortOption } from "@/components/shared/sort-menu";
import { TablePagination, usePagination } from "@/components/shared/pagination";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { PublicSkillRow, SkillTableHeader, type PublicSkill } from "./skill-row";
import { SkillsFilters, hasActiveFilters } from "./skills-filters";
import { bucketBySize, type SkillSizeBucket } from "./skill-size";
import { SkillUploader } from "./skill-uploader";

interface PublicSkillsTableProps {
  skills: PublicSkill[];
}

const COLUMNS = ["Name", "Author", "Saves", "Likes", "Tokens", "Updated"];
const PAGE_SIZE = 25;

type PublicSortKey = "saves" | "likes" | "updated";

const SORT_OPTIONS: ReadonlyArray<SortOption<PublicSortKey>> = [
  { value: "saves", label: "Most saved" },
  { value: "likes", label: "Most liked" },
  { value: "updated", label: "Recently updated" },
];

function sortPublicSkills(skills: PublicSkill[], key: PublicSortKey): PublicSkill[] {
  // The server pre-sorts by saves desc; for that key we don't need to recompute.
  // For stable secondary ordering, fall back to updatedAt desc on ties.
  const ts = (s: PublicSkill) => new Date(s.updatedAt).getTime();
  return [...skills].sort((a, b) => {
    const primary = match(key)
      .with("saves", () => b.saves - a.saves)
      .with("likes", () => b.likes - a.likes)
      .with("updated", () => ts(b) - ts(a))
      .exhaustive();
    return primary !== 0 ? primary : ts(b) - ts(a);
  });
}

export function PublicSkillsTable({ skills }: PublicSkillsTableProps) {
  const { query, setQuery } = useScopeQuery("skills:public");
  const { values: sizeValues, reset: resetSize } = useScopeDimension("skills:public", "size");
  const { values: authorValues, reset: resetAuthor } = useScopeDimension(
    "skills:public",
    "author",
  );
  // Sort lives in local state — it's a per-tab UI preference that doesn't
  // need to round-trip through the filters store (the store is shaped for
  // many-of selections; sort is exactly-one-of).
  const [sortKey, setSortKey] = useState<PublicSortKey>("saves");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sizes = new Set(sizeValues as SkillSizeBucket[]);
    const authors = new Set(authorValues);
    const filtered = skills.filter((s) => {
      if (q) {
        const inName = s.name.toLowerCase().includes(q);
        const inDesc = s.description?.toLowerCase().includes(q) ?? false;
        const inAuthor = s.authorName?.toLowerCase().includes(q) ?? false;
        if (!inName && !inDesc && !inAuthor) return false;
      }
      if (sizes.size > 0 && !sizes.has(bucketBySize(s.charCount))) return false;
      if (authors.size > 0 && !authors.has(s.isMine ? "me" : "others")) return false;
      return true;
    });
    return sortPublicSkills(filtered, sortKey);
  }, [skills, query, sizeValues, authorValues, sortKey]);

  const { page, setPage, pageItems, total, totalPages, rangeStart, rangeEnd } = usePagination(
    visible,
    PAGE_SIZE,
  );

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<SkillMark className="size-10" />}
        title="No public skills yet"
        description="Skills shared publicly help others get a head start. Upload one and toggle it public from its detail page to be the first."
        action={<SkillUploader />}
      />
    );
  }

  const filtersActive = hasActiveFilters(query, [sizeValues, authorValues]);

  return (
    <div className="space-y-3">
      <SkillsFilters
        scope="skills:public"
        searchPlaceholder="Search public skills..."
        showAuthor
        trailing={<SortMenu value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />}
      />

      {visible.length === 0 ? (
        <EmptyMatch
          query={query}
          filtersActive={filtersActive}
          onClear={() => {
            setQuery("");
            resetSize();
            resetAuthor();
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <ul
            className="grid"
            style={{ gridTemplateColumns: "minmax(0,1fr) auto auto auto auto auto" }}
          >
            <SkillTableHeader columns={COLUMNS} colSpan={6} />
            {pageItems.map((s, i) => (
              <PublicSkillRow key={s.id} skill={s} zebra={i % 2 === 1} />
            ))}
          </ul>
          <TablePagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            onPageChange={setPage}
            itemLabel="skill"
            className="border-t border-border"
          />
        </div>
      )}
    </div>
  );
}

interface EmptyMatchProps {
  query: string;
  filtersActive: boolean;
  onClear: () => void;
}

function EmptyMatch({ query, filtersActive, onClear }: EmptyMatchProps) {
  const reason = match({ hasQuery: query.trim().length > 0, filtersActive })
    .with({ hasQuery: true, filtersActive: true }, () => "No skills match your search and filters.")
    .with({ hasQuery: true, filtersActive: false }, () => "No skills match your search.")
    .with({ hasQuery: false, filtersActive: true }, () => "No skills match the active filters.")
    .otherwise(() => "No skills.");
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-6 text-sm text-ink-muted">
      <span>{reason}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
