import { z } from "zod";

export function buildSchema(expectedEmail: string) {
  const expected = expectedEmail.trim().toLowerCase();
  return z.object({
    email: z
      .string()
      .min(1, "Type your email to confirm")
      .refine(
        (value) => value.trim().toLowerCase() === expected,
        "Email does not match the signed-in account",
      ),
  });
}
