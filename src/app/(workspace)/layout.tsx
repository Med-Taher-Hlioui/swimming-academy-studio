import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { academyConfig } from "@/config/academy";
import { DemoProvider } from "@/features/academy/demo-provider";
import { ContentStudioProvider } from "@/features/content-studio/content-provider";
import { DemoGuideProvider } from "@/features/demo/guide-provider";


export const metadata: Metadata = { title: { default: academyConfig.name, template: `%s | ${academyConfig.name}` }, description: "Private swimming academy management demonstration. All data is fictional.", robots: { index: false, follow: false } };
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div style={{ "--academy-primary": academyConfig.primaryColor } as CSSProperties}><DemoProvider><ContentStudioProvider><DemoGuideProvider><AppShell>{children}</AppShell></DemoGuideProvider></ContentStudioProvider></DemoProvider></div>;
}
