import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { QueryProvider } from "@/components/layout/query-provider";
import { SwRegistrar } from "@/components/pwa/sw-registrar";
import { WebMcpTools } from "@/components/agent/webmcp-tools";

export const metadata: Metadata = {
  title: {
    default: "Workora - Talent meets opportunity",
    template: "%s · Workora",
  },
  description:
    "Workora is a modern freelance marketplace connecting businesses with vetted independent professionals worldwide. Find talent or find work.",
  metadataBase: new URL("https://workora-phi.vercel.app"),
  manifest: "/manifest.webmanifest",
  applicationName: "Workora",
  appleWebApp: { capable: true, title: "Workora", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName: "Workora",
    type: "website",
  },
  verification: {
    google: "-z6Vmxp38nxjZc5y0MaHydjRmhx4o2r1lQWpALRB_bg",
  },
};

export const viewport: Viewport = {
  themeColor: "#5a50e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-white font-sans text-neutral-900 antialiased">
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
        <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: "var(--font-geist-sans)" } }} />
        <SwRegistrar />
        <WebMcpTools />
      </body>
    </html>
  );
}
