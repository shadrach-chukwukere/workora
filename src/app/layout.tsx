import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
 title: {
 default: "Workora - Talent meets opportunity",
 template: "%s · Workora",
 },
 description:
 "Workora is a modern freelance marketplace connecting businesses with vetted independent professionals worldwide. Find talent or find work.",
 metadataBase: new URL("https://workora.com"),
 openGraph: {
 siteName: "Workora",
 type: "website",
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
 {children}
 <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: "var(--font-geist-sans)" } }} />
 </body>
 </html>
 );
}
