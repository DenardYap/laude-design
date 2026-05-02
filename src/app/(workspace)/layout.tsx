import { requireUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="h-screen w-screen overflow-hidden bg-background">{children}</div>;
}
