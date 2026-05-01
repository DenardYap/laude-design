import type { Metadata } from "next";
import { Barlow } from "next/font/google";

import "@/styles/globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      <body className="min-h-screen bg-background font-sans antialiased">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
