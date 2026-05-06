"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, Skeleton, SkillMark } from "@/components/ui";
import { SortMenu } from "@/components/shared/sort-menu";
import { TablePagination } from "@/components/shared/pagination";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { PublicSkillRow } from "@/components/skills/public-skill-row";
import { SkillTableHeader } from "@/components/skills/skill-table-header";
import { SkillsFilters } from "@/components/skills/skills-filters";
import { hasActiveFilters } from "@/components/skills/utils/skills-filters";
import { SORT_OPTIONS } from "@/components/skills/utils/public-skills";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { EmptyMatch } from "@/components/skills/empty-match";
import { useDebounce } from "@/components/shared/hooks/use-debounce";
import { fetchPublicSkills, skillKeys } from "@/lib/api/skills";
import type { PublicSortKey } from "@/components/skills/types/skill-table";

const COLUMNS = ["Name", "Author", "Saves", "Likes", "Tokens", "Updated"];
const PAGE_SIZE = 25;

export function PublicSkillsTable() {
  const { query, setQuery } = useScopeQuery("skills:public");
  const { values: sizeValues, reset: resetSize } = useScopeDimension("skills:public", "size");
  const { values: authorValues, reset: resetAuthor } = useScopeDimension(
    "skills:public",
    "author",
  );
  const [sortKey, setSortKey] = useState<PublicSortKey>("saves");
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebounce(query, 300);

  // Reset to page 1 whenever filters or sort change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sizeValues, authorValues, sortKey]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    q: debouncedQuery,
    size: sizeValues as string[],
    author: authorValues as string[],
    sort: sortKey,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: skillKeys.public(params),
    queryFn: () => fetchPublicSkills(params),
    // Keep the previous page's data visible while the next page loads
    placeholderData: (prev) => prev,
  });

  const filtersActive = hasActiveFilters(query, [sizeValues, authorValues]);

  if (isLoading && !data) {
    return <TableSkeleton />;
  }

  if (isError) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        Failed to load skills. Please refresh and try again.
      </p>
    );
  }

  const skills = data?.skills ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  if (total === 0 && !filtersActive && !isLoading) {
    return (
      <EmptyState
        icon={<SkillMark className="size-10" />}
        title="No public skills yet"
        description="Skills shared publicly help others get a head start. Upload one and toggle it public from its detail page to be the first."
        action={<SkillUploader />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        ⚠️ Beware of malicious skill files — always double-check the skill&apos;s content before
        saving and using it.
      </p>

      <SkillsFilters
        scope="skills:public"
        searchPlaceholder="Search public skills..."
        showAuthor
        trailing={<SortMenu value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />}
      />

      {skills.length === 0 ? (
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
            {skills.map((s, i) => (
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

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="ml-auto h-9 w-24" />
      </div>
      <div className="space-y-px overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
