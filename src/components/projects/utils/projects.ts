import type { RecencyBucket } from "@/components/projects/types/projects";

export function bucketByRecency(updatedAt: Date | string, now: number): RecencyBucket {
  const ts = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  const ageMs = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return "today";
  if (ageMs < 7 * day) return "week";
  if (ageMs < 30 * day) return "month";
  return "older";
}
