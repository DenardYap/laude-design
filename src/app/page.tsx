import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Github, KeyRound, Layers, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

const features = [
  {
    icon: Sparkles,
    title: "Design with your favorite model",
    description:
      "Bring your own keys for Laude, Gemini, or OpenAI and choose which model powers each project.",
  },
  {
    icon: Layers,
    title: "Reusable Skills",
    description:
      "Upload markdown or text Skills the agent can use, or share them publicly with the community.",
  },
  {
    icon: KeyRound,
    title: "Your keys, encrypted",
    description:
      "API keys are AES-256-GCM encrypted at rest. We never share, log, or display them in full.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/projects");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[480px] w-[120%] max-w-[1600px] rounded-[100%] bg-primary/40 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Laude Design" width={36} height={36} className="size-9" priority />
          <span className="text-base font-semibold tracking-tight">Laude Design</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-in">
            Sign in
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-12 pt-16 text-center">
        <span className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          Self-hosted, bring-your-own-key
        </span>
        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Design with Laude, on your terms
        </h1>
        <p className="max-w-xl text-pretty text-base text-muted-foreground">
          A Laude-style design workspace you can host yourself. Sign in with Google or GitHub,
          plug in your own provider keys, and build a library of reusable Skills.
        </p>
        <div className="flex items-center gap-2">
          <Button asChild size="lg">
            <Link href="/sign-in">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="https://github.com/DenardYap/laude-design" target="_blank" rel="noreferrer">
              <Github className="size-4" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="bg-card/70 backdrop-blur">
            <CardContent className="space-y-2 p-6">
              <div className="grid size-9 place-items-center rounded-md bg-primary/40 text-primary-foreground">
                <Icon className="size-4" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
