import type { Metadata, Viewport } from "next";
import { Fraunces, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { NativeShellBootstrap } from "@/components/native/NativeShellBootstrap";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Alinea — Learn English with purpose",
    template: "%s · Alinea",
  },
  description:
    "Adaptive English learning from ZERO to C1. Available on web, iOS and Android.",
  applicationName: "Alinea",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alinea",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.svg" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f6e6a" },
    { media: "(prefers-color-scheme: dark)", color: "#132033" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${jakarta.variable} ${fraunces.variable} ${newsreader.variable} min-h-screen antialiased`}
      >
        <NativeShellBootstrap />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
