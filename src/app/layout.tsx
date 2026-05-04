import type { ReactNode } from 'react';
import type { Metadata, Viewport } from "next";
import { Barlow, Cabin_Sketch } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';

import "@/styles/globals.css";
import { Toaster, TooltipProvider } from "@/components/ui";
import { QueryProvider } from "@/components/providers/query-provider";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const cabinSketch = Cabin_Sketch({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sketch",
});

export const metadata: Metadata = {
  title: "Laude Design",
  description: "Self-hosted Laude-style design workspace.",
};

// Mobile-first viewport configuration. `width=device-width, initial-scale=1`
// is what allows responsive Tailwind breakpoints (`sm:`, `md:`, `lg:`) to
// kick in on phones — without this iOS Safari renders the page at a
// zoomed-out 980px desktop width regardless of `min-h-screen` etc.
// We use `100dvh` units throughout the app shell, which need
// `viewport-fit=cover` to honour the safe-area inset variables on devices
// with a notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#15130f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${barlow.variable} ${cabinSketch.variable}`}>
      <body suppressHydrationWarning className="min-h-[100dvh] bg-background font-sans antialiased">
        <QueryProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </QueryProvider>
        <Toaster closeButton />
        <Analytics />
      </body>
    </html>
  );
}
