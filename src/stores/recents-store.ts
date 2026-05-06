"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Recently visited entry in the global command palette. Pages and projects
 * share one ordered list so the user sees a single "Recently used" group
 * regardless of what kind of thing they last touched. The discriminator
 * (`kind`) drives icon + label rendering downstream.
 */
export type RecentItem =
  | { kind: "project"; id: string; name: string; visitedAt: number }
  | { kind: "page"; href: string; visitedAt: number };

export type RecentInput =
  | { kind: "project"; id: string; name: string }
  | { kind: "page"; href: string };

// Cap the persisted history. The palette only ever surfaces the top 5, but a
// slightly larger buffer means renaming or briefly visiting an unrelated item
// doesn't immediately bump useful history off the list.
const MAX_RECENT = 16;

function keyOf(item: RecentInput | RecentItem): string {
  return item.kind === "project" ? `project:${item.id}` : `page:${item.href}`;
}

interface RecentsState {
  recents: RecentItem[];
  /** Record a visit. Moves the item to the front and refreshes its metadata. */
  addRecent: (input: RecentInput) => void;
  /** Drop an item by its stable key (e.g. after a project is deleted). */
  removeRecent: (key: string) => void;
  clear: () => void;
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      recents: [],
      addRecent: (input) =>
        set((state) => {
          const key = keyOf(input);
          const without = state.recents.filter((r) => keyOf(r) !== key);
          const next: RecentItem = { ...input, visitedAt: Date.now() };
          return { recents: [next, ...without].slice(0, MAX_RECENT) };
        }),
      removeRecent: (key) =>
        set((state) => ({ recents: state.recents.filter((r) => keyOf(r) !== key) })),
      clear: () => set({ recents: [] }),
    }),
    { name: "laude-design:recents" },
  ),
);

export const recentItemKey = keyOf;
