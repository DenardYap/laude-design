"use client";

import { useRouter } from "next/navigation";
import { File as FileIcon, FolderKanban, KeyRound, Wand2 } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
} from "@/components/ui";
import type { DesignDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface CommandPaletteProps {
  currentProjectId: string;
  projects: { id: string; name: string }[];
  designs: DesignDTO[];
}

export function CommandPalette({ currentProjectId, projects, designs }: CommandPaletteProps) {
  const router = useRouter();
  const open = useWorkspaceStore((s) => s.paletteOpen);
  const setOpen = useWorkspaceStore((s) => s.setPaletteOpen);
  const openTab = useWorkspaceStore((s) => s.openDesignTab);
  const setExportOpen = useWorkspaceStore((s) => s.setExportOpen);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <Command>
          <CommandInput placeholder="Type to search projects, designs, or screens..." />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>

            {designs.length > 0 ? (
              <CommandGroup heading="Designs in this project">
                {designs.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`design ${d.name}`}
                    onSelect={() => {
                      openTab(currentProjectId, d.id);
                      setOpen(false);
                    }}
                  >
                    <FileIcon className="mr-2 size-3.5" />
                    {d.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() => go(`/projects/${p.id}`)}
                >
                  <FolderKanban className="mr-2 size-3.5" />
                  {p.name}
                  {p.id === currentProjectId ? (
                    <span className="ml-auto text-[10px] text-ink-muted">current</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Screens">
              <CommandItem value="all projects" onSelect={() => go("/projects")}>
                <FolderKanban className="mr-2 size-3.5" />
                All projects
              </CommandItem>
              <CommandItem value="configure api keys" onSelect={() => go("/api-keys")}>
                <KeyRound className="mr-2 size-3.5" />
                Configure API keys
              </CommandItem>
              <CommandItem value="skills" onSelect={() => go("/skills")}>
                <Wand2 className="mr-2 size-3.5" />
                Skills
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Actions">
              <CommandItem
                value="export to agent"
                onSelect={() => {
                  setOpen(false);
                  setExportOpen(true);
                }}
              >
                Export current design to agent
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
