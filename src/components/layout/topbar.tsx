"use client";

import * as React from "react";
import { Github, LogOut, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onSignOut: () => Promise<void>;
}

export function Topbar({ user, onSignOut }: TopbarProps) {
  const initials = getInitials(user.name, user.email);
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border bg-background px-6">
      <Button asChild variant="outline" size="sm" className="gap-2 rounded-full px-3">
        <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="Star on GitHub">
          <Star className="size-3.5" />
          <span className="text-xs">Star</span>
          <span className="text-xs text-muted-foreground">0.6k</span>
        </a>
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label="GitHub repo">
        <a href="https://github.com" target="_blank" rel="noreferrer">
          <Github className="size-5" />
        </a>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account"
          >
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt={user.name ?? ""} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={onSignOut}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
