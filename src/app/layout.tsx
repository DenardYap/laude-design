import type { Metadata } from "next";
import { Barlow } from "next/font/google";

import "@/styles/globals.css";
import { Toaster, TooltipProvider } from "@/components/ui";
import { QueryProvider } from "@/components/providers/query-provider";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Laude Design",
  description: "Self-hosted Laude-style design workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={barlow.variable}>
      <body suppressHydrationWarning className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </QueryProvider>
        <Toaster closeButton />
      </body>
    </html>
  );
}
