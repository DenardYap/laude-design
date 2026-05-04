"use client";

import { useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ExternalLink, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  ButtonLink,
  ConfirmDialog,
  IconBadge,
  IconButton,
  Input,
  Pill,
} from "@/components/ui";
import { ApiKeySchema, type ApiKeyInput, type AiProvider } from "@/lib/validators";
import { deleteApiKey, saveApiKey } from "@/server/actions/api-keys";

export interface ProviderConfig {
  provider: AiProvider;
  /** Display name — what users actually search for (e.g. "Anthropic"). */
  name: string;
  placeholder: string;
  /** Direct URL to the provider's API-key page. Opens in a new tab. */
  docsUrl: string;
  /** Friendly name of the destination dashboard ("Anthropic Console", etc). */
  dashboardLabel: string;
  /** Brand icon for the provider. */
  icon: ReactNode;
}

interface ApiKeyRowProps {
  config: ProviderConfig;
  existing?: { lastFour: string; updatedAt: Date | string };
}

export function ApiKeyRow({ config, existing }: ApiKeyRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<ApiKeyInput>({
    resolver: zodResolver(ApiKeySchema),
    defaultValues: { provider: config.provider, secret: "" },
  });

  function startEditing() {
    setEditing(true);
    form.reset({ provider: config.provider, secret: "" });
  }

  function cancelEditing() {
    setEditing(false);
    setShowSecret(false);
    form.reset({ provider: config.provider, secret: "" });
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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save key");
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconBadge tone="neutral" size="md" icon={config.icon} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{config.name}</span>
          {existing ? (
            <Pill tone="success">
              <Check />
              Configured
            </Pill>
          ) : (
            <Pill tone="neutral">Not configured</Pill>
          )}
          {existing && !editing ? (
            <span className="font-mono text-xs text-ink-muted">••••{existing.lastFour}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ButtonLink
            href={config.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
            aria-label={`Open ${config.dashboardLabel} (new tab)`}
          >
            <ExternalLink className="size-3.5" />
            Get key
          </ButtonLink>
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                {existing ? "Replace" : "Add key"}
              </Button>
              {existing ? (
                <IconButton
                  aria-label={`Delete ${config.name} key`}
                  onClick={() => setConfirmDelete(true)}
                  icon={<Trash2 className="size-4 text-destructive" />}
                />
              ) : null}
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={pending}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2 pl-11">
          <div className="flex-1 space-y-1">
            <div className="relative">
              <Input
                id={`secret-${config.provider}`}
                type={showSecret ? "text" : "password"}
                placeholder={config.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="pr-9 font-mono text-sm"
                aria-label={`${config.name} API key`}
                {...form.register("secret")}
                aria-invalid={!!form.formState.errors.secret}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-ink-muted hover:text-ink"
                aria-label={showSecret ? "Hide key" : "Show key"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {form.formState.errors.secret ? (
              <p className="text-xs text-destructive">{form.formState.errors.secret.message}</p>
            ) : null}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${config.name} key?`}
        description="The key will be removed from this app. Make sure you also revoke it on the provider dashboard if it might be compromised."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          try {
            await deleteApiKey(config.provider);
            toast.success(`${config.name} key removed`);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete");
          }
        }}
      />
    </li>
  );
}
