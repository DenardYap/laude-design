import Image from "next/image";
import { ArrowRight, Github, KeyRound, Layers, Sparkles } from "lucide-react";

import { PaintCanvas } from "@/components/landing/paint-canvas";
import {
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  IconBadge,
} from "@/components/ui";
import { auth } from "@/lib/auth";

type EdgeSketch = {
  src: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotate: number; // degrees
  size: number; // px
  /** When true, the sketch is hidden below the `md` breakpoint to avoid
   * crowding the hero on phone viewports. The 4 sketches that *do* show
   * on mobile sit far enough from the centerline that they don't fight
   * the headline. */
  desktopOnly?: boolean;
};

const EDGE_SKETCHES: EdgeSketch[] = [
  // ── left column ────────────────────────────────────────────────────────────
  { src: "/sketches/pencil.png", top: "7%", left: "1%", rotate: -14, size: 96 },
  {
    src: "/sketches/ruler.png",
    top: "24%",
    left: "-1%",
    rotate: 10,
    size: 78,
    desktopOnly: true,
  },
  {
    src: "/sketches/triangle_ruler.png",
    top: "46%",
    left: "0%",
    rotate: -7,
    size: 100,
    desktopOnly: true,
  },
  {
    src: "/sketches/adobe.png",
    bottom: "16%",
    left: "2%",
    rotate: 9,
    size: 82,
  },
  // ── right column ───────────────────────────────────────────────────────────
  {
    src: "/sketches/paintbrush.png",
    top: "5%",
    right: "1%",
    rotate: 21,
    size: 108,
  },
  {
    src: "/sketches/lightbulb.png",
    top: "24%",
    right: "-1%",
    rotate: -11,
    size: 88,
    desktopOnly: true,
  },
  {
    src: "/sketches/palette.png",
    top: "48%",
    right: "2%",
    rotate: 17,
    size: 92,
    desktopOnly: true,
  },
  {
    src: "/sketches/figma.png",
    bottom: "13%",
    right: "0%",
    rotate: -19,
    size: 90,
  },
  // ── bottom ─────────────────────────────────────────────────────────────────
  {
    src: "/sketches/image.png",
    bottom: "4%",
    left: "20%",
    rotate: 5,
    size: 72,
    desktopOnly: true,
  },
];

const features = [
  {
    icon: Sparkles,
    title: "Design with your favorite model",
    description:
      "Bring your own keys for Claude, Gemini, or GPT and choose which model powers each project.",
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
      "API keys are AES-256-GCM encrypted at rest and never shared, logged, or displayed in full.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const isSignedIn = !!session?.user;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[480px] w-[120%] max-w-[1600px] rounded-2xl bg-brand/40 blur-3xl" />

      {/* Scattered sketches along the left/right edges. We render the
          mobile-safe set at full size, then scale them down further on
          phones so they read as quiet decoration instead of competing
          with the headline. The `desktopOnly` flag hides the busiest
          sketches entirely on small screens. */}
      {EDGE_SKETCHES.map(
        ({ src, top, bottom, left, right, rotate, size, desktopOnly }) => (
          <div
            key={src}
            className={`pointer-events-none absolute opacity-50 ${desktopOnly ? "hidden md:block" : ""}`}
            style={{
              top,
              bottom,
              left,
              right,
              width: size,
              transform: `rotate(${rotate}deg)`,
            }}
          >
            <Image
              src={src}
              alt=""
              width={size}
              height={size}
              className="h-auto w-[60%] md:w-full"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>
        ),
      )}

      {/* Painting surface fills the viewport behind the page content. The
          content wrappers below disable their pointer events so clicks on
          empty space fall through to the canvas; only the actual buttons
          and links re-enable pointer events to stay interactive. */}
      <PaintCanvas />

      <header className="pointer-events-none relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <div className="pointer-events-auto flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Laude Design"
            width={36}
            height={36}
            className="size-8 sm:size-9"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-ink">
            Laude Design
          </span>
        </div>
        {isSignedIn ? (
          <ButtonLink
            href="/projects"
            size="sm"
            className="pointer-events-auto"
          >
            <span className="hidden sm:inline">Launch Designer</span>
            <span className="sm:hidden">Open</span>
            <ArrowRight className="size-4" />
          </ButtonLink>
        ) : (
          <ButtonLink
            href="/sign-in"
            variant="outline"
            size="sm"
            className="pointer-events-auto"
          >
            <span className="hidden sm:inline">Launch Designer</span>
            <span className="sm:hidden">Sign in</span>
            <ArrowRight className="size-4" />
          </ButtonLink>
        )}
      </header>

      <section className="pointer-events-none relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pb-10 pt-12 text-center sm:gap-6 sm:px-6 sm:pb-12 sm:pt-16">
        <h1 className="font-sketch text-balance text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl">
          Design with Laude, on your terms
        </h1>
        <p className="max-w-xl text-pretty text-sm text-ink-muted sm:text-base">
          An open-source agentic design workspace with any model you want.
        </p>
        <div className="flex flex-col items-stretch gap-2 self-stretch sm:flex-row sm:items-center sm:justify-center sm:self-auto">
          <ButtonLink
            href={isSignedIn ? "/projects" : "/sign-in"}
            size="lg"
            className="pointer-events-auto"
          >
            Launch Designer
            <ArrowRight className="size-4" />
          </ButtonLink>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="pointer-events-auto"
          >
            <a
              href="https://github.com/DenardYap/laude-design"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="size-4" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section className="pointer-events-none relative z-10 mx-auto grid max-w-5xl gap-3 px-4 pb-16 sm:gap-4 sm:px-6 sm:pb-24 md:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="bg-surface/70 backdrop-blur">
            <CardContent className="space-y-3 p-5 sm:p-6">
              <IconBadge tone="soft" size="md" icon={<Icon />} />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
