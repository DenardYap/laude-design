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

function buildOrderBy(sort: string): Prisma.Sql {
  if (sort === "likes") return Prisma.sql`s.likes DESC, s."updatedAt" DESC`;
  if (sort === "updated") return Prisma.sql`s."updatedAt" DESC`;
  return Prisma.sql`s.saves DESC, s."updatedAt" DESC`;
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
  const sizes = parseList(sp.get("size"));
  const authors = parseList(sp.get("author"));
  const sort = sp.get("sort") ?? "saves";

  const conditions: Prisma.Sql[] = [Prisma.sql`s."isPublic" = true`];

  if (q) {
    const like = `%${q}%`;
    conditions.push(
      Prisma.sql`(s.name ILIKE ${like} OR s.description ILIKE ${like} OR u.name ILIKE ${like})`,
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

  // Only apply when one of the two options is selected; both selected = no-op
  if (authors.length > 0 && authors.length < 2) {
    conditions.push(
      authors.includes("me")
        ? Prisma.sql`s."userId" = ${userId}`
        : Prisma.sql`s."userId" != ${userId}`,
    );
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const orderBy = buildOrderBy(sort);
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    db.$queryRaw<
      Array<{
        id: string;
        userId: string;
        name: string;
        description: string | null;
        saves: number;
        likes: number;
        updatedAt: Date;
        charCount: bigint;
        authorName: string | null;
      }>
    >`
      SELECT
        s.id,
        s."userId",
        s.name,
        s.description,
        s.saves,
        s.likes,
        s."updatedAt",
        CHAR_LENGTH(s.content) AS "charCount",
        u.name AS "authorName"
      FROM "Skill" s
      LEFT JOIN "User" u ON u.id = s."userId"
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "Skill" s
      LEFT JOIN "User" u ON u.id = s."userId"
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
      saves: r.saves,
      likes: r.likes,
      authorName: r.authorName,
      isMine: r.userId === userId,
    })),
    total,
    page,
    pageSize,
    totalPages,
  });
}
