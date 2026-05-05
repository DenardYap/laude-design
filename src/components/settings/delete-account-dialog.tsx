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

const ConfirmSchema = z.object({
  confirmation: z.literal("DELETE", {
    errorMap: () => ({ message: 'Type DELETE to confirm' }),
  }),
});

type ConfirmInput = z.infer<typeof ConfirmSchema>;

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ConfirmInput>({
    resolver: zodResolver(ConfirmSchema),
    defaultValues: { confirmation: "" as "DELETE" },
  });

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) form.reset();
    onOpenChange(next);
  }

  function onSubmit() {
    startTransition(async () => {
      try {
        await deleteAccountAction();
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
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              spellCheck={false}
              placeholder="DELETE"
              disabled={isPending}
              {...form.register("confirmation")}
              aria-invalid={!!form.formState.errors.confirmation}
            />
            {form.formState.errors.confirmation ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmation.message}
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
