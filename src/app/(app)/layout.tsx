import type { ReactNode } from 'react';
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RecentPageTracker } from "@/components/layout/recent-page-tracker";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Fetched once per request and shared with the Topbar's command palette so
  // ⌘K can navigate to any project without an extra client-side round trip.
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <RecentPageTracker />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} projects={projects} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
