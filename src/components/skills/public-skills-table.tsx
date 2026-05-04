"use client";

import { useMemo, useState } from "react";

import { EmptyState, SkillMark } from "@/components/ui";
import { SortMenu } from "@/components/shared/sort-menu";
import { TablePagination, usePagination } from "@/components/shared/pagination";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { PublicSkillRow } from "@/components/skills/public-skill-row";
import { SkillTableHeader } from "@/components/skills/skill-table-header";
import { SkillsFilters } from "@/components/skills/skills-filters";
import { hasActiveFilters } from "@/components/skills/utils/skills-filters";
import { bucketBySize } from "@/components/skills/utils/skill-size";
import { sortPublicSkills, SORT_OPTIONS } from "@/components/skills/utils/public-skills";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { EmptyMatch } from "@/components/skills/empty-match";
import type { PublicSkillsTableProps, PublicSortKey } from "@/components/skills/types/skill-table";
import type { SkillSizeBucket } from "@/components/skills/types/skills";

const COLUMNS = ["Name", "Author", "Saves", "Likes", "Tokens", "Updated"];
const PAGE_SIZE = 25;

export function PublicSkillsTable({ skills }: PublicSkillsTableProps) {
  const { query, setQuery } = useScopeQuery("skills:public");
  const { values: sizeValues, reset: resetSize } = useScopeDimension("skills:public", "size");
  const { values: authorValues, reset: resetAuthor } = useScopeDimension(
    "skills:public",
    "author",
  );
  // Sort lives in local state — it's a per-tab UI preference that doesn't
  // need to round-trip through the filters store.
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
