import { KeyRound, ArrowRight, AlertTriangle, Clock, WifiOff } from "lucide-react";
import Link from "next/link";
import { match } from "ts-pattern";

import {
  type ChatError,
  PROVIDER_DISPLAY,
} from "@/components/workspace/chat/utils/chat-errors";

function providerName(provider: string) {
  return PROVIDER_DISPLAY[provider] ?? provider;
}

function ConfigureKeysLink({ label = "Configure API keys" }: { label?: string }) {
  return (
    <Link
      href="/api-keys"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-ink underline-offset-2 hover:underline"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}

export function ChatErrorBanner({ error }: { error: ChatError }) {
  const content = match(error)
    .with({ type: "api-key-missing" }, ({ provider }) => ({
      icon: <KeyRound className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <>
          <p className="text-ink">
            No API key configured for{" "}
            <span className="font-medium">{providerName(provider)}</span>. Add
            your key to start chatting.
          </p>
          <ConfigureKeysLink />
        </>
      ),
    }))
    .with({ type: "api-key-invalid" }, ({ provider }) => ({
      icon: <KeyRound className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <>
          <p className="text-ink">
            Your <span className="font-medium">{providerName(provider)}</span>{" "}
            API key was rejected. Double-check it&apos;s active and has access
            to this model.
          </p>
          <ConfigureKeysLink label="Update API keys" />
        </>
      ),
    }))
    .with({ type: "rate-limit" }, ({ provider }) => ({
      icon: <Clock className="mt-0.5 size-4 shrink-0 text-warning" />,
      body: (
        <p className="text-ink">
          {provider ? providerName(provider) : "Your provider"} hit a rate
          limit. Wait a moment and send the message again. (Tip: Check your rate
          limit tier.)
        </p>
      ),
    }))
    .with({ type: "model-not-found" }, ({ modelId }) => ({
      icon: (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      ),
      body: (
        <p className="text-ink">
          {modelId ? (
            <>
              Model <span className="font-mono text-xs">{modelId}</span> isn
              &apos;t available on your account.
            </>
          ) : (
            <>The selected model isn&apos;t available on your account.</>
          )}{" "}
          Pick a different one from the model picker.
        </p>
      ),
    }))
    .with({ type: "network" }, () => ({
      icon: <WifiOff className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <p className="text-ink">
          Couldn&apos;t reach the server. Check your connection and try again.
        </p>
      ),
    }))
    .with({ type: "generic" }, ({ message }) => ({
      icon: (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      ),
      body: (
        <>
          <p className="text-ink">Something went wrong while sending.</p>
          {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
        </>
      ),
    }))
    .exhaustive();

  return (
    <div className="flex items-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-destructive-soft px-3 py-2.5 text-sm">
        <div className="flex items-start gap-2">
          {content.icon}
          <div className="space-y-2">{content.body}</div>
        </div>
      </div>
    </div>
  );
}
