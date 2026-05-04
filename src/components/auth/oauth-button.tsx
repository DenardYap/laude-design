"use client";

import type { ReactNode } from 'react';

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui";

interface OAuthButtonProps {
  provider: "google" | "github";
  icon: ReactNode;
  children: ReactNode;
}

export function OAuthButton({ icon, children }: OAuthButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </Button>
  );
}
