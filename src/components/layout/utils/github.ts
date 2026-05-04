export const GITHUB_REPO = "DenardYap/laude-design";

export function formatStarCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return count.toLocaleString();
}

export async function fetchStarCount(): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
  if (!res.ok) throw new Error("Failed to fetch star count");
  const data = (await res.json()) as { stargazers_count: number };
  return data.stargazers_count;
}
