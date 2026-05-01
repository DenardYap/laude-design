import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Github } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/projects");

  return (
    <main className="relative grid min-h-screen place-items-center px-6">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[420px] w-[120%] max-w-[1600px] rounded-[100%] bg-primary/40 blur-3xl" />
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Laude Design" width={56} height={56} className="size-14" priority />
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Laude Design</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your projects, API keys, and Skills.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <form action={signInWithGoogle}>
              <OAuthButton provider="google" icon={<GoogleIcon className="size-4" />}>
                Continue with Google
              </OAuthButton>
            </form>
            <form action={signInWithGithub}>
              <OAuthButton provider="github" icon={<Github className="size-4" />}>
                Continue with GitHub
              </OAuthButton>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
