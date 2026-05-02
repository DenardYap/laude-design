"use server";

import { revalidatePath } from "next/cache";
import { type AiProvider as PrismaAiProvider } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { ApiKeySchema, type ApiKeyInput } from "@/lib/validators";

export async function saveApiKey(input: ApiKeyInput) {
  const user = await requireUser();
  const data = ApiKeySchema.parse(input);
  const ciphertext = encryptSecret(data.secret);
  const lastFour = data.secret.slice(-4);

  await db.apiKey.upsert({
    where: { userId_provider: { userId: user.id, provider: data.provider as PrismaAiProvider } },
    create: {
      userId: user.id,
      provider: data.provider as PrismaAiProvider,
      ciphertext,
      lastFour,
    },
    update: {
      ciphertext,
      lastFour,
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
