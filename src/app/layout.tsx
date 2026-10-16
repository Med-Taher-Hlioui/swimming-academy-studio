import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { academyConfig } from "@/config/academy";
import { DemoProvider } from "@/features/academy/demo-provider";
import { ContentStudioProvider } from "@/features/content-studio/content-provider";
import { DemoGuideProvider } from "@/features/demo/guide-provider";
import "./globals.css";

export const metadata: Metadata = { title: { default: academyConfig.name, template: `%s | ${academyConfig.name}` }, description: "Private swimming academy management demonstration. All data is fictional.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ "--academy-primary": academyConfig.primaryColor } as CSSProperties}><DemoProvider><ContentStudioProvider><DemoGuideProvider><AppShell>{children}</AppShell></DemoGuideProvider></ContentStudioProvider></DemoProvider></body></html>;
}
