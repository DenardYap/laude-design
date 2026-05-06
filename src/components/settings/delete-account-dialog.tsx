"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";
import { deleteAccountAction } from "@/server/actions/auth";
import type { DeleteAccountDialogProps } from "@/components/settings/types/settings";
import { buildSchema } from "@/components/settings/utils/delete-account";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountDialogProps) {
  const [isPending, startTransition] = useTransition();
  const schema = buildSchema(userEmail);
  type ConfirmInput = z.infer<typeof schema>;

  const form = useForm<ConfirmInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) form.reset();
    onOpenChange(next);
  }

  function onSubmit(values: ConfirmInput) {
    startTransition(async () => {
      try {
        await deleteAccountAction(values.email);
      } catch {
        toast.error("Failed to delete account. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This is permanent and cannot be undone. All your projects, designs, sessions, and
            skills will be deleted immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm" className="text-sm text-ink">
              Type your email{" "}
              <span className="font-mono font-semibold text-ink">{userEmail}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder={userEmail}
              disabled={isPending}
              {...form.register("email")}
              aria-invalid={!!form.formState.errors.email}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
