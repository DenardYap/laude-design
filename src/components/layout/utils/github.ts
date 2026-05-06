export const GITHUB_REPO = "DenardYap/laude-design";

export function formatStarCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return count.toLocaleString();
}

/**
 * Fetch the repo star count from the GitHub API.
 *
 * Pass `revalidate` (seconds) when calling from a server component so
 * Next.js caches the result and only hits GitHub once per window. Without
 * a revalidate interval the default is `force-cache` (indefinite), which
 * is fine for a build-time fetch but unsuitable for a layout that renders
 * on every request.
 *
 * Omit `revalidate` when calling from the client — React Query handles
 * client-side caching via `staleTime`.
 */
export async function fetchStarCount(revalidate?: number): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = (await res.json()) as { stargazers_count: number };
  return data.stargazers_count;
}
