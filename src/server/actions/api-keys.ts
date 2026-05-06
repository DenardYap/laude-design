"use server";

import { revalidatePath } from "next/cache";
import { type AiProvider as PrismaAiProvider } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { lastFour } from "@/lib/api-keys/last-four";
import {
  ApiKeySchema,
  expiryFromLifetime,
  type ApiKeyInput,
} from "@/lib/validators";

/**
 * Persist (or replace) the encrypted API key for the signed-in user and
 * the given provider. The plaintext key is encrypted with AES-256-GCM
 * before it ever touches Postgres — only the ciphertext, a 4-character
 * suffix used for display, and an optional `expiresAt` are stored.
 *
 * The `lifetime` field on the input controls auto-expiry: "never" keeps
 * the key indefinitely, "7d" / "14d" / "30d" stamp the row with an
 * `expiresAt` N days from now. The chat route lazy-deletes any expired
 * row on the next request that needs it.
 */
export async function saveApiKey(input: ApiKeyInput) {
  const user = await requireUser();
  const data = ApiKeySchema.parse(input);
  const ciphertext = encryptSecret(data.secret);
  const suffix = lastFour(data.secret);
  const expiresAt = expiryFromLifetime(data.lifetime);

  await db.apiKey.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: data.provider as PrismaAiProvider,
      },
    },
    create: {
      userId: user.id,
      provider: data.provider as PrismaAiProvider,
      ciphertext,
      lastFour: suffix,
      expiresAt,
    },
    update: {
      ciphertext,
      lastFour: suffix,
      expiresAt,
    },
  });

  revalidatePath("/api-keys");
}

export async function deleteApiKey(provider: ApiKeyInput["provider"]) {
  const user = await requireUser();
  await db.apiKey.deleteMany({
    where: { userId: user.id, provider: provider as PrismaAiProvider },
  });
  revalidatePath("/api-keys");
}
