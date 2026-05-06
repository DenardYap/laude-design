import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AiProvider } from "@/lib/validators";

export interface ConfiguredApiKey {
  provider: AiProvider;
  lastFour: string;
  /** ISO timestamp of auto-expiry, or null when the user picked "never". */
  expiresAt: string | null;
}

export interface ApiKeysResponse {
  keys: ConfiguredApiKey[];
}

/**
 * Returns the public-safe metadata for every API key the current user has
 * configured. Ciphertext is intentionally NOT returned — the chat route
 * decrypts in-process and never sends key material across the wire.
 *
 * Already-expired rows are filtered out and deleted opportunistically so
 * the UI never shows a key that the chat route would refuse to use on the
 * next request.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const now = new Date();

  // Cheap maintenance pass: drop any of THIS user's rows that have aged out.
  // Doing it here (rather than only in the chat route) keeps the picker
  // honest the moment they revisit the page after a long absence.
  await db.apiKey.deleteMany({
    where: { userId, expiresAt: { lte: now } },
  });

  const rows = await db.apiKey.findMany({
    where: { userId },
    select: { provider: true, lastFour: true, expiresAt: true },
  });

  const body: ApiKeysResponse = {
    keys: rows.map((r) => ({
      provider: r.provider as AiProvider,
      lastFour: r.lastFour,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    })),
  };

  return NextResponse.json(body);
}
