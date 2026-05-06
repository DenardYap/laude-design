"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";
import { DeleteAccountDialog } from "./delete-account-dialog";
import type { DeleteAccountSectionProps } from "@/components/settings/types/settings";

export function DeleteAccountSection({ userEmail }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <TriangleAlert className="size-4 text-destructive" />
            <h3 className="text-sm font-semibold text-ink">Delete account</h3>
          </div>
          <p className="text-sm text-ink-muted">
            Permanently delete your account and all associated data — projects, designs, sessions,
            and skills. This action cannot be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      </div>

      <DeleteAccountDialog
        open={open}
        onOpenChange={setOpen}
        userEmail={userEmail}
      />
    </div>
  );
}
