"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SkillSchema, type SkillInput } from "@/lib/validators";
import { uploadSkill } from "@/server/actions/skills";

const ACCEPTED = ".md,.markdown,.txt";
const MAX_BYTES = 64 * 1024;

export function SkillUploader() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const form = useForm<SkillInput>({
    resolver: zodResolver(SkillSchema),
    defaultValues: { name: "", description: "", content: "", isPublic: false },
  });

  async function onFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("File too large. Max 64 KB.");
      return;
    }
    const text = await file.text();
    form.setValue("content", text, { shouldValidate: true });
    if (!form.getValues("name")) {
      form.setValue("name", file.name.replace(/\.(md|markdown|txt)$/i, ""), { shouldValidate: true });
    }
  }

  function onSubmit(values: SkillInput) {
    startTransition(async () => {
      try {
        await uploadSkill(values);
        toast.success("Skill uploaded");
        form.reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to upload");
      }
    });
  }

  const isPublic = form.watch("isPublic");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Skills are markdown or text files the agent can use as context. Max 64 KB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-file">File (.md / .txt)</Label>
            <Input
              id="skill-file"
              type="file"
              accept={ACCEPTED}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name</Label>
            <Input id="skill-name" placeholder="My design system rules" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="skill-description"
              placeholder="What this skill teaches the agent"
              {...form.register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-content">Content (preview)</Label>
            <Textarea
              id="skill-content"
              rows={6}
              placeholder="# My skill..."
              className="font-mono text-xs"
              {...form.register("content")}
            />
            {form.formState.errors.content ? (
              <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="skill-public" className="text-sm font-medium">
                Make public
              </Label>
              <p className="text-xs text-muted-foreground">
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
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
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
