import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import DatabaseInit from "@/components/DatabaseInit";
import BackButtonHandler from "@/components/BackButtonHandler";
import ToastNotification from "@/components/ui/ToastNotification";
import NotificationEngine from "@/components/NotificationEngine";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym at Home - Health & Fitness Dashboard",
  description: "Your at-home gym companion. Track meals, exercises, and body metrics with AI-powered insights.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Static export (output: 'export') cannot serve HTTP headers, so security
// headers ship as <meta> tags. Keep in sync with any CSP changes.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com https://*.workers.dev https://api.open-meteo.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-scroll-behavior="smooth">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      </head>
      <body className="min-h-full bg-surface text-on-surface antialiased">
        <DatabaseInit>
          <StoreProvider>
            <SidebarProvider>
              {children}
              <BackButtonHandler />
              <ToastNotification />
              <NotificationEngine />
            </SidebarProvider>
          </StoreProvider>
        </DatabaseInit>
      </body>
    </html>
  );
}
