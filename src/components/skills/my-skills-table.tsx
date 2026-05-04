"use client";

import { useMemo } from "react";

import { Button, EmptyState, SkillMark } from "@/components/ui";
import { TablePagination, usePagination } from "@/components/shared/pagination";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { MineSkillRow } from "@/components/skills/mine-skill-row";
import { SkillTableHeader } from "@/components/skills/skill-table-header";
import { SkillsFilters } from "@/components/skills/skills-filters";
import { hasActiveFilters } from "@/components/skills/utils/skills-filters";
import { bucketBySize } from "@/components/skills/utils/skill-size";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { EmptyMatch } from "@/components/skills/empty-match";
import type { MySkillsTableProps } from "@/components/skills/types/skill-table";
import type { SkillSizeBucket } from "@/components/skills/types/skills";

const COLUMNS = ["Name", "Author", "Visibility", "Default", "Tokens", "Updated"];
const PAGE_SIZE = 25;

export function MySkillsTable({ skills }: MySkillsTableProps) {
  const { query, setQuery } = useScopeQuery("skills:mine");
  const { values: visibilityValues, reset: resetVisibility } = useScopeDimension(
    "skills:mine",
    "visibility",
  );
  const { values: sizeValues, reset: resetSize } = useScopeDimension("skills:mine", "size");
  const { values: defaultValues, reset: resetDefault } = useScopeDimension(
    "skills:mine",
    "default",
  );
  const { values: authorValues, reset: resetAuthor } = useScopeDimension(
    "skills:mine",
    "author",
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const vis = new Set(visibilityValues);
    const sizes = new Set(sizeValues as SkillSizeBucket[]);
    const defaults = new Set(defaultValues);
    const authors = new Set(authorValues);
    return skills.filter((s) => {
      if (q) {
        const inName = s.name.toLowerCase().includes(q);
        const inDesc = s.description?.toLowerCase().includes(q) ?? false;
        const inAuthor = s.authorName?.toLowerCase().includes(q) ?? false;
        if (!inName && !inDesc && !inAuthor) return false;
      }
      if (vis.size > 0 && !vis.has(s.isPublic ? "public" : "private")) return false;
      if (sizes.size > 0 && !sizes.has(bucketBySize(s.charCount))) return false;
      if (defaults.size > 0 && !defaults.has(s.appliedByDefault ? "on" : "off")) return false;
      if (authors.size > 0 && !authors.has(s.isClone ? "others" : "me")) return false;
      return true;
    });
  }, [skills, query, visibilityValues, sizeValues, defaultValues, authorValues]);

  const { page, setPage, pageItems, total, totalPages, rangeStart, rangeEnd } = usePagination(
    filtered,
    PAGE_SIZE,
  );

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<SkillMark className="size-10" />}
        title="No skills yet"
        description="Skills are markdown or text snippets the agent uses as context. Upload your first one to get started."
        action={<SkillUploader />}
      />
    );
  }

  const filtersActive = hasActiveFilters(query, [
    visibilityValues,
    sizeValues,
    defaultValues,
    authorValues,
  ]);

  return (
    <div className="space-y-3">
      <SkillsFilters
        scope="skills:mine"
        searchPlaceholder="Search your skills..."
        showVisibility
        showDefault
        showAuthor
      />

      {filtered.length === 0 ? (
        <EmptyMatch
          query={query}
          filtersActive={filtersActive}
          onClear={() => {
            setQuery("");
            resetVisibility();
            resetSize();
            resetDefault();
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
              <MineSkillRow key={s.id} skill={s} zebra={i % 2 === 1} />
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
