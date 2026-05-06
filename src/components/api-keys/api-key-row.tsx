"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui";
import { ApiKeySchema, type ApiKeyInput } from "@/lib/validators";
import { deleteApiKey, saveApiKey } from "@/server/actions/api-keys";
import { apiKeyQueryKeys } from "@/lib/api/api-keys";
import type { ApiKeyRowProps } from "@/components/api-keys/types/api-keys";
import { ApiKeyRowHeader } from "@/components/api-keys/api-key-row-header";
import { ApiKeyEditForm } from "@/components/api-keys/api-key-edit-form";

export type { ProviderConfig } from "@/components/api-keys/types/api-keys";

export function ApiKeyRow({ config, existing }: ApiKeyRowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const form = useForm<ApiKeyInput>({
    resolver: zodResolver(ApiKeySchema),
    defaultValues: {
      provider: config.provider,
      secret: "",
      lifetime: "never",
    },
  });

  function startEditing() {
    setEditing(true);
    form.reset({
      provider: config.provider,
      secret: "",
      lifetime: "never",
    });
  }

  function cancelEditing() {
    setEditing(false);
    setShowSecret(false);
    form.reset({
      provider: config.provider,
      secret: "",
      lifetime: "never",
    });
  }

  function onSubmit(values: ApiKeyInput) {
    startTransition(async () => {
      try {
        await saveApiKey(values);
        toast.success(`${config.name} key saved`);
        setEditing(false);
        setShowSecret(false);
        form.reset({ provider: config.provider, secret: "" });
        router.refresh();
        await queryClient.invalidateQueries({
          queryKey: apiKeyQueryKeys.configured,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save key");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteApiKey(config.provider);
        toast.success(`${config.name} key removed`);
        router.refresh();
        await queryClient.invalidateQueries({
          queryKey: apiKeyQueryKeys.configured,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove key");
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <ApiKeyRowHeader
        config={config}
        existing={existing}
        editing={editing}
        onStartEditing={startEditing}
        onCancelEditing={cancelEditing}
        onDeleteClick={() => setConfirmDelete(true)}
      />

      {editing ? (
        <ApiKeyEditForm
          config={config}
          form={form}
          showSecret={showSecret}
          onToggleSecret={() => setShowSecret((v) => !v)}
          onSubmit={onSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${config.name} key?`}
        description="The encrypted key will be removed from our database. We recommend revoking it on the provider dashboard if it might be compromised."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={handleDelete}
      />
    </li>
  );
}
