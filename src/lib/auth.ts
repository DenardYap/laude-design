import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceName?: string | null;
    } & DefaultSession["user"];
  }
}

const nextAuth = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { workspaceName: true },
        });
        session.user.workspaceName = dbUser?.workspaceName ?? null;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

// Wrap `auth()` in React cache so a single request that calls it multiple
// times (e.g. layout + page + nested server component) only hits the database
// once. The session callback itself does an extra `db.user.findUnique`, so
// deduping here saves real round-trips on the request-response critical path.
export const auth = cache(nextAuth.auth);

export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user;
});
