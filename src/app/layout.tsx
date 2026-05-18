import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";
import { IdleScreensaver } from "@/components/shell/idle-screensaver";
import { getCurrentLocale } from "@/i18n/locale";
import { getScreensaverIdleMinutes } from "@/lib/queries";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FamilyBoard",
  description: "Your family's command center",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      {
        url: "/icon-192.png",
        type: "image/png",
        sizes: "192x192",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-192-dark.png",
        type: "image/png",
        sizes: "192x192",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      // iOS home-screen icon — light variant fits both light and dark wallpapers
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#10131F" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, idleMinutes] = await Promise.all([
    getCurrentLocale(),
    getMessages(),
    getScreensaverIdleMinutes(),
  ]);

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${geist.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <QueryProvider>
              <ServiceWorkerRegister />
              <IdleScreensaver minutes={idleMinutes} />
              {children}
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
