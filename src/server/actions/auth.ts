"use server";

import { requireUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function deleteAccountAction() {
  const user = await requireUser();
  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
}
