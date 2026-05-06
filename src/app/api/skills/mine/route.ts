import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function parseList(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function sizeConditions(buckets: string[]): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (buckets.includes("small"))
    clauses.push(Prisma.sql`CHAR_LENGTH(s.content) < 4000`);
  if (buckets.includes("medium"))
    clauses.push(Prisma.sql`(CHAR_LENGTH(s.content) >= 4000 AND CHAR_LENGTH(s.content) < 20000)`);
  if (buckets.includes("large"))
    clauses.push(Prisma.sql`CHAR_LENGTH(s.content) >= 20000`);
  return clauses;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(sp.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10)),
  );
  const q = sp.get("q")?.trim() ?? "";
  const visibility = parseList(sp.get("visibility"));
  const sizes = parseList(sp.get("size"));
  const defaults = parseList(sp.get("default"));
  const authors = parseList(sp.get("author"));

  const conditions: Prisma.Sql[] = [Prisma.sql`s."userId" = ${userId}`];

  if (q) {
    const like = `%${q}%`;
    conditions.push(
      Prisma.sql`(s.name ILIKE ${like} OR s.description ILIKE ${like} OR ou.name ILIKE ${like})`,
    );
  }

  // Only apply when one of the two options is selected; both selected = no-op
  if (visibility.length > 0 && visibility.length < 2) {
    conditions.push(
      visibility.includes("public")
        ? Prisma.sql`s."isPublic" = true`
        : Prisma.sql`s."isPublic" = false`,
    );
  }

  if (sizes.length > 0 && sizes.length < 3) {
    const sizeClauses = sizeConditions(sizes);
    conditions.push(
      sizeClauses.length === 1
        ? sizeClauses[0]
        : Prisma.sql`(${Prisma.join(sizeClauses, " OR ")})`,
    );
  }

  if (defaults.length > 0 && defaults.length < 2) {
    conditions.push(
      defaults.includes("on")
        ? Prisma.sql`s."appliedByDefault" = true`
        : Prisma.sql`s."appliedByDefault" = false`,
    );
  }

  if (authors.length > 0 && authors.length < 2) {
    conditions.push(
      authors.includes("me")
        ? Prisma.sql`s."originalSkillId" IS NULL`
        : Prisma.sql`s."originalSkillId" IS NOT NULL`,
    );
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const offset = (page - 1) * pageSize;

  // LEFT JOINs are needed for the author-name search and for fetching the
  // original author's display name on cloned skills. The joins are cheap on
  // a per-user dataset because the WHERE always anchors on s."userId".
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
        isPublic: boolean;
        appliedByDefault: boolean;
        updatedAt: Date;
        charCount: bigint;
        isClone: boolean;
        authorName: string | null;
      }>
    >`
      SELECT
        s.id,
        s.name,
        s.description,
        s."isPublic",
        s."appliedByDefault",
        s."updatedAt",
        CHAR_LENGTH(s.content) AS "charCount",
        (s."originalSkillId" IS NOT NULL) AS "isClone",
        ou.name AS "authorName"
      FROM "Skill" s
      LEFT JOIN "Skill" os ON os.id = s."originalSkillId"
      LEFT JOIN "User" ou ON ou.id = os."userId"
      ${whereClause}
      ORDER BY s."updatedAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "Skill" s
      LEFT JOIN "Skill" os ON os.id = s."originalSkillId"
      LEFT JOIN "User" ou ON ou.id = os."userId"
      ${whereClause}
    `,
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    skills: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      charCount: Number(r.charCount),
      updatedAt: r.updatedAt.toISOString(),
      isPublic: r.isPublic,
      appliedByDefault: r.appliedByDefault,
      isClone: Boolean(r.isClone),
      authorName: r.authorName,
    })),
    total,
    page,
    pageSize,
    totalPages,
  });
}
