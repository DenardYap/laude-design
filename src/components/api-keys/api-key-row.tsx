"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiKeySchema, type ApiKeyInput, type AiProvider } from "@/lib/validators";
import { deleteApiKey, saveApiKey } from "@/server/actions/api-keys";

export interface ProviderConfig {
  provider: AiProvider;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  accent: string;
}

interface ApiKeyRowProps {
  config: ProviderConfig;
  existing?: { lastFour: string; label?: string | null; updatedAt: Date | string };
}

export function ApiKeyRow({ config, existing }: ApiKeyRowProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(!existing);
  const [showSecret, setShowSecret] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<ApiKeyInput>({
    resolver: zodResolver(ApiKeySchema),
    defaultValues: { provider: config.provider, secret: "", label: existing?.label ?? "" },
  });

  function onSubmit(values: ApiKeyInput) {
    startTransition(async () => {
      try {
        await saveApiKey(values);
        toast.success(`${config.name} key saved`);
        form.reset({ provider: config.provider, secret: "", label: values.label });
        setEditing(false);
        setShowSecret(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save key");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-md text-sm font-semibold ${config.accent}`}
          >
            {config.name[0]}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{config.name}</h3>
              {existing ? (
                <Badge variant="success" className="gap-1">
                  <Check className="size-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="muted">Not configured</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {existing && !editing ? (
              <p className="font-mono text-xs text-muted-foreground">
                ••••••••{existing.lastFour}
              </p>
            ) : null}
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline-offset-2 hover:underline"
            >
              Where do I get my key?
            </a>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                {existing ? "Replace" : "Add key"}
              </Button>
              {existing ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Delete ${config.name} key`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>

      {editing ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border-t border-border p-6">
          <div className="space-y-1.5">
            <Label htmlFor={`secret-${config.provider}`}>API key</Label>
            <div className="relative">
              <Input
                id={`secret-${config.provider}`}
                type={showSecret ? "text" : "password"}
                placeholder={config.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="pr-10 font-mono"
                {...form.register("secret")}
                aria-invalid={!!form.formState.errors.secret}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? "Hide key" : "Show key"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {form.formState.errors.secret ? (
              <p className="text-xs text-destructive">{form.formState.errors.secret.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`label-${config.provider}`}>
              Label <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`label-${config.provider}`}
              placeholder="Personal key, work key, etc."
              {...form.register("label")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save key
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${config.name} key?`}
        description="The key will be removed from this app. Make sure you also revoke it on the provider dashboard if it might be compromised."
        confirmLabel="Delete"
        variant="destructive"
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
    </Card>
  );
}
