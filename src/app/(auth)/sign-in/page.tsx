import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Github, TriangleAlert } from "lucide-react";

import { auth, signIn } from "@/lib/auth";
import { GoogleIcon } from "@/components/auth/google-icon";
import { OAuthButton } from "@/components/auth/oauth-button";

export const metadata = { title: "Sign in · Laude Design" };

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/projects" });
}

async function signInWithGithub() {
  "use server";
  await signIn("github", { redirectTo: "/projects" });
}

// Auth.js v5 surfaces sign-in failures via the `error` query string. We only
// special-case the message users will actually hit on this page; everything
// else falls back to a generic copy so we never render an opaque internal
// error code at the user.
function describeAuthError(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email already has an account with a different sign-in method. Sign in with the original provider you used the first time.";
    case "AccessDenied":
      return "Sign-in was cancelled or denied by the provider. Please try again.";
    case "Configuration":
      return "Sign-in is temporarily unavailable due to a configuration issue. Please try again shortly.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}

interface SignInPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  if (session?.user) redirect("/projects");

  const { error } = await searchParams;
  const errorMessage = describeAuthError(error);

  return (
    <main className="relative grid min-h-[100dvh] place-items-center px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[420px] w-[120%] max-w-[1600px] rounded-2xl bg-brand/40 blur-3xl" />
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Laude Design"
            width={56}
            height={56}
            className="size-14"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Welcome to Laude Design
          </h1>
          <p className="text-sm text-ink-muted">
            Sign in to access your projects, API keys, and Skills.
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-ink"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <form action={signInWithGoogle}>
            <OAuthButton
              provider="google"
              icon={<GoogleIcon className="size-4" />}
            >
              Continue with Google
            </OAuthButton>
          </form>
          <form action={signInWithGithub}>
            <OAuthButton provider="github" icon={<Github className="size-4" />}>
              Continue with GitHub
            </OAuthButton>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-subtle">
          By continuing you agree to our{" "}
          <Link
            href="/terms"
            className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
