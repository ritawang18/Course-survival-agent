import type { Metadata } from "next";
import "./globals.css";
import { AppStoreProvider } from "@/lib/store/AppStoreProvider";
import { ToastHost } from "@/components/ui/ToastHost";

export const metadata: Metadata = {
  title: "Course Survival Agent — AI study planner",
  description:
    "An AI-powered course survival workspace for planning, Canvas context, uploads, and dynamic study plans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen" suppressHydrationWarning>
        <AppStoreProvider>
          {children}
          <ToastHost />
        </AppStoreProvider>
      </body>
    </html>
  );
}
