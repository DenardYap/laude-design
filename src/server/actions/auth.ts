"use server";

import { requireUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * Permanently delete the current user's account and every row that
 * cascades from it (projects → sessions → messages → designs → files,
 * skills, likes, saves, OAuth accounts, NextAuth sessions).
 *
 * Requires the caller to type their own email as a confirmation token.
 * The server verifies it against the authenticated session — the typed
 * value is never trusted as input on its own. This blocks two failure
 * modes the old "type DELETE" flow allowed:
 *
 *   1. A signed-in user accidentally clicking through (now they have to
 *      retype their full email, not a single fixed string).
 *   2. A future XSS payload that just calls the action — without knowing
 *      the user's email it can't satisfy the check.
 *
 * Comparison is case-insensitive and ignores surrounding whitespace
 * because real users will paste with both. We deliberately do NOT echo
 * the expected email back to the client so the dialog can't be turned
 * into an "auto-fill the right value" oracle by a malicious script.
 */
export async function deleteAccountAction(typedEmail: string): Promise<void> {
  const user = await requireUser();

  if (!user.email) {
    throw new Error("This account has no email on file; cannot self-delete.");
  }

  const normalizedTyped = typedEmail.trim().toLowerCase();
  const normalizedActual = user.email.trim().toLowerCase();

  if (!normalizedTyped || normalizedTyped !== normalizedActual) {
    throw new Error("Email confirmation does not match the signed-in account.");
  }

  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
}
