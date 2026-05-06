import { db } from "@/lib/db";

/**
 * Per-user resource caps. Counted across the user's *entire* account, not
 * per-project — they exist to bound the multi-tenant cost of a hosted
 * deployment (DB rows, Vercel Blob storage, search index, etc.) and to
 * make it impossible for a single user (or a runaway agent loop they
 * triggered) to balloon the dataset for everyone.
 *
 * Numbers are deliberately conservative for the current launch surface;
 * tweak in this one place when usage tells us otherwise.
 */
export const RESOURCE_LIMITS = {
  designs: 500,
  folders: 100,
  skills: 100,
} as const;

export type ResourceKind = keyof typeof RESOURCE_LIMITS;

const HUMAN_LABEL: Record<ResourceKind, string> = {
  designs: "design",
  folders: "folder",
  skills: "skill",
};

/**
 * Thrown when a create call would push the caller over their resource cap.
 * Server Actions surface the message verbatim to the user via toast; the
 * LLM tool layer surfaces it to the model so it can stop trying instead
 * of looping. The `kind` is exposed so callers can branch on it (e.g.
 * to render a CTA to delete old designs).
 */
export class ResourceLimitExceededError extends Error {
  constructor(
    public readonly kind: ResourceKind,
    public readonly limit: number,
    public readonly current: number,
  ) {
    const noun = HUMAN_LABEL[kind];
    super(
      `You've reached the ${limit}-${noun} limit for this account (${current}/${limit}). ` +
        `Delete some existing ${noun}s before creating another.`,
    );
    this.name = "ResourceLimitExceededError";
  }
}

/**
 * Throws if creating one more row of `kind` would exceed the cap. Always
 * call this BEFORE the `db.*.create` so a successful return guarantees
 * we're at most at `limit - 1` going in.
 *
 * NOTE: this is a check-then-act race-windowed against itself — two
 * parallel calls at `limit - 1` could both pass and create the
 * `limit + 1`'th row. The window is single-digit milliseconds against
 * a single user's own concurrent traffic, and the cap is a soft cost
 * bound rather than a security boundary, so we accept the slop instead
 * of paying for a serializable transaction or an advisory lock on every
 * create.
 */
export async function assertWithinLimit(
  userId: string,
  kind: ResourceKind,
): Promise<void> {
  const limit = RESOURCE_LIMITS[kind];
  const current = await countForUser(userId, kind);
  if (current >= limit) {
    throw new ResourceLimitExceededError(kind, limit, current);
  }
}

async function countForUser(
  userId: string,
  kind: ResourceKind,
): Promise<number> {
  switch (kind) {
    case "designs":
      // Counted across every project the user owns. The join through
      // `project: { userId }` keeps the count scoped to this user even
      // though Design rows aren't directly user-owned.
      return db.design.count({ where: { project: { userId } } });
    case "folders":
      return db.folder.count({ where: { project: { userId } } });
    case "skills":
      return db.skill.count({ where: { userId } });
  }
}
