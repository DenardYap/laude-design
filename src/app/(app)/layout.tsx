import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/auth";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
