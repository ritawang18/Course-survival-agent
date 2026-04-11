import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppStoreProvider } from "@/lib/store/AppStoreProvider";
import { ToastHost } from "@/components/ui/ToastHost";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Course Tracker — AI study planner",
  description:
    "An AI-powered course tracking and study planning app. Upload syllabi, track attendance, and get dynamic study plans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans min-h-screen">
        <AppStoreProvider>
          {children}
          <ToastHost />
        </AppStoreProvider>
      </body>
    </html>
  );
}
