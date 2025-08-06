import { ConnectionStatusProvider } from "@/components/connect/connection-status-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TRPCProvider } from "@/trpc/client";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next";

import "./globals.css";
import { ChatToUs } from "@/components/chat-to-us";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { absolute: "director.run", template: "%s | director.run" },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            <ConnectionStatusProvider>
              <NuqsAdapter>{children}</NuqsAdapter>
            </ConnectionStatusProvider>
            <Toaster />
            <ChatToUs />
          </TRPCProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
