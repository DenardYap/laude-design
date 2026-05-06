import { Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage, PageHeader, SectionHeader } from "@/components/ui";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { requireUser } from "@/lib/auth";
import { getInitials } from "@/lib/utils";

export const metadata = { title: "Settings · Laude Design" };

export default async function SettingsPage() {
  const user = await requireUser();
  const initials = getInitials(user.name, user.email);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10">
      <PageHeader
        title="Settings"
        description="Manage your account preferences."
      />

      <section className="space-y-4">
        <SectionHeader title="Account" />
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
          <Avatar className="size-11">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? ""} /> : null}
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {user.name ? (
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            ) : null}
            <p className="truncate text-sm text-ink-muted">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Danger zone"
          description="Actions here are permanent and cannot be reversed."
        />
        {user.email ? (
          <DeleteAccountSection userEmail={user.email} />
        ) : null}
      </section>
    </div>
  );
}
