import type { ReactNode } from 'react';
import { requireUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}
