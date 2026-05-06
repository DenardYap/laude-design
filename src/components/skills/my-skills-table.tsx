"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, Skeleton, SkillMark } from "@/components/ui";
import { TablePagination } from "@/components/shared/pagination";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { MineSkillRow } from "@/components/skills/mine-skill-row";
import { SkillTableHeader } from "@/components/skills/skill-table-header";
import { SkillsFilters } from "@/components/skills/skills-filters";
import { hasActiveFilters } from "@/components/skills/utils/skills-filters";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { EmptyMatch } from "@/components/skills/empty-match";
import { useDebounce } from "@/components/shared/hooks/use-debounce";
import { fetchMySkills, skillKeys } from "@/lib/api/skills";

const COLUMNS = ["Name", "Author", "Visibility", "Default", "Tokens", "Updated"];
const PAGE_SIZE = 25;

export function MySkillsTable() {
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
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebounce(query, 300);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, visibilityValues, sizeValues, defaultValues, authorValues]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    q: debouncedQuery,
    visibility: visibilityValues as string[],
    size: sizeValues as string[],
    default: defaultValues as string[],
    author: authorValues as string[],
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: skillKeys.mine(params),
    queryFn: () => fetchMySkills(params),
    placeholderData: (prev) => prev,
  });

  const filtersActive = hasActiveFilters(query, [
    visibilityValues,
    sizeValues,
    defaultValues,
    authorValues,
  ]);

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
        title="No skills yet"
        description="Skills are markdown or text snippets the agent uses as context. Upload your first one to get started."
        action={<SkillUploader />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <SkillsFilters
        scope="skills:mine"
        searchPlaceholder="Search your skills..."
        showVisibility
        showDefault
        showAuthor
      />

      {skills.length === 0 ? (
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
            {skills.map((s, i) => (
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

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="space-y-px overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
