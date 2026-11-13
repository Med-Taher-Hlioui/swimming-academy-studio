import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { ContentStudio } from "@/features/content-studio/content-studio";

export default function SharkPage() {
  return <>
    <PageHeading title="SHARK AI · Content Studio" description="Plan your next swimming story. Create, edit and organize fictional social content for your academy." />
    <ContentStudio />
  </>;
}

export const metadata: Metadata = { title: "SHARK AI Demo Generator" };
