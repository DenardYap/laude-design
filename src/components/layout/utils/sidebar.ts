import { FolderKanban, KeyRound, Settings, Wand2 } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/api-keys", label: "Configure API", icon: KeyRound },
  { href: "/skills", label: "Skills", icon: Wand2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const EASE = "cubic-bezier(0.32,0.72,0,1)";
export const DURATION = "duration-300";
