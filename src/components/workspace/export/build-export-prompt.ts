import type { DesignDTO } from "@/lib/workspace/types";

interface BuildOptions {
  projectName?: string;
  design: DesignDTO;
  /** Most recent user instruction (already trimmed). */
  latestPrompt?: string;
}

const FILE_FENCE: Record<string, string> = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".jsx": "jsx",
  ".js": "js",
  ".css": "css",
};

function fenceFor(path: string) {
  const m = path.match(/\.[^.]+$/);
  return (m && FILE_FENCE[m[0]]) || "";
}

export function buildExportPrompt({ projectName, design, latestPrompt }: BuildOptions): string {
  const lines: string[] = [];
  lines.push(`# Replicate this design`);
  lines.push("");
  lines.push(
    `You are an expert frontend engineer. Below is a working React + Tailwind design exported from Laude Design${
      projectName ? ` (project: ${projectName})` : ""
    }. Faithfully recreate it in the project I've opened, matching layout, spacing, typography, and behavior.`,
  );
  lines.push("");
  lines.push(`## Design: ${design.name}`);
  lines.push("");
  if (latestPrompt) {
    lines.push(`### Latest user intent`);
    lines.push("");
    lines.push("> " + latestPrompt.split("\n").join("\n> "));
    lines.push("");
  }
  lines.push(`### Source files`);
  lines.push("");
  for (const f of design.files) {
    lines.push(`#### \`${f.path}\``);
    const lang = fenceFor(f.path);
    lines.push("```" + lang);
    lines.push(f.content.trimEnd());
    lines.push("```");
    lines.push("");
  }
  lines.push("### Implementation notes");
  lines.push("");
  lines.push("- Use the existing component primitives in the project where possible (Button, Card, etc.).");
  lines.push("- Replace any inline Tailwind utilities with project tokens if your design system has them.");
  lines.push("- Keep the visual hierarchy and spacing exactly as shown.");

  return lines.join("\n");
}
