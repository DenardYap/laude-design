"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      offset={16}
      mobileOffset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-surface !text-ink !border !border-border !shadow-md !rounded-lg",
          title: "!text-ink !font-medium",
          description: "!text-ink-muted",
          actionButton: "!bg-brand !text-brand-foreground",
          cancelButton: "!bg-surface-sunken !text-ink-muted",
          closeButton:
            "!bg-surface !border !border-border !text-ink-muted hover:!bg-surface-sunken hover:!text-ink",
          success:
            "!bg-success-soft !text-ink !border !border-success/20 [&>[data-icon]]:!text-success",
          error:
            "!bg-destructive-soft !text-ink !border !border-destructive/20 [&>[data-icon]]:!text-destructive",
          warning:
            "!bg-warning-soft !text-ink !border !border-warning/30 [&>[data-icon]]:!text-warning",
          info: "!bg-brand-soft !text-ink !border !border-brand/30 [&>[data-icon]]:!text-brand-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
