"use client";

import { useRef, useState, useTransition } from 'react';
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, Upload, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
  Input,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { SkillSchema, type SkillInput } from "@/lib/validators";
import { uploadSkill } from "@/server/actions/skills";

const ACCEPTED_EXTS = [".md", ".mdc", ".markdown", ".txt"] as const;
const ACCEPTED_ATTR = ACCEPTED_EXTS.join(",");
const ACCEPTED_LABEL = ".md, .mdc, .markdown, or .txt";
const STRIP_EXT_RE = /\.(md|mdc|markdown|txt)$/i;
const MAX_BYTES = 64 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function SkillUploader() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const form = useForm<SkillInput>({
    resolver: zodResolver(SkillSchema),
    defaultValues: { name: "", description: "", content: "", isPublic: false },
  });

  async function onFile(file: File) {
    const ext = file.name.includes(".")
      ? `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`
      : "";
    if (!ACCEPTED_EXTS.includes(ext as (typeof ACCEPTED_EXTS)[number])) {
      toast.error(`Unsupported file type. Use ${ACCEPTED_LABEL}.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large. Max 64 KB.");
      return;
    }
    const text = await file.text();
    form.setValue("content", text, { shouldValidate: true });
    setFileMeta({ name: file.name, size: file.size });
    if (!form.getValues("name")) {
      form.setValue("name", file.name.replace(STRIP_EXT_RE, ""), {
        shouldValidate: true,
      });
    }
  }

  function clearFile() {
    setFileMeta(null);
    form.setValue("content", "", { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(values: SkillInput) {
    startTransition(async () => {
      try {
        await uploadSkill(values);
        toast.success("Skill uploaded");
        form.reset();
        setFileMeta(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to upload");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setFileMeta(null);
      setDragOver(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isPublic = form.watch("isPublic");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="size-4" />
          Upload Skill
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a Skill</DialogTitle>
          <DialogDescription>
            Drop a {ACCEPTED_LABEL} file. The agent uses it as additional
            context. Max 64 KB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-file">Source file</Label>
            <input
              ref={fileInputRef}
              id="skill-file"
              type="file"
              accept={ACCEPTED_ATTR}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            {fileMeta ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {fileMeta.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatFileSize(fileMeta.size)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <IconButton
                    type="button"
                    variant="ghost"
                    aria-label="Remove file"
                    onClick={clearFile}
                    icon={<X className="size-4" />}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void onFile(file);
                }}
                className={cn(
                  "group flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors",
                  "hover:border-primary/60 hover:bg-muted/50",
                  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring",
                  dragOver && "border-primary bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full bg-primary/15 text-primary transition-colors",
                    "group-hover:bg-primary/25",
                  )}
                >
                  <UploadCloud className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink">
                    <span className="text-primary">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-ink-muted">
                    {ACCEPTED_LABEL} · max 64 KB
                  </p>
                </div>
              </button>
            )}
            {form.formState.errors.content && !fileMeta ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.content.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              placeholder="My design system rules"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-description">
              Description <span className="text-ink-subtle">(optional)</span>
            </Label>
            <Input
              id="skill-description"
              placeholder="What this skill teaches the agent"
              {...form.register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-content">Content</Label>
            <Textarea
              id="skill-content"
              rows={6}
              placeholder="# My skill..."
              className="font-mono text-xs"
              {...form.register("content")}
            />
            {form.formState.errors.content ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.content.message}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="skill-public" className="text-sm font-medium">
                Make public
              </Label>
              <p className="text-xs text-ink-muted">
                Allow other users to download and use this skill.
              </p>
            </div>
            <Switch
              id="skill-public"
              checked={isPublic}
              onCheckedChange={(v) => form.setValue("isPublic", v)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
