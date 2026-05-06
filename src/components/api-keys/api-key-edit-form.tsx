"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

import { Button, Input } from "@/components/ui";
import type { ApiKeyEditFormProps } from "@/components/api-keys/types/api-keys";
import { LifetimePicker } from "@/components/api-keys/lifetime-picker";

export function ApiKeyEditForm({
  config,
  form,
  showSecret,
  onToggleSecret,
  onSubmit,
}: ApiKeyEditFormProps) {
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-3 pl-11"
    >
      <div className="flex items-start gap-2">
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
              onClick={onToggleSecret}
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
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>

      <Controller
        control={form.control}
        name="lifetime"
        render={({ field }) => (
          <LifetimePicker
            value={field.value}
            onChange={field.onChange}
            providerName={config.name}
          />
        )}
      />
    </form>
  );
}

