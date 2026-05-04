import { match } from "ts-pattern";

export function shortcutChord(key: string): string {
  return match(getModSymbol())
    .with("meta", () => `⌘${key}`)
    .with("ctrl", () => `Ctrl+${key}`)
    .exhaustive();
}

function getModSymbol(): "meta" | "ctrl" {
  if (typeof navigator === "undefined") return "meta";
  return /Mac|iPhone|iPad/i.test(navigator.platform) ? "meta" : "ctrl";
}
