"use client";

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';

import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, referrerPolicy = "no-referrer", ...props }, ref) => (
  // Google's `lh3.googleusercontent.com` (and some GitHub avatar variants)
  // reject requests when the browser sends a referrer the CDN doesn't like,
  // which silently falls through to the AvatarFallback. `no-referrer` is the
  // canonical fix for cross-origin avatar URLs and is safe — these images
  // are public and don't need referrer-based auth. Callers can still
  // override via prop.
  <AvatarPrimitive.Image
    ref={ref}
    referrerPolicy={referrerPolicy}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
